import { ImageModalDetector, type DetectedImage } from './content/autoMode';
import { getAutoModeEnabled } from '@/lib/store/useAutoModeStore';

// Auto mode detector
let detector: ImageModalDetector | null = null;
let isProcessing = false;

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    // Listen for messages from background script
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CAPTURE_IMAGE' && message.imageUrl) {
        captureImageAsBase64(message.imageUrl)
          .then((dataUrl) => {
            sendResponse({ success: true, dataUrl });
          })
          .catch((error) => {
            console.error('Failed to capture image:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }

      if (message.type === 'AUTO_MODE_CHANGED') {
        handleAutoModeChange(message.enabled);
        sendResponse({ success: true });
        return false;
      }

      // Legacy handler - no longer showing inline panel, using popup window instead
      if (message.type === 'AUTO_TRYON_RESULT') {
        sendResponse({ success: true });
        return false;
      }
    });

    // Check initial auto mode state
    const autoModeEnabled = await getAutoModeEnabled();
    if (autoModeEnabled) {
      initializeAutoMode();
    }

    console.log('Virtual Try-On content script loaded');
  },
});

async function captureImageAsBase64(imageUrl: string): Promise<string> {
  // Try to find the image element on the page first
  const imgElements = document.querySelectorAll('img');
  for (const img of imgElements) {
    if (img.src === imageUrl || img.currentSrc === imageUrl) {
      // Found the image element, try to draw it to canvas
      try {
        const dataUrl = await imageElementToDataUrl(img);
        if (dataUrl) return dataUrl;
      } catch (e) {
        console.log('Canvas method failed, trying fetch');
      }
    }
  }

  // Fallback: fetch the image
  return fetchImageAsDataUrl(imageUrl);
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  try {
    // Try with CORS first
    let response = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });

    // If CORS fails, try without
    if (!response.ok) {
      response = await fetch(imageUrl, { credentials: 'include' });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    // Normalize format if needed
    const normalizedBlob = await normalizeImageFormat(blob);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (result && result.match(/^data:image\/[^;]+;base64,/)) {
          resolve(result);
        } else {
          reject(new Error('Invalid data URL format'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(normalizedBlob);
    });
  } catch (error) {
    throw new Error(`Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function normalizeImageFormat(blob: Blob): Promise<Blob> {
  // If it's already a standard format, return as-is
  if (['image/jpeg', 'image/png'].includes(blob.type)) {
    return blob;
  }

  // Convert to PNG using canvas
  try {
    const imageBitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;

    ctx.drawImage(imageBitmap, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((newBlob) => {
        resolve(newBlob || blob);
      }, 'image/png');
    });
  } catch (e) {
    console.error('Failed to normalize image format:', e);
    return blob;
  }
}

function imageElementToDataUrl(img: HTMLImageElement): Promise<string> {
  return new Promise((resolve, reject) => {
    // If the image isn't loaded yet, wait for it
    if (!img.complete) {
      img.onload = () => drawToCanvas(img, resolve, reject);
      img.onerror = () => reject(new Error('Image failed to load'));
    } else {
      drawToCanvas(img, resolve, reject);
    }
  });
}

function drawToCanvas(
  img: HTMLImageElement,
  resolve: (value: string) => void,
  reject: (error: Error) => void
) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    ctx.drawImage(img, 0, 0);

    // Try to get data URL - this will fail if image is cross-origin without CORS
    try {
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        resolve(dataUrl);
      } else {
        reject(new Error('Invalid canvas data URL'));
      }
    } catch (e) {
      reject(new Error('Canvas tainted by cross-origin data'));
    }
  } catch (e) {
    reject(new Error('Failed to draw image to canvas'));
  }
}

// ==================== Auto Mode Functions ====================

function initializeAutoMode(): void {
  if (detector) return;

  detector = new ImageModalDetector(handleEnlargedImageDetected);
  detector.enable();
  console.log('[AutoMode] Initialized');
}

function handleAutoModeChange(enabled: boolean): void {
  if (enabled) {
    initializeAutoMode();
  } else {
    if (detector) {
      detector.disable();
      detector = null;
    }
    isProcessing = false;
    console.log('[AutoMode] Disabled');
  }
}

async function handleEnlargedImageDetected(image: DetectedImage): Promise<void> {
  // Prevent multiple simultaneous processing
  if (isProcessing) {
    console.log('[AutoMode] Already processing, skipping');
    return;
  }

  isProcessing = true;
  console.log('[AutoMode] Enlarged image detected:', image.source, 'Size:', image.width, 'x', image.height);

  try {
    // Validate the data URL format before sending
    if (!image.dataUrl || !image.dataUrl.match(/^data:image\/[^;]+;base64,/)) {
      console.error('[AutoMode] Invalid data URL format');
      isProcessing = false;
      return;
    }

    // Send to background script for processing
    // The background script will handle showing the popup window
    const response = await browser.runtime.sendMessage({
      type: 'AUTO_TRYON',
      clothingImage: image.dataUrl,
    });

    if (!response.success) {
      console.error('[AutoMode] Try-on failed:', response.error);
    } else {
      console.log('[AutoMode] Try-on successful');
    }
  } catch (error) {
    console.error('[AutoMode] Error sending to background:', error);
  } finally {
    // Add a small delay before allowing next processing
    setTimeout(() => {
      isProcessing = false;
    }, 1000);
  }
}
