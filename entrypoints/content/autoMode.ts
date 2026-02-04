export interface DetectedImage {
  dataUrl: string;
  width: number;
  height: number;
  source: 'modal' | 'direct';
}

export type OnImageDetectedCallback = (image: DetectedImage) => void;

interface ClickedImageInfo {
  src: string;
  width: number;
  height: number;
  rect: DOMRect;
}

export class ImageModalDetector {
  private onImageDetected: OnImageDetectedCallback;
  private isEnabled = false;
  private isProcessing = false;
  private lastCapturedSrc: string | null = null;
  private lastCaptureTime = 0;

  // Configuration
  private readonly MODAL_DETECTION_DELAY_MS = 800; // Wait for modal to open
  private readonly MIN_IMAGE_SIZE = 150;
  private readonly CAPTURE_COOLDOWN_MS = 3000; // Prevent rapid re-captures

  constructor(callback: OnImageDetectedCallback) {
    this.onImageDetected = callback;
    this.handleClick = this.handleClick.bind(this);
  }

  enable(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    document.addEventListener('click', this.handleClick, true);
    console.log('[AutoMode] Enabled - click on product images to try on');
  }

  disable(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    document.removeEventListener('click', this.handleClick, true);
    this.isProcessing = false;
    console.log('[AutoMode] Disabled');
  }

  private handleClick(event: MouseEvent): void {
    if (this.isProcessing) return;

    // Find the clicked image
    const clickedImage = this.findClickedImage(event.target as HTMLElement);
    if (!clickedImage) return;

    // Check cooldown to prevent rapid captures
    const now = Date.now();
    if (now - this.lastCaptureTime < this.CAPTURE_COOLDOWN_MS) {
      console.log('[AutoMode] Cooldown active, skipping');
      return;
    }

    console.log('[AutoMode] Image clicked:', {
      src: clickedImage.src.substring(0, 80),
      size: `${clickedImage.width}x${clickedImage.height}`,
    });

    this.isProcessing = true;

    // Wait for modal to potentially open, then find the best image
    setTimeout(async () => {
      try {
        await this.findAndCaptureModalImage(clickedImage);
      } finally {
        this.isProcessing = false;
      }
    }, this.MODAL_DETECTION_DELAY_MS);
  }

  private findClickedImage(target: HTMLElement): ClickedImageInfo | null {
    // Direct click on <img>
    if (target instanceof HTMLImageElement && target.src) {
      return this.getImageInfo(target);
    }

    // Click on element containing image
    const img = target.querySelector('img');
    if (img?.src) {
      return this.getImageInfo(img);
    }

    // Click on parent that might contain the image
    const parent = target.closest('[class*="image"], [class*="product"], [class*="photo"], [class*="media"]');
    if (parent) {
      const parentImg = parent.querySelector('img');
      if (parentImg?.src) {
        return this.getImageInfo(parentImg);
      }
    }

    return null;
  }

  private getImageInfo(img: HTMLImageElement): ClickedImageInfo | null {
    const width = img.naturalWidth || img.offsetWidth;
    const height = img.naturalHeight || img.offsetHeight;

    // Skip tiny images (icons, etc.)
    if (width < this.MIN_IMAGE_SIZE || height < this.MIN_IMAGE_SIZE) {
      return null;
    }

    return {
      src: img.currentSrc || img.src,
      width,
      height,
      rect: img.getBoundingClientRect(),
    };
  }

  private async findAndCaptureModalImage(clickedImage: ClickedImageInfo): Promise<void> {
    // Strategy 1: Look for a modal/overlay with an image
    const modalImage = this.findImageInModal();
    if (modalImage) {
      console.log('[AutoMode] Found image in modal');
      await this.captureImage(modalImage, 'modal');
      return;
    }

    // Strategy 2: Find the largest visible image that's bigger than clicked
    const largestImage = this.findLargestVisibleImage(clickedImage);
    if (largestImage) {
      console.log('[AutoMode] Found larger visible image');
      await this.captureImage(largestImage, 'modal');
      return;
    }

    // Strategy 3: Fallback to the clicked image itself
    console.log('[AutoMode] Using clicked image directly');
    const clickedElement = this.findImageBySrc(clickedImage.src);
    if (clickedElement) {
      await this.captureImage(clickedElement, 'direct');
    }
  }

