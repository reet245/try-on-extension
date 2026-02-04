/**
 * R2 Cloud Storage Service
 *
 * Handles image uploads to Cloudflare R2 via the Worker API.
 * Falls back to local storage if R2 is not configured.
 */

const STORAGE_KEY = 'r2-config';

export interface R2Config {
  workerUrl: string;
  enabled: boolean;
}

export interface StoredImage {
  id: string;
  type: 'user' | 'clothing' | 'result';
  url: string; // R2 URL
  key: string; // R2 key for deletion
  localBackup?: string; // Base64 backup (optional, for offline)
  createdAt: number;
}

// Get R2 configuration from chrome.storage
export async function getR2Config(): Promise<R2Config | null> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || null;
  } catch {
    return null;
  }
}

// Save R2 configuration
export async function saveR2Config(config: R2Config): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: config });
}

// Check if R2 is configured and enabled
export async function isR2Enabled(): Promise<boolean> {
  const config = await getR2Config();
  return config?.enabled === true && !!config?.workerUrl;
}

// Upload image to R2
export async function uploadToR2(
  dataUrl: string,
  type: 'user' | 'clothing' | 'result'
): Promise<StoredImage | null> {
  const config = await getR2Config();

  if (!config?.enabled || !config?.workerUrl) {
    return null;
  }

  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Upload to R2 via Worker
    const uploadResponse = await fetch(`${config.workerUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
        'X-Image-Type': type,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    const storedImage: StoredImage = {
      id: result.key,
      type,
      url: result.url,
      key: result.key,
      createdAt: Date.now(),
    };

    // Save reference to chrome.storage
    await saveImageReference(storedImage);

    return storedImage;
  } catch (error) {
    console.error('R2 upload error:', error);
    return null;
  }
}

// Fetch image from R2 and return as base64 data URL
export async function fetchFromR2(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('R2 fetch error:', error);
    return null;
  }
}

// Delete image from R2
export async function deleteFromR2(key: string): Promise<boolean> {
  const config = await getR2Config();

  if (!config?.enabled || !config?.workerUrl) {
    return false;
  }

  try {
    const response = await fetch(`${config.workerUrl}/images/${key}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      // Remove from local references
      await removeImageReference(key);
      return true;
    }
    return false;
  } catch (error) {
    console.error('R2 delete error:', error);
    return false;
  }
}

// Store image references in chrome.storage
const IMAGE_REFS_KEY = 'r2-image-refs';

async function saveImageReference(image: StoredImage): Promise<void> {
  const refs = await getImageReferences();
  refs[image.key] = image;
  await browser.storage.local.set({ [IMAGE_REFS_KEY]: refs });
}

async function removeImageReference(key: string): Promise<void> {
  const refs = await getImageReferences();
  delete refs[key];
  await browser.storage.local.set({ [IMAGE_REFS_KEY]: refs });
}

export async function getImageReferences(): Promise<Record<string, StoredImage>> {
  try {
    const result = await browser.storage.local.get(IMAGE_REFS_KEY);
    return result[IMAGE_REFS_KEY] || {};
  } catch {
    return {};
  }
}

// Get user photo URL from storage (legacy - single photo)
export async function getUserPhotoUrl(): Promise<string | null> {
  try {
    const result = await browser.storage.local.get('userPhotoR2');
    return result.userPhotoR2?.url || null;
  } catch {
    return null;
  }
}

// Save user photo URL (legacy - single photo)
export async function saveUserPhotoUrl(storedImage: StoredImage): Promise<void> {
  await browser.storage.local.set({ userPhotoR2: storedImage });
  // Also add to the gallery
  await addToUserPhotoGallery(storedImage);
}

// Clear user photo from R2 and storage
export async function clearUserPhotoR2(): Promise<void> {
  try {
    const result = await browser.storage.local.get('userPhotoR2');
    if (result.userPhotoR2?.key) {
      await deleteFromR2(result.userPhotoR2.key);
      await removeFromUserPhotoGallery(result.userPhotoR2.key);
    }
    await browser.storage.local.remove('userPhotoR2');
  } catch (error) {
    console.error('Failed to clear user photo:', error);
  }
}

// ============ Multi-Photo Gallery Support ============

const USER_PHOTOS_KEY = 'userPhotosR2Gallery';

export interface GalleryPhoto {
  key: string;
  url: string;
  thumbnail?: string; // Small base64 preview
  createdAt: number;
  name?: string;
}

