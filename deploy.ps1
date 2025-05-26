
$resourceGroup = "RGNAME"
$location = "southafricanorth"
$planName = "PLANNAME"
$storageAccount = "STORAGEACCOUNTNAME"
$zipPath = "app.zip"
$storageContainerName = "anime-images"
$appServiceSKU="p0v3"
$appName = "APPNAME"
$OPENAI_API_KEY = "OPENAI_API_KEY"
$QR_URL=ENTER_QR_URL
$LOGO_NAME=microsoft-logo-1.png

# create a resource group
az group create `
    --name $resourceGroup `
    --location $location

# create a storage account
az storage account create `
    --name $storageAccount `
    --resource-group $resourceGroup `
    --location $location `
    --sku Standard_LRS

Write-Host "Storage account $storageAccount created"

# create a blob container
az storage container create `
    --name $storageContainerName `
    --account-name $storageAccount



# give the current user access to the storage account
az role assignment create `
    --role "Storage Blob Data Contributor" `
    --assignee (az ad signed-in-user show --query id -o tsv) `
    --scope (az storage account show --name $storageAccount --resource-group $resourceGroup --query id -o tsv)  


# Create App Service Plan
az appservice plan create `
    --name $planName `
    --resource-group $resourceGroup `
    --location $location `
    --sku $appServiceSKU `
    --is-linux 

Write-Host "App Service Plan $planName created"

# Create an App Service using node runtime 20


az webapp create `
    --name $appName `
    --resource-group $resourceGroup `
    --plan $planName `
    --runtime "NODE:20-lts" `
    --assign-identity [system]

Write-Host "App Service $appName created"


# Assign the Storage Blob Data Contributor role to the App Service's managed identity
az role assignment create `
    --role "Storage Blob Data Contributor" `
    --assignee (az webapp identity assign --name $appName --resource-group $resourceGroup --query principalId -o tsv) `
    --scope (az storage account show --name $storageAccount --resource-group $resourceGroup --query id -o tsv)

# RUN BELOW TO DEPLOY THE APP

az webapp stop --resource-group $resourceGroup --name $appName

# Install sharp with the correct CPU architecture and OS
npm install --cpu=x64 --os=linux sharp

# Zip the deployment package (exclude node_modules and temp files)
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path * -DestinationPath $zipPath -Force

az webapp deploy --resource-group $resourceGroup --name $appName --src-path $zipPath
   az webapp config appsettings set `
    --resource-group $resourceGroup `
    --name $appName `
    --settings NODE_ENV=production WEBSITE_NODE_DEFAULT_VERSION=~20 OPENAI_API_KEY=$OPENAI_API_KEY `
     STORAGE_URL=$storageAccount WEBSITE_RUN_FROM_PACKAGE="1" `
     QR_URL=$QR_URL `
     LOGO_NAME=$LOGO_NAME

az webapp start --resource-group $resourceGroup --name $appName
# till here
## OpenAI deployment and model steps


$openaiName = "ENTERNAME"
$openaiSku = "S0"
$modelDeploymentName = "gpt-image-1"
$modelName = "gpt-image-1"
$ailocation="uaenorth"

Write-Host "Creating Azure OpenAI resource..."
az cognitiveservices account create `
    --name $openaiName `
    --resource-group $resourceGroup `
    --location $ailocation `
    --kind OpenAI `
    --sku $openaiSku `
    --custom-domain $openaiName


Write-Host "Azure OpenAI resource created: $openaiName"

# Get the endpoint and key for the OpenAI resource
$openaiEndpoint = az cognitiveservices account show `
    --name $openaiName `
    --resource-group $resourceGroup `
    --query properties.endpoint `
    --output tsv

Write-Host "Azure OpenAI endpoint: $openaiEndpoint"



# give the current user access to the OpenAI resource
az role assignment create `
    --role "Cognitive Services Contributor" `
    --assignee (az ad signed-in-user show --query id -o tsv) `
    --scope (az cognitiveservices account show --name $openaiName --resource-group $resourceGroup --query id -o tsv)

# give the appservice managed identity access to the OpenAI resource
az role assignment create `
    --role "Cognitive Services Contributor" `
    --assignee (az webapp identity assign --name $appName --resource-group $resourceGroup --query principalId -o tsv) `
    --scope (az cognitiveservices account show --name $openaiName --resource-group $resourceGroup --query id -o tsv)

# give azure ai user permissions to the openai ressouce to both the current user and the appservice managed identity
# give the current user access to the OpenAI resource
az role assignment create `
    --role "Azure AI User" `
    --assignee (az ad signed-in-user show --query id -o tsv) `
    --scope (az cognitiveservices account show --name $openaiName --resource-group $resourceGroup --query id -o tsv)

# give the appservice managed identity access to the OpenAI resource
az role assignment create `
    --role "Azure AI User" `
    --assignee (az webapp identity assign --name $appName --resource-group $resourceGroup --query principalId -o tsv) `
    --scope (az cognitiveservices account show --name $openaiName --resource-group $resourceGroup --query id -o tsv)


# Deploy the gpt-1 model 
Write-Host "Deploying DALL-E model..."
az cognitiveservices account deployment create `
    --name $openaiName `
    --resource-group $resourceGroup `
        --deployment-name $modelDeploymentName `
        --model-name $modelName `
        --model-version "2025-04-15" `
        --model-format OpenAI `
        --sku "GlobalStandard" `
        --capacity 1 



Write-Host "gpt image model deployed successfully!"

az webapp deploy --resource-group $resourceGroup --name $appName --src-path $zipPath
   az webapp config appsettings set `
    --resource-group $resourceGroup `
    --name $appName `
    --settings NODE_ENV=production WEBSITE_NODE_DEFAULT_VERSION=~20 OPENAI_API_KEY=$OPENAI_API_KEY `
     STORAGE_URL=$storageAccount WEBSITE_RUN_FROM_PACKAGE="1" `
     QR_URL=$QR_URL `
     LOGO_NAME=$LOGO_NAME