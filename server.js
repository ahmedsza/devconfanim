// Load environment variables from .env file in non-production environments
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
} else {
  console.log('Running in production mode - environment variables should be set in App Service Configuration');
}
const { AzureOpenAI } = require("openai");
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DefaultAzureCredential, getBearerTokenProvider  } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');
const { OpenAIClient } = require('@azure/openai');
const QRCode = require('qrcode');
const sharp = require('sharp');
const fs = require('fs');
const OpenAI = require("openai").default;
const { toFile } = require("openai");
const axios = require("axios");
const FormData = require("form-data");
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create temp directory if it doesn't exist
// I want tempdir to be created in a mounted volume
// so that it can be shared between multiple instances

// let imagelocation='/home';
// const tempDir = path.join(imagelocation, 'temp');
// // const tempDir = path.join(__dirname, 'temp');

// if (!fs.existsSync(tempDir)) {
//   fs.mkdirSync(tempDir);
// }

// Azure Storage setup
let credential, blobServiceClient, containerClient, openAIClient;

try {
  credential = new DefaultAzureCredential();
  const scope = "https://cognitiveservices.azure.com/.default";
const azureADTokenProvider = getBearerTokenProvider(credential, scope);
  const deployment = "gpt-image-1";
const apiVersion = "2025-04-01-preview";
  if (process.env.STORAGE_ACCOUNT_NAME) {
    blobServiceClient = new BlobServiceClient(
      `https://${process.env.STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
      credential
    );
    containerClient = blobServiceClient.getContainerClient(process.env.CONTAINER_NAME || 'anime-images');
    console.log('Azure Blob Storage connected');
  } else {
    console.log('STORAGE_ACCOUNT_NAME not provided, Azure Blob Storage will not be used');
  }
  
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    // openAIClient =  new OpenAI();
    openAIClient =new AzureOpenAI({ azureADTokenProvider, deployment, apiVersion }
    

    )
    console.log('Azure OpenAI connected');
  } else {
    console.log('AZURE_OPENAI_ENDPOINT not provided, Azure OpenAI will not be used');
  }
} catch (error) {
  console.error('Error setting up Azure services:', error);
  console.log('Azure services setup failed');
}

// Configure multer for temporary file storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper function to generate anime image using Azure OpenAI with DALL-E
async function generateAnimeImage(imageBuffer) {
  try {
    // Resize image to acceptable size (1024x1024 max)
    const resizedImage = await sharp(imageBuffer)
      .resize({ width: 1024, height: 1024, fit: 'inside' })
      .toBuffer();

    // Create a temporary file for the image
    //const tempImagePath = path.join(__dirname, 'temp.png');
    //fs.writeFileSync(tempImagePath, resizedImage);

    try {
      // Get Azure AD token using DefaultAzureCredential
      const credential = new DefaultAzureCredential();
      const tokenResponse = await credential.getToken("https://cognitiveservices.azure.com/.default");
      
      // Prepare API URL
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://ahmsimagegen.openai.azure.com/";
      const deployment = "gpt-image-1";
      const apiVersion = "2025-04-01-preview";
      const editsPath = `openai/deployments/${deployment}/images/edits`;
      const params = `?api-version=${apiVersion}`;
      const editsUrl = `${endpoint}${editsPath}${params}`;

      // Prepare form data for the request
      const formData = new FormData();
      formData.append("prompt", "Convert this photo to high-quality anime style art, keep the same pose and appearance");
      formData.append("n", "1");
      formData.append("size", "1024x1024");
      formData.append("quality", "medium");
      formData.append("image", resizedImage, "temp.png");

      console.log(`Sending image edit request to ${editsUrl}`);
      console.log(`Bearer token: ${tokenResponse.token}`);
      // Make the API call
      const editResponse = await axios.post(editsUrl, formData, { 
        headers: {
          'Authorization': `Bearer ${tokenResponse.token}`,
          ...formData.getHeaders()
        }
      });

      // Process the response
      if (editResponse.data && editResponse.data.data && editResponse.data.data.length > 0) {
        // Extract base64 image data
        const image_base64 = editResponse.data.data[0].b64_json;
        const image_bytes = Buffer.from(image_base64, "base64");
        
        // Return the image buffer
        return image_bytes;
      } else {
        throw new Error('No image was generated');
      }
    } finally {
      // Clean up temporary file
      // if (fs.existsSync(tempImagePath)) {
      //   fs.unlinkSync(tempImagePath);
      // }
    }
  } catch (error) {
    console.error('Error generating anime image:', error);
    throw error;
  }
}

// Helper function to add QR code to image
async function addQRCodeToImage(imageBuffer, qrCodeContent) {
  try {
    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeContent, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
      color: {
        dark: '#000',
        light: '#FFF'
      }
    });
    
    // Convert QR code data URL to buffer
    const qrCodeData = qrCodeDataUrl.split(',')[1];
    const qrCodeBuffer = Buffer.from(qrCodeData, 'base64');
    
    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
     const iconSize = Math.round(Math.min(width, height) * 0.2);
    // Resize QR code to be proportional to the image size
    //const qrSize = Math.min(width, height) * 0.2; // QR code size is 20% of the smallest dimension
 const qrCodeResized = await sharp(qrCodeBuffer)
      .resize(iconSize, iconSize)
      .toBuffer();

    
    // read the logo name from env variable
    const logoName = process.env.LOGO_NAME || 'microsoft-logo.png';
    const logoPath = path.join(__dirname, 'public', logoName);
    const logoResized = await sharp(logoPath)
      .resize(iconSize, iconSize)
      .toBuffer();

    const padding = 20;

    // Composite: logo bottom left, QR code bottom right
    const composite = [
      {
        input: logoResized,
        top: height - iconSize - padding,
        left: padding,
      },
      {
        input: qrCodeResized,
        top: height - iconSize - padding,
        left: width - iconSize - padding,
      }
    ];

    // Composite images together
    const resultImage = await sharp(imageBuffer)
      .composite(composite)
      .toBuffer();

    return resultImage;
  } catch (error) {
    console.error('Error adding QR code to image:', error);
    throw error;
  }
}

// Upload image route
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Generate a unique ID for this image processing
    const imageId = uuidv4();
    
    // Process image to anime style
    const animeImage = await generateAnimeImage(req.file.buffer);
    
    // Upload the original image to blob storage
    // const blobName = `${imageId}-original.jpg`;
    // const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    // await blockBlobClient.uploadData(req.file.buffer);
    
    // Add URL to QR code
    //const qrCodeContent = blockBlobClient.url;
    // read url from env variable
    const qrCodeContent = process.env.QR_URL;
   // const qrCodeContent = "https://ai.azure.com";
    // Add QR code to the anime image
    const finalImage = await addQRCodeToImage(animeImage, qrCodeContent);
    
    // Upload the final image to blob storage
    const finalBlobName = `${imageId}-final.jpg`;
    const finalBlockBlobClient = containerClient.getBlockBlobClient(finalBlobName);
    await finalBlockBlobClient.uploadData(finalImage);
    
    // // Get URL for the final image
    // const finalImageUrl = finalBlockBlobClient.url;

    // Return the final image directly
    res.set('Content-Type', 'image/jpeg');
    res.status(200).send(finalImage);

    console.log('Response sent');
    
  } catch (error) {
    console.error('Error processing image:', error);
    // res.status(500).json({ error: 'Error processing image', details: error.message });
  }
});

// List gallery images endpoint
app.get('/api/gallery', async (req, res) => {
  try {
    if (!containerClient) {
      return res.status(500).json({ error: 'Azure Blob Storage not configured' });
    }
    const images = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      // Only include images (e.g., .jpg, .png)
      if (blob.name.match(/\.(jpg|jpeg|png)$/i)) {
        images.push({
          id: blob.name,
          url: `/api/images/${encodeURIComponent(blob.name)}`
        });
      }
    }
    res.json(images);
  } catch (err) {
    console.error('Error listing gallery images:', err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Endpoint to serve individual images by blob name
app.get('/api/images/:blobName', async (req, res) => {
  try {
    if (!containerClient) {
      return res.status(500).json({ error: 'Azure Blob Storage not configured' });
    }
    
    const blobName = decodeURIComponent(req.params.blobName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Check if blob exists
    const exists = await blockBlobClient.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Download the blob content
    const downloadResponse = await blockBlobClient.download(0);
    
    // Set appropriate content type
    if (blobName.endsWith('.jpg') || blobName.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/jpeg');
    } else if (blobName.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
    }
    
    // Stream the blob content to the response
    downloadResponse.readableStreamBody.pipe(res);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Running in ${process.env.NODE_ENV || 'development'} mode`);
});