// Get all user photos from gallery
export async function getUserPhotoGallery(): Promise<GalleryPhoto[]> {
  try {
    const result = await browser.storage.local.get(USER_PHOTOS_KEY);
    return result[USER_PHOTOS_KEY] || [];
  } catch {
    return [];
  }
}

// Add photo to gallery
export async function addToUserPhotoGallery(storedImage: StoredImage, thumbnail?: string): Promise<void> {
  const gallery = await getUserPhotoGallery();

  // Check if already exists
  if (gallery.some(p => p.key === storedImage.key)) {
    return;
  }

  const photo: GalleryPhoto = {
    key: storedImage.key,
    url: storedImage.url,
    thumbnail,
    createdAt: storedImage.createdAt,
    name: `Photo ${gallery.length + 1}`,
  };

  gallery.unshift(photo); // Add to beginning
  await browser.storage.local.set({ [USER_PHOTOS_KEY]: gallery });
}

// Remove photo from gallery
export async function removeFromUserPhotoGallery(key: string): Promise<void> {
  const gallery = await getUserPhotoGallery();
  const filtered = gallery.filter(p => p.key !== key);
  await browser.storage.local.set({ [USER_PHOTOS_KEY]: filtered });
}

// Delete photo from R2 and gallery
export async function deletePhotoFromGallery(key: string): Promise<boolean> {
  try {
    await deleteFromR2(key);
    await removeFromUserPhotoGallery(key);
    return true;
  } catch (error) {
    console.error('Failed to delete photo:', error);
    return false;
  }
}

// Clear entire gallery
export async function clearUserPhotoGallery(): Promise<void> {
  const gallery = await getUserPhotoGallery();
  for (const photo of gallery) {
    try {
      await deleteFromR2(photo.key);
    } catch (e) {
      console.error('Failed to delete photo from R2:', e);
    }
  }
  await browser.storage.local.set({ [USER_PHOTOS_KEY]: [] });
}

