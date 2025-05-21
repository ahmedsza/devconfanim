@description('Base name for all resources')
param baseName string = 'animeapp${uniqueString(resourceGroup().id)}'

@description('Location for all resources')
param location string = resourceGroup().location

@description('The SKU of App Service Plan')
param appServicePlanSku string = 'P0v3' // PremiumV3 SKU for better performance

@description('The name of the Azure OpenAI deployment')
param openAIDeploymentName string = 'dall-e-3'

var appServicePlanName = '${baseName}-plan'
var webAppName = '${baseName}-webapp'
var storageAccountName = replace('${baseName}storage', '-', '')
var containerName = 'images'
var openAIAccountName = '${baseName}-openai'

// Create App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServicePlanSku
  }
  properties: {
    reserved: true // For Linux
  }
}

// Create Web App
resource webApp 'Microsoft.Web/sites@2022-03-01' = {
  name: webAppName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        {
          name: 'STORAGE_ACCOUNT_NAME'
          value: storageAccount.name
        }
        {
          name: 'CONTAINER_NAME'
          value: containerName
        }
        {
          name: 'OPENAI_ENDPOINT'
          value: 'https://${openAIAccount.name}.openai.azure.com/'
        }
        {
          name: 'OPENAI_DEPLOYMENT_NAME'
          value: openAIDeploymentName
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'LOCAL_TESTING'
          value: 'false'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '0'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        // Adding NPM_CONFIG settings to ensure proper installation of dependencies
        {
          name: 'NPM_CONFIG_PRODUCTION'
          value: 'true'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
      ]
      alwaysOn: true
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Create Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true
  }
}

// Create Blob Container
resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2022-09-01' = {
  name: '${storageAccount.name}/default/${containerName}'
  properties: {
    publicAccess: 'Blob' // Allow public access to blobs for image sharing
  }
}

// Create OpenAI Account
resource openAIAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: openAIAccountName
  location: location
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: openAIAccountName
  }
}

// Assign Storage Blob Data Contributor role to Web App managed identity
resource storageBlobDataContributorRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webApp.id, storageAccount.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: storageAccount
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Cognitive Services OpenAI User role to Web App managed identity
resource openAIUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webApp.id, openAIAccount.id, '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  scope: openAIAccount
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd') // Cognitive Services OpenAI User
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Output the website URL
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output storageAccountName string = storageAccount.name
output containerName string = containerName
output openAIEndpoint string = 'https://${openAIAccount.name}.openai.azure.com/'
