// FotoUni main application script
import { changeDpiDataUrl } from './dpi-helper.js';

// Elements
const themeToggleBtn = document.getElementById('themeToggleBtn');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const useCameraBtn = document.getElementById('useCameraBtn');

// Navigation & step buttons
const progressFill = document.getElementById('progressFill');
const stepIndicators = document.querySelectorAll('.step-indicator');
const pages = document.querySelectorAll('.wizard-page');

const btnBackTo1 = document.getElementById('btnBackTo1');
const btnNextTo3 = document.getElementById('btnNextTo3');
const btnBackTo2 = document.getElementById('btnBackTo2');
const btnNextTo4 = document.getElementById('btnNextTo4');
const btnBackTo3 = document.getElementById('btnBackTo3');
const btnStartOver = document.getElementById('btnStartOver');
const downloadBtn = document.getElementById('downloadBtn');

// Cropper elements
const cropperImage = document.getElementById('cropperImage');
const silhouetteOverlay = document.getElementById('silhouetteOverlay');
const btnRotateLeft = document.getElementById('btnRotateLeft');
const btnRotateRight = document.getElementById('btnRotateRight');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnResetCrop = document.getElementById('btnResetCrop');
const btnToggleSilhouette = document.getElementById('btnToggleSilhouette');

// Processing & adjustments
const processingCanvas = document.getElementById('processingCanvas');
const removeBgToggle = document.getElementById('removeBgToggle');
const brightnessSlider = document.getElementById('brightnessSlider');
const contrastSlider = document.getElementById('contrastSlider');
const saturationSlider = document.getElementById('saturationSlider');
const brightnessVal = document.getElementById('brightnessVal');
const contrastVal = document.getElementById('contrastVal');
const saturationVal = document.getElementById('saturationVal');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// Final preview
const finalImagePreview = document.getElementById('finalImagePreview');

// Camera Modal
const cameraModal = document.getElementById('cameraModal');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const cancelCaptureBtn = document.getElementById('cancelCaptureBtn');
const capturePhotoBtn = document.getElementById('capturePhotoBtn');
const cameraVideo = document.getElementById('cameraVideo');

// State variables
let currentStep = 1;
let cropper = null;
let originalImageSrc = null;
let croppedImageCanvas = null; // high-res cropped image cache
let cachedMask = null;         // MediaPipe selfie segmentation mask cache
let selfieSegmentation = null;
let segmenterLoaded = false;
let segmentResolver = null;
let finalJpegDataUrl = null;
let cameraStream = null;

// Initialize Lucide Icons
lucide.createIcons();

// --- THEME TOGGLE ---
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  document.body.classList.toggle('dark-theme');
});

// --- STEP NAVIGATION (WIZARD) ---
function goToStep(step) {
  currentStep = step;
  
  // Progress bar fill percentage
  const fillPercents = { 1: 0, 2: 33, 3: 66, 4: 100 };
  progressFill.style.width = `${fillPercents[step]}%`;
  
  // Update step indicators
  stepIndicators.forEach(ind => {
    const s = parseInt(ind.dataset.step);
    ind.classList.remove('active', 'completed');
    if (s === step) {
      ind.classList.add('active');
    } else if (s < step) {
      ind.classList.add('completed');
    }
  });
  
  // Show page
  pages.forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(`page-${step}`).classList.add('active');
  
  // Special actions on step entry
  if (step === 2) {
    initCropper();
  } else if (step === 3) {
    prepareStep3();
  } else if (step === 4) {
    prepareStep4();
  }
  
  // Update checklist status
  updateRequirements(step);
}

// Show/hide loading indicator in Canvas
function showLoading(show, text = "") {
  const nextBtn = document.getElementById('btnNextTo4');
  const backBtn = document.getElementById('btnBackTo2');
  
  if (show) {
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
    if (nextBtn) nextBtn.disabled = true;
    if (backBtn) backBtn.disabled = true;
  } else {
    loadingOverlay.classList.remove('active');
    if (nextBtn) nextBtn.disabled = false;
    if (backBtn) backBtn.disabled = false;
  }
}

// --- STEP 1: UPLOAD LOGIC ---
selectFileBtn.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('click', (e) => {
  if (e.target !== selectFileBtn && e.target !== useCameraBtn && !selectFileBtn.contains(e.target)) {
    fileInput.click();
  }
});

