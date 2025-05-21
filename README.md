# Anime Photo Generator

Generate anime-style photos with QR codes for events.

## Overview

This web application allows users to:
1. Take a photo with their iPhone camera or upload from gallery
2. Convert the photo to an anime style using Azure AI
3. Add a QR code to the image (linking back to the original)
4. Save the final image to their camera roll
5. Print the photo using an Instax printer

Perfect for events where attendees want fun, styled photos they can share and print.

## Features

- Mobile-friendly web interface optimized for iPhone
- Camera integration for photo capture
- AI-powered anime style conversion using Azure OpenAI (DALL-E)
- QR code generation and embedding
- Save to camera roll functionality
- PWA capable for home screen installation
- Integration with Instax printers (via device sharing)

## Architecture

The application uses:
- **Frontend**: HTML5, CSS3, JavaScript (responsive design)
- **Backend**: Node.js with Express
- **Azure Services**:
  - Azure App Service (hosting)
  - Azure OpenAI Service (AI image processing)
  - Azure Blob Storage (image storage)
  - Azure Managed Identity (secure authentication)

## Local Development

1. Clone the repository:
   ```
   git clone https://github.com/warrendt/devconf_anime_gen.git
   cd devconf_anime_gen
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   STORAGE_ACCOUNT_NAME=
   CONTAINER_NAME=anime-images
   OPENAI_ENDPOINT=
   OPENAI_DEPLOYMENT_NAME=
   PORT=3001
   NODE_ENV=development
   ```

4. Start the development server:
   ```
   npm start
   ```

5. Open your browser to `http://localhost:3001`

## Deployment to Azure

### Prerequisites

- Azure subscription
- Azure CLI installed
- Node.js and npm installed

### Deploy using the script

1. Make sure the script is executable:
   ```
   chmod +x deploy.sh
   ```

2. Run the deployment script:
   ```
   ./deploy.sh -g MyResourceGroup -l eastus -n myanimeapp
   ```

   Parameters:
   - `-g` or `--resource-group`: Required. The name of the resource group.
   - `-l` or `--location`: Optional. Azure region (default: eastus).
   - `-n` or `--name`: Optional. Base name for resources (will be generated if not provided).

3. Once deployed, open the web app URL displayed in the output.

### Manual Deployment

1. Create Azure resources using the Bicep template:
   ```
   az group create --name MyResourceGroup --location eastus
   az deployment group create --resource-group MyResourceGroup --template-file ./infra/main.bicep
   ```

2. Build the application:
   ```
   npm install
   npm run build
   ```

3. Deploy to Azure App Service using your preferred method (ZIP, GitHub Actions, etc.).

## Usage at Events

1. Set up a station with a tablet or phone accessing the web app
2. Attendees take photos or upload their own
3. The app converts to anime style and adds a QR code
4. Attendees can save the image to their camera roll
5. Connect to an Instax printer to print the image on-site

## License

This project is licensed under the terms of the license included in the repository.

## Acknowledgements

- Azure OpenAI for the image conversion capabilities
- QRCode.js for QR code generation
- The Instax team for printer compatibility