// Test R2 connection
export async function testR2Connection(workerUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${workerUrl}/health`);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: data.status === 'ok' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

// List images from R2 by type
export async function listImagesFromR2(type: 'user' | 'clothing' | 'result'): Promise<{
  success: boolean;
  images: Array<{ key: string; url: string; size: number; uploaded: string }>;
  error?: string;
}> {
  const config = await getR2Config();

  if (!config?.enabled || !config?.workerUrl) {
    return { success: false, images: [], error: 'R2 not configured' };
  }

  try {
    const response = await fetch(`${config.workerUrl}/list/${type}`);

    if (!response.ok) {
      return { success: false, images: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, images: [], error: 'Failed to list images' };
    }

    return { success: true, images: data.images || [] };
  } catch (error) {
    return {
      success: false,
      images: [],
      error: error instanceof Error ? error.message : 'Failed to list images'
    };
  }
}

// Sync gallery from R2 - fetches list from server and updates local gallery
export async function syncGalleryFromR2(): Promise<{ synced: number; added: number; error?: string }> {
  const config = await getR2Config();

  if (!config?.enabled || !config?.workerUrl) {
    return { synced: 0, added: 0, error: 'R2 not configured' };
  }

  try {
    // Fetch list of user photos from R2
    const response = await fetch(`${config.workerUrl}/list/user`);

    if (!response.ok) {
      return { synced: 0, added: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.success || !data.images) {
      return { synced: 0, added: 0, error: 'Invalid response from server' };
    }

    // Get current local gallery
    const localGallery = await getUserPhotoGallery();
    const localKeysMap = new Map(localGallery.map(p => [p.key, p]));

    // Add any photos that exist in R2 but not locally
    // Fetch thumbnails one by one
    let added = 0;
    for (const image of data.images) {
      const existing = localKeysMap.get(image.key);
      if (!existing) {
        // New photo - fetch and create thumbnail
        const thumbnail = await createThumbnailFromUrl(image.url);

        const photo: GalleryPhoto = {
          key: image.key,
          url: image.url,
          thumbnail: thumbnail || undefined,
          createdAt: new Date(image.uploaded).getTime(),
          name: `Synced ${added + 1}`,
        };
        localGallery.push(photo);
        added++;
      } else if (!existing.thumbnail) {
        // Existing photo without thumbnail - fetch it
        const thumbnail = await createThumbnailFromUrl(image.url);
        if (thumbnail) {
          existing.thumbnail = thumbnail;
        }
      }
    }

    // Sort by date descending (newest first)
    localGallery.sort((a, b) => b.createdAt - a.createdAt);

    // Save updated gallery
    await browser.storage.local.set({ [USER_PHOTOS_KEY]: localGallery });

    return { synced: data.images.length, added };
  } catch (error) {
    return {
      synced: 0,
      added: 0,
      error: error instanceof Error ? error.message : 'Sync failed'
    };
  }
}

// ============ Result Gallery Support (for History sync) ============

const RESULTS_GALLERY_KEY = 'resultsR2Gallery';

export interface ResultGalleryItem {
  key: string;
  url: string;
  thumbnail?: string;
  createdAt: number;
}

// Get synced results from storage
export async function getResultsGallery(): Promise<ResultGalleryItem[]> {
  try {
    const result = await browser.storage.local.get(RESULTS_GALLERY_KEY);
    return result[RESULTS_GALLERY_KEY] || [];
  } catch {
    return [];
  }
}

// Add result to gallery (called when generating new results)
export async function addToResultsGallery(storedImage: StoredImage, thumbnail?: string): Promise<void> {
  const gallery = await getResultsGallery();

  if (gallery.some(r => r.key === storedImage.key)) {
    return;
  }

  const item: ResultGalleryItem = {
    key: storedImage.key,
    url: storedImage.url,
    thumbnail,
    createdAt: storedImage.createdAt,
  };

  gallery.unshift(item);
  await browser.storage.local.set({ [RESULTS_GALLERY_KEY]: gallery });
}

// Helper to create a thumbnail from an image URL
async function createThumbnailFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // Create a small thumbnail (150x200 for 3:4 aspect ratio)
    const canvas = new OffscreenCanvas(150, 200);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(imageBitmap, 0, 0, 150, 200);
    const thumbnailBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(thumbnailBlob);
    });
  } catch (error) {
    console.error('Failed to create thumbnail:', error);
    return null;
  }
}

// Sync results from R2 - fetches list and updates local results gallery
export async function syncResultsFromR2(): Promise<{ synced: number; added: number; error?: string }> {
  const config = await getR2Config();

  if (!config?.enabled || !config?.workerUrl) {
    return { synced: 0, added: 0, error: 'R2 not configured' };
  }

  try {
    const response = await fetch(`${config.workerUrl}/list/result`);

    if (!response.ok) {
      return { synced: 0, added: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.success || !data.images) {
      return { synced: 0, added: 0, error: 'Invalid response from server' };
    }

    // Get current local results gallery
    const localGallery = await getResultsGallery();
    const localKeysMap = new Map(localGallery.map(r => [r.key, r]));

    // Add any results that exist in R2 but not locally
    // Fetch thumbnails one by one
    let added = 0;
    for (const image of data.images) {
      const existing = localKeysMap.get(image.key);
      if (!existing) {
        // New image - fetch and create thumbnail
        const thumbnail = await createThumbnailFromUrl(image.url);

        const item: ResultGalleryItem = {
          key: image.key,
          url: image.url,
          thumbnail: thumbnail || undefined,
          createdAt: new Date(image.uploaded).getTime(),
        };
        localGallery.push(item);
        added++;
      } else if (!existing.thumbnail) {
        // Existing image without thumbnail - fetch it
        const thumbnail = await createThumbnailFromUrl(image.url);
        if (thumbnail) {
          existing.thumbnail = thumbnail;
        }
      }
    }

    // Sort by date descending (newest first)
    localGallery.sort((a, b) => b.createdAt - a.createdAt);

    // Save updated gallery
    await browser.storage.local.set({ [RESULTS_GALLERY_KEY]: localGallery });

    return { synced: data.images.length, added };
  } catch (error) {
    return {
      synced: 0,
      added: 0,
      error: error instanceof Error ? error.message : 'Sync failed'
    };
  }
}

// Delete result from R2 and gallery
export async function deleteResultFromGallery(key: string): Promise<boolean> {
  try {
    await deleteFromR2(key);
    const gallery = await getResultsGallery();
    const filtered = gallery.filter(r => r.key !== key);
    await browser.storage.local.set({ [RESULTS_GALLERY_KEY]: filtered });
    return true;
  } catch (error) {
    console.error('Failed to delete result:', error);
    return false;
  }
}