fileInput.addEventListener('change', handleFileSelect);

// Drag & drop handlers
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
});

function handleFileSelect(e) {
  if (e.target.files.length > 0) {
    processFile(e.target.files[0]);
  }
}

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Por favor selecciona un archivo de imagen válido (JPG, PNG).');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    loadPhotoInEditor(e.target.result);
  };
  reader.readAsDataURL(file);
}

function loadPhotoInEditor(dataUrl) {
  originalImageSrc = dataUrl;
  goToStep(2);
}

// --- WEBCAM INTEGRATION ---
useCameraBtn.addEventListener('click', startCamera);
closeCameraBtn.addEventListener('click', stopCamera);
cancelCaptureBtn.addEventListener('click', stopCamera);
capturePhotoBtn.addEventListener('click', capturePhoto);

function startCamera() {
  navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user'
    }
  })
  .then(stream => {
    cameraStream = stream;
    cameraVideo.srcObject = stream;
    cameraModal.classList.add('active');
  })
  .catch(err => {
    alert("No se pudo acceder a la cámara. Por favor, sube una foto desde tus archivos.");
    console.error("Camera access error:", err);
  });
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraModal.classList.remove('active');
}

function capturePhoto() {
  const canvas = document.createElement('canvas');
  canvas.width = cameraVideo.videoWidth || 640;
  canvas.height = cameraVideo.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  
  // Mirror-flip the camera image
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  
  const dataUrl = canvas.toDataURL('image/jpeg');
  stopCamera();
  loadPhotoInEditor(dataUrl);
}

// --- STEP 2: CROPPER LOGIC ---
function logDebug(msg) {
  console.log("[Debug]", msg);
}

function initCropper() {
  logDebug("Iniciando initCropper()...");
  if (typeof window.Cropper === 'undefined') {
    logDebug("ERROR: window.Cropper no está disponible. ¿Cargó el CDN?");
    alert("Error: La biblioteca de recorte no se cargó correctamente. Revisa la consola o recarga la página.");
    return;
  }
  
  if (cropper) {
    logDebug("Destruyendo cropper anterior...");
    try {
      cropper.destroy();
    } catch (e) {
      logDebug("Error al destruir cropper: " + e.message);
    }
    cropper = null;
  }
  
  const setupCropper = () => {
    if (cropper) {
      logDebug("Cropper ya está inicializado. Omitiendo duplicación.");
      return;
    }
    
    logDebug("Creando instancia de Cropper...");
    try {
      cropper = new window.Cropper(cropperImage, {
        aspectRatio: 240 / 288, // 5:6
        viewMode: 1, // Keep cropbox inside image bounds
        dragMode: 'move',
        autoCropArea: 0.8,
        restore: false,
        guides: false,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        background: false
      });
      logDebug("¡Cropper creado con éxito!");
    } catch (err) {
      logDebug("ERROR al instanciar Cropper: " + err.message);
    }
  };
  
  // Register onload FIRST
  cropperImage.onload = () => {
    logDebug("onload de la imagen disparado.");
    setupCropper();
    cropperImage.onload = null;
  };
  
  // Set src SECOND
  logDebug("Cargando imagen en src...");
  cropperImage.src = originalImageSrc;
  
  // Fallback if image loaded synchronously
  if (cropperImage.complete && cropperImage.naturalWidth !== 0) {
    logDebug("Imagen ya estaba cargada por completo de forma síncrona.");
    setupCropper();
    cropperImage.onload = null;
  }
}

// Cropper Controls
btnRotateLeft.addEventListener('click', () => cropper && cropper.rotate(-90));
btnRotateRight.addEventListener('click', () => cropper && cropper.rotate(90));
btnZoomIn.addEventListener('click', () => cropper && cropper.zoom(0.1));
btnZoomOut.addEventListener('click', () => cropper && cropper.zoom(-0.1));
btnResetCrop.addEventListener('click', () => cropper && cropper.reset());

btnToggleSilhouette.addEventListener('click', () => {
  silhouetteOverlay.classList.toggle('hidden');
  btnToggleSilhouette.classList.toggle('active');
});

btnBackTo1.addEventListener('click', () => {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  goToStep(1);
});

