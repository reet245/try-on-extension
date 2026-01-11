import Dexie, { type Table } from 'dexie';

export interface UserPhoto {
  id?: number;
  name: string;
  blob: Blob;
  thumbnail: string; // Base64 for quick preview
  createdAt: Date;
  isDefault: boolean; // Primary photo for try-on
}

export interface ClothingImage {
  id?: number;
  name: string;
  blob: Blob;
  thumbnail: string;
  category?: 'top' | 'bottom' | 'dress' | 'outerwear' | 'other';
  createdAt: Date;
}

export interface TryOnResult {
  id?: number;
  userPhotoId: number;
  clothingImageId: number;
  resultBlob: Blob;
  resultThumbnail: string;
  prompt: string;
  createdAt: Date;
  isFavorite: boolean;
}

export interface ApiLog {
  id?: number;
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  model: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: string; // Full error stack or response details
  durationMs?: number;
}

class TryOnDatabase extends Dexie {
  userPhotos!: Table<UserPhoto>;
  clothingImages!: Table<ClothingImage>;
  tryOnResults!: Table<TryOnResult>;
  apiLogs!: Table<ApiLog>;

  constructor() {
    super('TryOnDB');
    this.version(1).stores({
      userPhotos: '++id, createdAt, isDefault',
      clothingImages: '++id, category, createdAt',
      tryOnResults: '++id, userPhotoId, clothingImageId, createdAt, isFavorite'
    });
    this.version(2).stores({
      userPhotos: '++id, createdAt, isDefault',
      clothingImages: '++id, category, createdAt',
      tryOnResults: '++id, userPhotoId, clothingImageId, createdAt, isFavorite',
      apiLogs: '++id, timestamp, type, status'
    });
  }
}

export const db = new TryOnDatabase();

// Helper functions
export async function saveUserPhoto(file: File, isDefault = false): Promise<number> {
  const thumbnail = await createThumbnail(file);
  const id = await db.userPhotos.add({
    name: file.name,
    blob: file,
    thumbnail,
    createdAt: new Date(),
    isDefault
  });
  return id as number;
}

export async function saveClothingImage(file: File, category?: ClothingImage['category']): Promise<number> {
  const thumbnail = await createThumbnail(file);
  const id = await db.clothingImages.add({
    name: file.name,
    blob: file,
    thumbnail,
    category,
    createdAt: new Date()
  });
  return id as number;
}

export async function saveTryOnResult(
  userPhotoId: number,
  clothingImageId: number,
  resultBlob: Blob,
  prompt: string
): Promise<number> {
  const resultThumbnail = await blobToBase64(resultBlob);
  const id = await db.tryOnResults.add({
    userPhotoId,
    clothingImageId,
    resultBlob,
    resultThumbnail,
    prompt,
    createdAt: new Date(),
    isFavorite: false
  });
  return id as number;
}

export async function getRecentResults(limit = 20): Promise<TryOnResult[]> {
  return db.tryOnResults
    .orderBy('createdAt')
    .reverse()
    .limit(limit)
    .toArray();
}

export async function toggleFavorite(id: number): Promise<void> {
  const result = await db.tryOnResults.get(id);
  if (result) {
    await db.tryOnResults.update(id, { isFavorite: !result.isFavorite });
  }
}

export async function deleteResult(id: number): Promise<void> {
  await db.tryOnResults.delete(id);
}

// Utility functions
async function createThumbnail(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export { blobToBase64, createThumbnail };

// API Logging functions
export async function addApiLog(log: Omit<ApiLog, 'id'>): Promise<number> {
  const id = await db.apiLogs.add(log);
  return id as number;
}

export async function getApiLogs(limit = 50): Promise<ApiLog[]> {
  return db.apiLogs
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

export async function clearApiLogs(): Promise<void> {
  await db.apiLogs.clear();
}

export async function getApiLogCount(): Promise<number> {
  return db.apiLogs.count();
}
