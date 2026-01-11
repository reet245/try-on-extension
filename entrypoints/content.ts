export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Listen for messages from background script to capture images
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
        // Return true to indicate we'll respond asynchronously
        return true;
      }
    });

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
  const response = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
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
      resolve(dataUrl);
    } catch (e) {
      reject(new Error('Canvas tainted by cross-origin data'));
    }
  } catch (e) {
    reject(new Error('Failed to draw image to canvas'));
  }
}