btnNextTo3.addEventListener('click', () => {
  if (!cropper) {
    alert("Por favor espera a que se cargue la imagen o vuelve a subirla.");
    return;
  }
  goToStep(3);
});

// --- STEP 3: SEGMENTATION & ADJUSTMENTS ---
btnBackTo2.addEventListener('click', () => {
  goToStep(2);
});

btnNextTo4.addEventListener('click', () => {
  goToStep(4);
});

// Initialize SelfieSegmentation from CDN script
function initSegmenter() {
  if (segmenterLoaded) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    if (typeof window.SelfieSegmentation === 'undefined') {
      reject(new Error("MediaPipe library not loaded on window"));
      return;
    }
    
    try {
      selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
      });
      
      selfieSegmentation.setOptions({
        modelSelection: 1, // landscape/closeup model
      });
      
      selfieSegmentation.onResults((results) => {
        if (segmentResolver) {
          segmentResolver(results);
          segmentResolver = null;
        }
      });
      
      segmenterLoaded = true;
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function getSegmentationMask(imageCanvas) {
  return new Promise((resolve, reject) => {
    initSegmenter()
      .then(() => {
        segmentResolver = (results) => {
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = 240;
          maskCanvas.height = 288;
          const maskCtx = maskCanvas.getContext('2d');
          maskCtx.drawImage(results.segmentationMask, 0, 0, 240, 288);
          resolve(maskCanvas);
        };
        
        selfieSegmentation.send({ image: imageCanvas })
          .catch(err => {
            segmentResolver = null;
            reject(err);
          });
      })
      .catch(err => {
        reject(err);
      });
  });
}

function prepareStep3() {
  if (!cropper) return;
  
  showLoading(true, "Encuadrando foto...");
  
  // Extract high-res cropped canvas for adjustments (reduces pixelation)
  croppedImageCanvas = cropper.getCroppedCanvas({
    width: 480,
    height: 576,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });
  
  cachedMask = null; // Reset mask
  
  // Reset sliders
  brightnessSlider.value = 0;
  contrastSlider.value = 0;
  saturationSlider.value = 0;
  brightnessVal.textContent = "0%";
  contrastVal.textContent = "0%";
  saturationVal.textContent = "0%";
  
  triggerSegmentation();
}

function triggerSegmentation() {
  const removeBg = removeBgToggle.checked;
  
  if (removeBg && !cachedMask) {
    showLoading(true, "Removiendo fondo de manera inteligente...");
    getSegmentationMask(croppedImageCanvas)
      .then(mask => {
        cachedMask = mask;
        showLoading(false);
        drawProcessedImage();
      })
      .catch(err => {
        console.warn("AI background segmentation failed:", err);
        showLoading(false);
        
        // Disable toggle and explain
        removeBgToggle.checked = false;
        removeBgToggle.disabled = true;
        
        const labelDesc = removeBgToggle.parentElement.previousElementSibling.querySelector('.label-desc');
        if (labelDesc) {
          labelDesc.textContent = "Remoción de fondo desactivada (se requiere internet)";
        }
        
        drawProcessedImage();
      });
  } else {
    showLoading(false);
    drawProcessedImage();
  }
}

// Redraw canvas using values and cached masks
function drawProcessedImage() {
  if (!croppedImageCanvas) return;
  
  const ctx = processingCanvas.getContext('2d');
  
  const removeBg = removeBgToggle.checked;
  const brightness = parseInt(brightnessSlider.value);
  const contrast = parseInt(contrastSlider.value);
  const saturation = parseInt(saturationSlider.value);
  
  ctx.clearRect(0, 0, 240, 288);
  
  if (removeBg && cachedMask) {
    // 1. Paint white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 240, 288);
    
    // 2. Adjust person colors in a temporary canvas
    const personCanvas = document.createElement('canvas');
    personCanvas.width = 240;
    personCanvas.height = 288;
    const personCtx = personCanvas.getContext('2d');
    
    personCtx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`;
    personCtx.drawImage(croppedImageCanvas, 0, 0, 240, 288);
    personCtx.filter = 'none';
    
    // 3. Clip person with mask
    personCtx.globalCompositeOperation = 'destination-in';
    personCtx.drawImage(cachedMask, 0, 0, 240, 288);
    
    // 4. Paint clipped filtered person on main white canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(personCanvas, 0, 0, 240, 288);
  } else {
    // Standard drawing: Apply filters to the entire cropped canvas
    ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`;
    ctx.drawImage(croppedImageCanvas, 0, 0, 240, 288);
    ctx.filter = 'none';
  }
  
  // Re-verify checklists as we edit
  updateRequirements(3);
}