  private findImageInModal(): HTMLImageElement | null {
    // Find overlay/modal containers
    const allElements = document.querySelectorAll('*');
    let bestModalImage: HTMLImageElement | null = null;
    let bestModalImageSize = 0;

    for (const element of allElements) {
      if (!(element instanceof HTMLElement)) continue;

      const style = window.getComputedStyle(element);
      const position = style.position;
      const zIndex = parseInt(style.zIndex) || 0;

      // Look for fixed/absolute positioned elements with high z-index (modal indicators)
      if ((position === 'fixed' || position === 'absolute') && zIndex > 100) {
        // Check if this element contains an image
        const imgs = element.querySelectorAll('img');
        for (const img of imgs) {
          if (!(img instanceof HTMLImageElement)) continue;
          if (!img.src || img.src.startsWith('data:image/svg')) continue;

          const width = img.naturalWidth || img.offsetWidth;
          const height = img.naturalHeight || img.offsetHeight;
          const size = width * height;

          // Must be reasonably sized
          if (width < this.MIN_IMAGE_SIZE || height < this.MIN_IMAGE_SIZE) continue;

          // Check if visible
          const rect = img.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          if (size > bestModalImageSize) {
            bestModalImageSize = size;
            bestModalImage = img;
          }
        }
      }
    }

    return bestModalImage;
  }

  private findLargestVisibleImage(clickedImage: ClickedImageInfo): HTMLImageElement | null {
    const clickedSize = clickedImage.width * clickedImage.height;
    let bestImage: HTMLImageElement | null = null;
    let bestSize = clickedSize;

    const imgs = document.querySelectorAll('img');
    for (const img of imgs) {
      if (!(img instanceof HTMLImageElement)) continue;
      if (!img.src || img.src.startsWith('data:image/svg')) continue;

      const width = img.naturalWidth || img.offsetWidth;
      const height = img.naturalHeight || img.offsetHeight;
      const size = width * height;

      // Must be bigger than clicked image
      if (size <= clickedSize) continue;

      // Must be reasonably sized
      if (width < this.MIN_IMAGE_SIZE || height < this.MIN_IMAGE_SIZE) continue;

      // Must be visible in viewport
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;

      if (size > bestSize) {
        bestSize = size;
        bestImage = img;
      }
    }

    return bestImage;
  }

  private findImageBySrc(src: string): HTMLImageElement | null {
    const imgs = document.querySelectorAll('img');
    for (const img of imgs) {
      if (img instanceof HTMLImageElement) {
        if (img.src === src || img.currentSrc === src) {
          return img;
        }
      }
    }
    return null;
  }

  private async captureImage(
    img: HTMLImageElement,
    source: 'modal' | 'direct'
  ): Promise<void> {
    const src = img.currentSrc || img.src;

    // Skip if same as last capture (prevents duplicates)
    if (src === this.lastCapturedSrc && Date.now() - this.lastCaptureTime < this.CAPTURE_COOLDOWN_MS) {
      console.log('[AutoMode] Same image, skipping duplicate capture');
      return;
    }

    try {
      const dataUrl = await this.imageToDataUrl(img);
      if (!dataUrl) {
        console.error('[AutoMode] Failed to convert image to data URL');
        return;
      }

      this.lastCapturedSrc = src;
      this.lastCaptureTime = Date.now();

      console.log('[AutoMode] Captured image:', {
        source,
        size: `${img.naturalWidth || img.offsetWidth}x${img.naturalHeight || img.offsetHeight}`,
      });

      this.onImageDetected({
        dataUrl,
        width: img.naturalWidth || img.offsetWidth,
        height: img.naturalHeight || img.offsetHeight,
        source,
      });
    } catch (error) {
      console.error('[AutoMode] Capture failed:', error);
    }
  }

  private async imageToDataUrl(img: HTMLImageElement): Promise<string | null> {
    // Method 1: Try canvas (works for same-origin or CORS-enabled images)
    try {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');

      if (dataUrl && dataUrl.length > 100 && dataUrl.startsWith('data:image/png;base64,')) {
        return dataUrl;
      }
    } catch (e) {
      console.log('[AutoMode] Canvas method failed, trying fetch');
    }

    // Method 2: Fetch the image directly
    try {
      const src = img.currentSrc || img.src;
      const response = await fetch(src, {
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }

      const blob = await response.blob();

      // Validate it's an image
      if (!blob.type.startsWith('image/')) {
        throw new Error('Not an image');
      }

      // Convert to PNG if needed (for consistency)
      const pngBlob = await this.convertToPng(blob);

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          if (result && result.startsWith('data:image/')) {
            resolve(result);
          } else {
            reject(new Error('Invalid data URL'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(pngBlob);
      });
    } catch (e) {
      console.error('[AutoMode] Fetch method failed:', e);
      return null;
    }
  }

  private async convertToPng(blob: Blob): Promise<Blob> {
    // If already PNG, return as-is
    if (blob.type === 'image/png') {
      return blob;
    }

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
    } catch {
      return blob;
    }
  }
}
