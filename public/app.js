document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const takePhotoBtn = document.getElementById('take-photo-btn');
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const newPhotoBtn = document.getElementById('new-photo-btn');
    const resultImage = document.getElementById('result-image');
    const cameraContainer = document.getElementById('camera-container');
    const cameraPreview = document.getElementById('camera-preview');
    
    const uploadContainer = document.querySelector('.upload-container');
    const processingContainer = document.querySelector('.processing-container');
    const resultContainer = document.querySelector('.result-container');
    
    let stream = null;
    let currentImageUrl = null;
    
    // Event listeners
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageUpload(e.target.files[0]);
        }
    });
    
    takePhotoBtn.addEventListener('click', startCamera);
    uploadPhotoBtn.addEventListener('click', () => fileInput.click());
    saveBtn.addEventListener('click', saveToDevice);
    shareBtn.addEventListener('click', shareImage);
    newPhotoBtn.addEventListener('click', resetApp);
    
    // Gallery button in header
    document.getElementById('main-gallery-btn').addEventListener('click', function() {
        window.location.href = 'gallery.html';
    });
    
    // Gallery button in results container
    document.getElementById('gallery-btn').addEventListener('click', function() {
        window.location.href = 'gallery.html';
    });
    
    // Initialize the app based on device capabilities
    initializeApp();
    
    // Functions
    function initializeApp() {
        // Check if the browser supports camera access
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            takePhotoBtn.style.display = 'block';
        } else {
            takePhotoBtn.style.display = 'none';
        }
        
        // Check if the browser supports file download
        if ('download' in document.createElement('a')) {
            saveBtn.style.display = 'block';
        } else {
            saveBtn.style.display = 'none';
        }
        
        // Check if the Web Share API is supported
        if (navigator.share) {
            shareBtn.style.display = 'block';
        } else {
            shareBtn.style.display = 'none';
        }
    }
    
    function startCamera() {
        if (stream) {
            stopCamera();
            return;
        }
        
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
            .then((videoStream) => {
                stream = videoStream;
                cameraPreview.srcObject = stream;
                cameraContainer.style.display = 'block';
                takePhotoBtn.textContent = 'Capture Photo';
                
                // Add a click event to the camera preview to take a photo
                cameraPreview.addEventListener('click', capturePhoto);
            })
            .catch((error) => {
                console.error('Error accessing camera:', error);
                alert('Could not access the camera. Please grant permission or use the upload option.');
            });
    }
    
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            cameraPreview.srcObject = null;
            cameraContainer.style.display = 'none';
            takePhotoBtn.textContent = 'Take Photo';
            cameraPreview.removeEventListener('click', capturePhoto);
        }
    }
    
    function capturePhoto() {
        if (!stream) return;
        
        // Create a canvas to capture the frame
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = cameraPreview.videoWidth;
        canvas.height = cameraPreview.videoHeight;
        context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob(blob => {
            stopCamera();
            handleImageUpload(blob);
        }, 'image/jpeg', 0.8);
    }
    
    function handleImageUpload(file) {
        // Show processing state
        uploadContainer.style.display = 'none';
        processingContainer.style.display = 'flex';

        // Create form data for the API request
        const formData = new FormData();
        formData.append('image', file);

        // Send the image to the server
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.blob(); // Expect an image blob
        })
        .then(blob => {
            // Create a local URL for the image blob
            currentImageUrl = URL.createObjectURL(blob);
            resultImage.src = currentImageUrl;
            resultImage.onload = () => {
                processingContainer.style.display = 'none';
                resultContainer.style.display = 'flex';
            };
        })
        .catch(error => {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again.');
            resetApp();
        });
    }
    
    function saveToDevice() {
        if (!currentImageUrl) return;
        
        // For iOS Safari, we need to use a different approach
        if (isIOS()) {
            // Open image in a new tab for saving
            window.open(currentImageUrl, '_blank');
            alert('To save the image to your camera roll, tap and hold the image, then select "Save to Photos"');
        } else {
            // For other browsers, create a download link
            const link = document.createElement('a');
            link.href = currentImageUrl;
            link.download = `anime-photo-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    function shareImage() {
        if (!currentImageUrl || !navigator.share) return;
        
        // Use the Web Share API for mobile devices
        fetch(currentImageUrl)
            .then(response => response.blob())
            .then(blob => {
                const file = new File([blob], `anime-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
                navigator.share({
                    title: 'My Anime Photo',
                    text: 'Check out my anime-style photo!',
                    files: [file]
                })
                .catch(error => {
                    console.error('Error sharing image:', error);
                    alert('Could not share the image. Try saving it first.');
                });
            })
            .catch(error => {
                console.error('Error fetching image for sharing:', error);
            });
    }
    
    function resetApp() {
        // Reset the UI state
        resultContainer.style.display = 'none';
        processingContainer.style.display = 'none';
        uploadContainer.style.display = 'block';
        
        // Clear the file input
        fileInput.value = '';
        
        // Stop the camera if it's running
        stopCamera();
        
        // Clear the result image
        resultImage.src = '';
        currentImageUrl = null;
    }
    
    function isIOS() {
        return [
            'iPad Simulator',
            'iPhone Simulator',
            'iPod Simulator',
            'iPad',
            'iPhone',
            'iPod'
        ].includes(navigator.platform) || 
        (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    }
});