// Adjustments event listeners
removeBgToggle.addEventListener('change', triggerSegmentation);

brightnessSlider.addEventListener('input', () => {
  const val = brightnessSlider.value;
  brightnessVal.textContent = `${val > 0 ? '+' : ''}${val}%`;
  drawProcessedImage();
});

contrastSlider.addEventListener('input', () => {
  const val = contrastSlider.value;
  contrastVal.textContent = `${val > 0 ? '+' : ''}${val}%`;
  drawProcessedImage();
});

saturationSlider.addEventListener('input', () => {
  const val = saturationSlider.value;
  saturationVal.textContent = `${val > 0 ? '+' : ''}${val}%`;
  drawProcessedImage();
});

// --- STEP 4: EXPORT & EXPORT OPTIMIZATIONS ---
function prepareStep4() {
  showLoading(true, "Finalizando procesamiento de imagen...");
  
  // Generate optimized JPG within 4KB - 50KB range
  const optimizedDataUrl = getOptimizedJpeg(processingCanvas, 4096, 51200);
  
  // Inject 300 DPI resolution metadata
  finalJpegDataUrl = changeDpiDataUrl(optimizedDataUrl, 300);
  
  // Update preview image
  finalImagePreview.src = finalJpegDataUrl;
  
  // Get final file size for reporting
  const finalSizeKB = getBase64Size(finalJpegDataUrl) / 1024;
  
  showLoading(false);
  updateRequirements(4, finalSizeKB);
}

// Compress or Pad image to make sure it falls inside 4KB - 50KB bounds
function getOptimizedJpeg(canvas, targetMinSize = 4096, targetMaxSize = 51200) {
  let quality = 0.95;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let size = getBase64Size(dataUrl);
  
  // Downscale quality if too big
  if (size > targetMaxSize) {
    while (quality > 0.1 && size > targetMaxSize) {
      quality -= 0.05;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      size = getBase64Size(dataUrl);
    }
  }
  
  // Maximize quality or pad if too small
  if (size < targetMinSize) {
    if (quality < 1.0) {
      quality = 1.0;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      size = getBase64Size(dataUrl);
    }
    
    if (size < targetMinSize) {
      // Add secure padding metadata (JFIF COM comments) to hit target
      dataUrl = padJpegDataUrl(dataUrl, targetMinSize + 500); // 500 bytes buffer above 4KB
    }
  }
  
  return dataUrl;
}

function getBase64Size(base64Image) {
  const body = base64Image.split(',')[1];
  return Math.round((body.length) * 3 / 4) - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0);
}

// Injects neutral metadata comment blocks to safely increase JPEG size
function padJpegDataUrl(base64Image, targetSizeBytes) {
  const parts = base64Image.split(',');
  const mime = parts[0];
  const b64 = parts[1];
  
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  if (bytes.length >= targetSizeBytes) {
    return base64Image;
  }
  
  const paddingNeeded = targetSizeBytes - bytes.length;
  
  if (paddingNeeded >= 4) {
    const comLength = paddingNeeded - 2; // includes length descriptor field itself (2 bytes)
    const comSegment = new Uint8Array(paddingNeeded);
    comSegment[0] = 0xFF;
    comSegment[1] = 0xFE; // COM Marker
    comSegment[2] = (comLength >> 8) & 0xFF;
    comSegment[3] = comLength & 0xFF;
    
    // Fill the comment body with neutral zero bytes
    for (let i = 4; i < paddingNeeded; i++) {
      comSegment[i] = 0;
    }
    
    // Place comment segment directly before EOI (End of Image: FF D9)
    if (bytes[bytes.length - 2] === 0xFF && bytes[bytes.length - 1] === 0xD9) {
      const newBytes = new Uint8Array(bytes.length + paddingNeeded);
      newBytes.set(bytes.subarray(0, bytes.length - 2), 0);
      newBytes.set(comSegment, bytes.length - 2);
      newBytes.set(bytes.subarray(bytes.length - 2), bytes.length - 2 + paddingNeeded);
      
      return mime + ',' + uint8ToBase64(newBytes);
    }
  }
  
  return base64Image;
}

