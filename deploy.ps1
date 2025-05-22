
$resourceGroup = "RGNAME"
$location = "southafricanorth"
$planName = "PLANNAME"
$storageAccount = "STORAGEACCOUNTNAME"
$zipPath = "app.zip"
$storageContainerName = "anime-images"
$appServiceSKU="p0v3"
$appName = "APPNAME"
$OPENAI_API_KEY = "OPENAI_API_KEY"

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

# create a file share 
az storage share create `
    --name "imageshare" `
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

# mount the file share to the app service
az webapp config storage-account add `
    --resource-group $resourceGroup `
    --name $appName `
    --custom-id "imageshare" `
    --storage-type AzureFiles `
    --share-name "imageshare" `
    --account-name $storageAccount `
    --access-key (az storage account keys list --account-name $storageAccount --resource-group $resourceGroup --query "[0].value" -o tsv)

# Assign the Storage Blob Data Contributor role to the App Service's managed identity
az role assignment create `
    --role "Storage Blob Data Contributor" `
    --assignee (az webapp identity assign --name $appName --resource-group $resourceGroup --query principalId -o tsv) `
    --scope (az storage account show --name $storageAccount --resource-group $resourceGroup --query id -o tsv)


# Install dependencies

npm install --cpu=x64 --os=linux sharp

# Zip the deployment package (exclude node_modules and temp files)
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path * -DestinationPath $zipPath -Force
az webapp deploy --resource-group $resourceGroup --name $appName --src-path $zipPath



# Deploy the zip package

az webapp deploy --resource-group $resourceGroup --name $appName --src-path $zipPath

# Set required app settings (customize as needed)
    az webapp config appsettings set `
    --resource-group $resourceGroup `
    --name $appName `
    --settings NODE_ENV=production WEBSITE_NODE_DEFAULT_VERSION=~20 OPENAI_API_KEY=$OPENAI_API_KEY STORAGE_ACCOUNT_NAME=$storageAccount WEBSITE_RUN_FROM_PACKAGE="1"

Write-Host "Deployment complete! Visit: https://$appName.azurewebsites.net"