#!/bin/bash

# Exit on error
set -e

# Initialize variables
RESOURCE_GROUP=""
LOCATION="eastus"
BASE_NAME=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -g|--resource-group)
      RESOURCE_GROUP="$2"
      shift
      shift
      ;;
    -l|--location)
      LOCATION="$2"
      shift
      shift
      ;;
    -n|--name)
      BASE_NAME="$2"
      shift
      shift
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Check if resource group was provided
if [ -z "$RESOURCE_GROUP" ]; then
  echo "Resource group name is required. Use -g or --resource-group option."
  exit 1
fi

# Generate a base name if not provided
if [ -z "$BASE_NAME" ]; then
  BASE_NAME="animeapp$(date +%s)"
  echo "Using generated base name: $BASE_NAME"
fi

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
  echo "Azure CLI is not installed. Please install it first."
  exit 1
fi

# Check if logged in to Azure
echo "Checking Azure login status..."
az account show &> /dev/null || {
  echo "Not logged in to Azure. Please run 'az login' first."
  exit 1
}

# Create resource group if it doesn't exist
echo "Creating resource group $RESOURCE_GROUP in $LOCATION if it doesn't exist..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# Deploy Bicep template
echo "Deploying Azure resources using Bicep..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "./infra/main.bicep" \
  --parameters baseName="$BASE_NAME" location="$LOCATION" \
  --output json)

# Extract values from deployment output
WEBAPP_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.webAppUrl.value')
STORAGE_ACCOUNT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.storageAccountName.value')
CONTAINER_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerName.value')
OPENAI_ENDPOINT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.openAIEndpoint.value')

echo "Infrastructure deployment complete!"
echo "Web App URL: $WEBAPP_URL"
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Container Name: $CONTAINER_NAME"
echo "OpenAI Endpoint: $OPENAI_ENDPOINT"

# Install dependencies
echo "Installing dependencies..."
npm install

# Create a temporary web.config file for deployment
echo "Creating web.config file..."
cat > web.config <<EOL
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <webSocket enabled="false" />
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}" />
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
          </conditions>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
          </conditions>
          <action type="Rewrite" url="server.js" />
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering removeServerHeader="true" />
    </security>
    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
      </customHeaders>
    </httpProtocol>
    <iisnode watchedFiles="web.config;*.js" nodeProcessCommandLine="node" />
  </system.webServer>
</configuration>
EOL

# Create a production-ready .env file for deployment
echo "Creating production .env file..."
cat > .env.production <<EOL
# Production environment settings - these will be overridden by App Service settings
NODE_ENV=production
LOCAL_TESTING=false
EOL

# Deploy application to Web App
echo "Deploying application to Web App..."
# Create a deployment package
echo "Creating deployment package..."
rm -f deployment.zip
zip -r deployment.zip . -x "node_modules/*" -x ".git/*" -x "deployment.zip" -x ".env" -x "temp/*"

# Update app settings
echo "Updating App Service settings..."
az webapp config appsettings set --resource-group "$RESOURCE_GROUP" --name "${BASE_NAME}-webapp" --settings \
  "WEBSITE_RUN_FROM_PACKAGE=0" \
  "SCM_DO_BUILD_DURING_DEPLOYMENT=true" \
  "STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT" \
  "CONTAINER_NAME=$CONTAINER_NAME" \
  "OPENAI_ENDPOINT=$OPENAI_ENDPOINT" \
  "OPENAI_DEPLOYMENT_NAME=$openAIDeploymentName" \
  "NODE_ENV=production" \
  "LOCAL_TESTING=false" \
  "WEBSITE_NODE_DEFAULT_VERSION=~20" \
  "NPM_CONFIG_PRODUCTION=true"

# Deploy the zip package
echo "Uploading deployment package..."
az webapp deployment source config-zip --resource-group "$RESOURCE_GROUP" --name "${BASE_NAME}-webapp" --src "deployment.zip"

echo "Application deployment complete!"
echo "Your Anime Photo Generator is now available at: $WEBAPP_URL"