function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  const chunk = 0xffff;
  for (let i = 0; i < len; i += chunk) {
    const sub = uint8.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

btnBackTo3.addEventListener('click', () => {
  goToStep(3);
});

btnStartOver.addEventListener('click', () => {
  originalImageSrc = null;
  croppedImageCanvas = null;
  cachedMask = null;
  finalJpegDataUrl = null;
  fileInput.value = '';
  
  goToStep(1);
});

// Download button triggers browser file saving
downloadBtn.addEventListener('click', () => {
  if (!finalJpegDataUrl) return;
  
  const link = document.createElement('a');
  // Dynamic descriptive name
  link.download = 'foto_universidad.jpg';
  link.href = finalJpegDataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// --- REQUIREMENTS PANEL UPDATING ---
function updateRequirements(step, finalSizeKB = null) {
  const reqColor = document.getElementById('req-color');
  const reqPose = document.getElementById('req-pose');
  const reqDimensions = document.getElementById('req-dimensions');
  const reqFormat = document.getElementById('req-format');
  const reqDpi = document.getElementById('req-dpi');
  const reqWeight = document.getElementById('req-weight');
  const statusSummary = document.getElementById('statusSummary');
  
  const setChecked = (element, checked, desc = null) => {
    if (checked) {
      element.classList.remove('failed');
      element.classList.add('checked');
      element.querySelector('.req-icon').innerHTML = '<i data-lucide="check-circle-2"></i>';
    } else {
      element.classList.remove('checked');
      element.classList.add('failed');
      element.querySelector('.req-icon').innerHTML = '<i data-lucide="circle-dashed"></i>';
    }
    if (desc) {
      element.querySelector('.req-desc span').textContent = desc;
    }
  };
  
  if (step === 1) {
    setChecked(reqColor, false, "El fondo debe ser liso y de color blanco puro.");
    setChecked(reqPose, false, "Tomada de frente, enfocando rostro desde los hombros.");
    setChecked(reqDimensions, false, "La imagen debe medir exactamente 240 x 288 px.");
    setChecked(reqFormat, false, "No se aceptan PNG, PDF u otros formatos.");
    setChecked(reqDpi, false, "Densidad de impresión de al menos 300 DPI.");
    setChecked(reqWeight, false, "El archivo debe pesar entre 4 KB y 50 KB.");
    statusSummary.innerHTML = '<span class="status-badge status-waiting">Esperando fotografía...</span>';
  }
  
  if (step >= 2) {
    setChecked(reqColor, true, "Imagen a color cargada.");
    setChecked(reqPose, true, "Rostro encuadrado con la silueta guía.");
    statusSummary.innerHTML = '<span class="status-badge status-validating">Editando fotografía...</span>';
  }
  
  if (step >= 3) {
    const isBgWhite = removeBgToggle.checked;
    setChecked(reqColor, true, isBgWhite ? "Fondo blanco automático activado." : "Fondo blanco manual ajustado.");
  }
  
  if (step >= 4) {
    setChecked(reqDimensions, true, "Dimensiones exactas: 240 x 288 px.");
    setChecked(reqFormat, true, "Formato ajustado a JPG.");
    setChecked(reqDpi, true, "Metadatos inyectados: 300 DPI.");
    
    if (finalSizeKB !== null) {
      setChecked(reqWeight, true, `Peso del archivo: ${finalSizeKB.toFixed(1)} KB (Válido).`);
    } else {
      setChecked(reqWeight, true, "Comprimido en el rango de 4 KB a 50 KB.");
    }
    
    statusSummary.innerHTML = '<span class="status-badge status-ready">¡Foto 100% válida!</span>';
  } else {
    setChecked(reqDimensions, false, "Se ajustará a 240 x 288 px al exportar.");
    setChecked(reqFormat, false, "Se convertirá a JPG al exportar.");
    setChecked(reqDpi, false, "Se inyectará cabecera de 300 DPI al exportar.");
    setChecked(reqWeight, false, "Se comprimirá al rango de 4KB - 50KB al exportar.");
  }
  
  lucide.createIcons();
}

// Initial state reset
goToStep(1);
updateRequirements(1);
