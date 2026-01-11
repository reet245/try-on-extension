import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ModelType = 'nano-banana' | 'nano-banana-pro';

interface CapturedImage {
  dataUrl?: string; // Base64 data URL from content script
  url?: string; // Fallback: raw URL
  timestamp: number;
  sourceTab: string;
}

interface AppState {
  // Images (stored as base64 data URLs)
  userImage: string | null;
  clothingImage: string | null;
  clothingImageSource: 'upload' | 'captured' | null;

  // Settings
  apiKey: string | null;
  selectedModel: ModelType;
  theme: 'light' | 'dark' | 'system';

  // UI State
  isGenerating: boolean;
  error: string | null;

  // Actions
  setUserImage: (image: string | null) => void;
  setClothingImage: (image: string | null, source?: 'upload' | 'captured') => void;
  setApiKey: (key: string | null) => void;
  setSelectedModel: (model: ModelType) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  loadCapturedImage: () => Promise<void>;
  clearCapturedImage: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userImage: null,
      clothingImage: null,
      clothingImageSource: null,
      apiKey: null,
      selectedModel: 'nano-banana',
      theme: 'system',
      isGenerating: false,
      error: null,

      setUserImage: (image) => set({ userImage: image, error: null }),
      setClothingImage: (image, source = 'upload') => set({
        clothingImage: image,
        clothingImageSource: image ? source : null,
        error: null
      }),
      setApiKey: (key) => set({ apiKey: key }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setTheme: (theme) => set({ theme }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      setError: (error) => set({ error }),
      reset: () => set({ clothingImage: null, clothingImageSource: null, error: null }),

      // Load captured image from browser storage (set by context menu)
      loadCapturedImage: async () => {
        try {
          const result = await browser.storage.local.get('capturedClothingImage');
          const captured = result.capturedClothingImage as CapturedImage | undefined;

          if (!captured) return;

          // If we have a dataUrl (from content script), use it directly
          if (captured.dataUrl) {
            set({
              clothingImage: captured.dataUrl,
              clothingImageSource: 'captured',
              error: null
            });
            return;
          }

          // Fallback: try to fetch the URL
          if (captured.url) {
            try {
              const response = await fetch(captured.url);
              const blob = await response.blob();
              const reader = new FileReader();

              reader.onload = () => {
                const dataUrl = reader.result as string;
                set({
                  clothingImage: dataUrl,
                  clothingImageSource: 'captured',
                  error: null
                });
              };
              reader.onerror = () => {
                set({ error: 'Failed to load captured image. Try uploading manually.' });
              };
              reader.readAsDataURL(blob);
            } catch (fetchError) {
              console.error('Failed to fetch image:', fetchError);
              set({ error: 'Could not load image from website. Try uploading manually.' });
            }
          }
        } catch (error) {
          console.error('Failed to load captured image:', error);
        }
      },

      // Clear captured image from storage after use
      clearCapturedImage: async () => {
        try {
          await browser.storage.local.remove('capturedClothingImage');
        } catch (error) {
          console.error('Failed to clear captured image:', error);
        }
      },
    }),
    {
      name: 'try-on-storage',
      // Persist user image and settings
      partialize: (state) => ({
        userImage: state.userImage, // Now persisting user image!
        apiKey: state.apiKey,
        selectedModel: state.selectedModel,
        theme: state.theme,
      }),
    }
  )
);

// Helper to check if there's a pending captured image
export async function hasCapturedImage(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get('capturedClothingImage');
    return !!result.capturedClothingImage;
  } catch {
    return false;
  }
}
