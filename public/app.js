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
    let cameraPreview = document.getElementById('camera-preview');
    
    const uploadContainer = document.querySelector('.upload-container');
    const processingContainer = document.querySelector('.processing-container');
    const resultContainer = document.querySelector('.result-container');
    
    let stream = null;
    let currentImageUrl = null;
    let currentFacingMode = 'environment'; // Start with back camera
    
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
    function detectPlatform() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // iOS detection
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        // Android detection
        const isAndroid = /android/i.test(userAgent);
        
        // Desktop detection
        const isMac = /Mac/.test(navigator.platform) && !isIOS;
        const isWindows = /Win/.test(navigator.platform);
        
        // Browser detection
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
        
        return {
            isIOS,
            isAndroid,
            isMac,
            isWindows,
            isMobile: isIOS || isAndroid,
            isSafari
        };
    }
    
    function initializeApp() {
        const platform = detectPlatform();
        
        // Check camera support
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            takePhotoBtn.style.display = 'block';
        } else {
            takePhotoBtn.style.display = 'none';
        }
        
        // Handle save button visibility - all modern browsers should support this now
        saveBtn.style.display = 'block';
        
        // Check Web Share API support
        if (navigator.share) {
            shareBtn.style.display = 'block';
        } else {
            shareBtn.style.display = 'none';
        }
        
        // Add platform-specific classes for styling
        const bodyElement = document.body;
        if (platform.isIOS) bodyElement.classList.add('ios');
        if (platform.isAndroid) bodyElement.classList.add('android');
        if (platform.isMac) bodyElement.classList.add('macos');
        if (platform.isWindows) bodyElement.classList.add('windows');
        if (platform.isMobile) bodyElement.classList.add('mobile');
        
        // Improve touch support for mobile devices
        if (platform.isMobile) {
            // Add passive touch listeners for better scrolling performance
            document.addEventListener('touchstart', function(){}, {passive: true});
            
            // Prevent double-tap zoom on buttons
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
                button.addEventListener('touchend', function(e) {
                    e.preventDefault();
                    // Trigger click event manually
                    this.click();
                });
            });
        }
    }
    
    function startCamera(requestedFacingMode = null) {
        // If a specific mode is requested, use it, otherwise toggle
        if (requestedFacingMode) {
            currentFacingMode = requestedFacingMode;
        }

        // Stop any existing stream first
        if (stream) {
            stopCamera();
        }
        
        // Show loading indicator
        cameraContainer.style.display = 'block';
        cameraContainer.innerHTML = `
            <div class="camera-loading">
                <div class="spinner"></div>
                <p>Starting camera...</p>
            </div>
            <video id="camera-preview" autoplay playsinline></video>
            <div id="camera-controls" class="camera-controls">
                <button id="switch-camera-btn" class="camera-control-btn" title="Switch Camera">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7"></path>
                        <path d="M16 5l-4-4v3a4 4 0 004 4h3l-3 3"></path>
                    </svg>
                </button>
            </div>`;
        
        // Get fresh references to elements
        cameraPreview = document.getElementById('camera-preview');
        const switchCameraBtn = document.getElementById('switch-camera-btn');
        
        // Set constraints based on requested facing mode
        const constraints = {
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        
        // Try to get access to the camera
        navigator.mediaDevices.getUserMedia(constraints)
            .then((videoStream) => {
                stream = videoStream;
                cameraPreview.srcObject = stream;
                cameraPreview.style.display = 'block';
                
                // Remove loading indicator
                const loadingDiv = cameraContainer.querySelector('.camera-loading');
                if (loadingDiv) {
                    loadingDiv.remove();
                }
                
                // Check if camera switching is supported
                navigator.mediaDevices.enumerateDevices()
                    .then(devices => {
                        const videoDevices = devices.filter(device => device.kind === 'videoinput');
                        
                        // Only show switch button if multiple cameras are available
                        if (videoDevices.length > 1) {
                            switchCameraBtn.style.display = 'flex';
                            
                            // Remove any existing event listeners first to prevent duplicates
                            switchCameraBtn.removeEventListener('click', toggleCamera);
                            
                            // Add new event listener with explicit event parameter
                            switchCameraBtn.addEventListener('click', function(e) {
                                // Stop propagation immediately to prevent triggering upload dialog
                                e.stopPropagation();
                                e.preventDefault();
                                toggleCamera(e);
                            });
                            
                            console.log('Camera switch button enabled for', videoDevices.length, 'cameras');
                        } else {
                            switchCameraBtn.style.display = 'none';
                            console.log('Camera switch button disabled - only one camera detected');
                        }
                    })
                    .catch(err => {
                        console.error("Could not enumerate devices:", err);
                        switchCameraBtn.style.display = 'none';
                    });
                    
                // Add click event to video for capture with proper event handling
                cameraPreview.addEventListener('click', function(e) {
                    e.stopPropagation(); // Stop event from bubbling to parent elements
                    e.preventDefault();
                    capturePhoto();
                });
                
                // Restore the other event listeners when camera is stopped
                takePhotoBtn.textContent = 'Capture Photo';
                
                // Update take photo button to capture instead of toggle camera
                takePhotoBtn.removeEventListener('click', startCamera);
                takePhotoBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    capturePhoto();
                });
            })
            .catch((error) => {
                console.error('Error accessing camera:', error);
                
                // Error handling with specific messages
                let errorMessage = 'Could not access the camera. Please try again or use the upload option.';
                
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Camera access denied. Please enable camera permissions in your browser settings.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No camera found on your device.';
                } else if (error.name === 'NotReadableError') {
                    errorMessage = 'Camera is in use by another application or not available.';
                } else if (error.name === 'OverconstrainedError') {
                    // Try again with different constraints
                    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
                    startCamera(currentFacingMode);
                    return;
                }
                
                alert(errorMessage);
                cameraContainer.style.display = 'none';
            });
    }
    
    // Function to toggle between front and back cameras
    function toggleCamera(event) {
        // Prevent event from bubbling up and triggering other handlers
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        // Log the switch operation for debugging
        console.log('Switching camera from', currentFacingMode, 'to', 
                    currentFacingMode === 'user' ? 'environment' : 'user');
        
        // Toggle the facing mode
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Restart camera with new facing mode
        startCamera(currentFacingMode);
    }
    
    // Separate handler for touch events to prevent conflicts
    function handleCameraTouchEnd(e) {
        e.preventDefault(); // Prevent zoom/scroll on touch devices
        capturePhoto();
    }
    
    // Enhanced stop camera function
    function stopCamera() {
        if (stream) {
            try {
                // Properly stop all tracks
                stream.getTracks().forEach(track => {
                    try {
                        track.stop();
                    } catch (e) {
                        console.error('Error stopping track:', e);
                    }
                });
            } catch (e) {
                console.error('Error stopping stream:', e);
            }
            
            stream = null;
            
            try {
                cameraPreview.srcObject = null;
                cameraPreview.style.display = 'none';
                cameraContainer.style.display = 'none';
            } catch (e) {
                console.error('Error clearing video element:', e);
            }
            
            // Restore original button behavior
            takePhotoBtn.textContent = 'Take Photo';
            takePhotoBtn.removeEventListener('click', capturePhoto);
            takePhotoBtn.addEventListener('click', startCamera);
            
            // Restore original event listeners
            uploadArea.addEventListener('click', () => fileInput.click());
            takePhotoBtn.removeEventListener('click', capturePhoto);
            takePhotoBtn.addEventListener('click', startCamera);
        }
    }
    
    // Fix the camera capture issue by ensuring the function exists and is properly connected
    function capturePhoto() {
        if (!stream) {
            console.log('Cannot capture photo: no active camera stream');
            return;
        }
        
        console.log('Capturing photo...');
        
        try {
            // Create a canvas to capture the frame
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Ensure we have proper dimensions
            if (cameraPreview.videoWidth === 0 || cameraPreview.videoHeight === 0) {
                console.log('Video dimensions not available, retrying in 100ms...');
                setTimeout(capturePhoto, 100);
                return;
            }
            
            // Log dimensions for debugging
            console.log("Capturing photo with dimensions:", 
                        cameraPreview.videoWidth, "x", cameraPreview.videoHeight);
            
            // Set canvas dimensions to match video
            canvas.width = cameraPreview.videoWidth;
            canvas.height = cameraPreview.videoHeight;
            
            // Draw the current frame to canvas
            context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
            
            // Show immediate visual feedback that photo was taken
            // This helps users know something happened
            const flashEffect = document.createElement('div');
            flashEffect.style.position = 'absolute';
            flashEffect.style.top = '0';
            flashEffect.style.left = '0';
            flashEffect.style.right = '0';
            flashEffect.style.bottom = '0';
            flashEffect.style.backgroundColor = 'white';
            flashEffect.style.opacity = '0.8';
            flashEffect.style.zIndex = '100';
            flashEffect.style.animation = 'flash 0.5s';
            
            // Add flash animation
            const style = document.createElement('style');
            style.textContent = `
            @keyframes flash {
                0% { opacity: 0.8; }
                100% { opacity: 0; }
            }`;
            document.head.appendChild(style);
            
            // Add flash effect to camera container
            cameraContainer.appendChild(flashEffect);
            
            // Remove flash effect after animation
            setTimeout(() => {
                cameraContainer.removeChild(flashEffect);
            }, 500);
            
            // Convert canvas to blob with proper error handling
            try {
                canvas.toBlob(
                    blob => {
                        if (!blob) {
                            console.error('Failed to create blob from canvas');
                            fallbackCapturePhoto(canvas);
                            return;
                        }
                        
                        console.log("Photo captured successfully, blob size:", blob.size);
                        
                        // First stop the camera to prevent further captures
                        stopCamera();
                        
                        // Then handle the captured image
                        handleImageUpload(blob);
                    }, 
                    'image/jpeg', 
                    0.85 // Higher quality for better results
                );
            } catch (blobError) {
                console.error('Error in canvas.toBlob:', blobError);
                fallbackCapturePhoto(canvas);
            }
        } catch (error) {
            console.error('Error capturing photo:', error);
            alert('Error capturing photo. Please try again or use the upload option.');
        }
    }
    
    // Fallback method for capturing photos when toBlob fails
    function fallbackCapturePhoto(canvas) {
        try {
            // Use canvas.toDataURL as fallback
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            // Convert data URL to blob
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                    stopCamera();
                    handleImageUpload(blob);
                })
                .catch(error => {
                    console.error('Error in fallback photo capture:', error);
                    alert('Could not capture photo. Please try uploading instead.');
                    stopCamera();
                });
        } catch (error) {
            console.error('Error in fallback capture method:', error);
            alert('Could not capture photo. Please try uploading instead.');
            stopCamera();
        }
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
        
        const platform = detectPlatform();
        
        if (platform.isIOS || platform.isSafari) {
            // Safari/iOS approach - open in new tab with guidance
            const newTab = window.open(currentImageUrl, '_blank');
            
            // Show platform-specific instructions
            if (platform.isIOS) {
                alert('To save to your device: tap and hold the image, then select "Add to Photos"');
            } else if (platform.isSafari) {
                alert('To save the image: right-click (or control-click) on the image and select "Save Image As"');
            }
            
            // Fallback if popup was blocked
            if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
                alert('Your browser blocked the popup. Please long-press on this button and select "Open in New Tab"');
            }
        } else {
            // Standard download approach for other browsers
            fetch(currentImageUrl)
                .then(response => response.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `anime-photo-${Date.now()}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    
                    // Clean up
                    setTimeout(() => {
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                    }, 100);
                })
                .catch(error => {
                    console.error('Error downloading image:', error);
                    // Fallback for download errors
                    window.open(currentImageUrl, '_blank');
                });
        }
    }
    
    function shareImage() {
        if (!currentImageUrl) return;
        
        const platform = detectPlatform();
        
        // Check if Web Share API is available
        if (navigator.share) {
            fetch(currentImageUrl)
                .then(response => response.blob())
                .then(blob => {
                    const file = new File([blob], `anime-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    
                    // Try with file sharing first (works on mobile)
                    const shareData = {
                        title: 'My Anime Photo',
                        text: 'Check out my anime-style photo!',
                    };
                    
                    // Add files only if browser supports file sharing
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        shareData.files = [file];
                    }
                    
                    navigator.share(shareData)
                        .catch(error => {
                            console.error('Error sharing image:', error);
                            
                            // Fallback if file sharing fails
                            if (error.name === 'NotAllowedError' && shareData.files) {
                                delete shareData.files;
                                // Try again without the file
                                shareData.url = window.location.origin + '/shared-image?' + Date.now();
                                navigator.share(shareData)
                                    .catch(err => {
                                        alert('Could not share the image. Try saving it first.');
                                    });
                            } else {
                                alert('Could not share the image. Try saving it first.');
                            }
                        });
                });
        } else {
            // Fallback for browsers without Web Share API
            if (platform.isMobile) {
                alert('Sharing is not supported on your browser. Please save the image and share it manually.');
                saveToDevice();
            } else {
                // On desktop, offer to copy the image or save it
                const shouldSave = confirm('Your browser doesn\'t support direct sharing. Would you like to save the image instead?');
                if (shouldSave) {
                    saveToDevice();
                }
            }
        }
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
    
    // Add client-side telemetry for Azure Static Web Apps
    function logEvent(eventName, properties = {}) {
        if (navigator.sendBeacon) {
            try {
                const data = JSON.stringify({
                    name: eventName,
                    properties: {
                        ...properties,
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString()
                    }
                });
                navigator.sendBeacon('/api/log-event', data);
            } catch (e) {
                console.error('Error logging event:', e);
            }
        }
    }
    
    // Monitor for visibility changes to handle tab/app switching properly
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && stream) {
            // User switched away from the app, pause camera for privacy/performance
            console.log('Page hidden, pausing camera to conserve resources');
            // Don't stop the camera completely, just pause video tracks
            stream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
        } else if (!document.hidden && stream) {
            // User returned to the app, resume camera
            console.log('Page visible again, resuming camera');
            stream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
        }
    });
    
    // Detect low memory conditions which could affect camera performance
    if ('memory' in performance) {
        setInterval(() => {
            const memory = performance.memory;
            if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8 && stream) {
                console.warn('High memory usage detected, releasing resources');
                stopCamera();
                alert('Memory usage is high. Camera has been stopped to improve performance.');
            }
        }, 30000); // Check every 30 seconds
    }
    
    // Add graceful recovery for camera errors
    window.addEventListener('online', function() {
        // If connection was restored and camera had previously failed
        if (document.querySelector('.camera-error') && !stream) {
            console.log('Network connection restored, retrying camera');
            startCamera();
        }
    });
    
    // Handle device orientation changes for optimal camera view
    window.addEventListener('orientationchange', function() {
        if (stream) {
            // Give time for the orientation to complete
            setTimeout(() => {
                console.log('Orientation changed, optimizing camera view');
                
                // Get current track settings
                const videoTrack = stream.getVideoTracks()[0];
                const settings = videoTrack.getSettings();
                
                // Check if we need to adjust constraints based on new orientation
                if ((window.innerWidth > window.innerHeight && settings.width < settings.height) ||
                    (window.innerWidth < window.innerHeight && settings.width > settings.height)) {
                    
                    // Only restart camera if needed for better orientation
                    console.log('Restarting camera with optimized orientation');
                    startCamera(currentFacingMode);
                }
            }, 300);
        }
    });
});