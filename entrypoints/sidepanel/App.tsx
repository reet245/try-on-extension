import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ImageUploader';
import { ImagePreview } from '@/components/ImagePreview';
import { TryOnResult } from '@/components/TryOnResult';
import { LoadingState } from '@/components/LoadingState';
import { HistoryGallery } from '@/components/HistoryGallery';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useTryOn } from '@/hooks/useTryOn';
import { useAppStore } from '@/lib/store/useAppStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { Sparkles, History, Settings, Shirt, User, Globe, Upload, Cloud, Images } from 'lucide-react';
import {
  isR2Enabled,
  uploadToR2,
  getUserPhotoUrl,
  saveUserPhotoUrl,
  clearUserPhotoR2,
  getUserPhotoGallery,
  addToUserPhotoGallery,
  syncGalleryFromR2,
  fetchFromR2,
} from '@/lib/storage/r2Storage';
import { CloudPhotoGallery } from '@/components/CloudPhotoGallery';
import { saveUserPhoto, saveClothingImage, saveTryOnResult } from '@/lib/db';
import { parseDataUrl } from '@/lib/api/gemini';

export default function App() {
  const {
    userImage,
    clothingImage,
    clothingImageSource,
    setUserImage,
    setClothingImage,
    loadCapturedImage,
    clearCapturedImage,
    apiKey,
    isGenerating,
    error,
  } = useAppStore();

  const { result, generate, regenerate, clearResult } = useTryOn();
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);
  const [isCloudBacked, setIsCloudBacked] = useState(false);
  const [cloudPhotoCount, setCloudPhotoCount] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [r2Enabled, setR2Enabled] = useState(false);

  // Check for captured images when sidepanel opens
  useEffect(() => {
    loadCapturedImage().then(() => {
      // Clear from storage after loading so it doesn't persist
      clearCapturedImage();
    });
  }, []);

  // Check R2 status, sync cloud photos, and auto-select the latest one
  useEffect(() => {
    const checkCloudStatus = async () => {
      const enabled = await isR2Enabled();
      setR2Enabled(enabled);

      if (enabled) {
        let gallery = await getUserPhotoGallery();

        // Auto-sync from R2 if local gallery is empty (might have photos on server)
        if (gallery.length === 0) {
          const syncResult = await syncGalleryFromR2();
          if (!syncResult.error && syncResult.added > 0) {
            gallery = await getUserPhotoGallery();
          }
        }

        setCloudPhotoCount(gallery.length);

        // Auto-select the latest cloud photo (gallery is sorted newest first)
        if (gallery.length > 0) {
          const latestPhoto = gallery[0];
          // Fetch the full image from R2
          const imageDataUrl = await fetchFromR2(latestPhoto.url);
          if (imageDataUrl) {
            setUserImage(imageDataUrl);
            setIsCloudBacked(true);
          }
        }
      }
    };
    checkCloudStatus();
  }, []);

  const { loadResults } = useHistoryStore();

  // Process pending auto mode results (from background script)
  useEffect(() => {
    const processPendingResults = async () => {
      try {
        const result = await browser.storage.local.get('pendingAutoModeResults');
        const pendingResults = result.pendingAutoModeResults || [];

        if (pendingResults.length === 0) return;

        // Process unprocessed results
        const unprocessed = pendingResults.filter((r: any) => !r.processed);
        if (unprocessed.length === 0) return;

        console.log(`[App] Processing ${unprocessed.length} pending auto mode results`);

        for (const pending of unprocessed) {
          try {
            // Convert data URLs to blobs for storage
            const userParsed = parseDataUrl(pending.userImage);
            const clothingParsed = parseDataUrl(pending.clothingImage);
            const resultParsed = parseDataUrl(pending.resultImage);

            if (!userParsed || !clothingParsed || !resultParsed) {
              console.error('[App] Failed to parse pending result images');
              continue;
            }

            const userBlob = await fetch(pending.userImage).then(r => r.blob());
            const clothingBlob = await fetch(pending.clothingImage).then(r => r.blob());
            const resultBlob = await fetch(pending.resultImage).then(r => r.blob());

            // Create File objects
            const userFile = new File([userBlob], 'user.jpg', { type: userParsed.mimeType });
            const clothingFile = new File([clothingBlob], 'clothing.jpg', { type: clothingParsed.mimeType });

            const userPhotoId = await saveUserPhoto(userFile);
            const clothingImageId = await saveClothingImage(clothingFile);

            await saveTryOnResult(
              userPhotoId,
              clothingImageId,
              resultBlob,
              'Auto mode try-on'
            );

            pending.processed = true;
            console.log('[App] Saved auto mode result to history');
          } catch (err) {
            console.error('[App] Failed to save pending result:', err);
          }
        }

        // Update storage with processed flags
        await browser.storage.local.set({ pendingAutoModeResults: pendingResults });

        // Reload history
        await loadResults();
      } catch (error) {
        console.error('[App] Error processing pending results:', error);
      }
    };

    // Process on mount
    processPendingResults();

    // Also listen for storage changes to process new results
    const handleStorageChange = (changes: any) => {
      if (changes.pendingAutoModeResults) {
        processPendingResults();
      }
    };

    browser.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, [loadResults]);

  // Update cloud backed status when userImage changes
  useEffect(() => {
    if (!userImage) {
      setIsCloudBacked(false);
    }
  }, [userImage]);

  // Handle selecting photo from gallery
  const handleSelectFromGallery = (dataUrl: string) => {
    setUserImage(dataUrl);
    setIsCloudBacked(true);
  };

  // Refresh cloud photo count after upload
  const refreshCloudCount = async () => {
    const gallery = await getUserPhotoGallery();
    setCloudPhotoCount(gallery.length);
  };

  // Remove user photo (optionally clear from cloud too)
  const handleRemoveUserPhoto = async (clearCloud = false) => {
    setUserImage(null);
    if (clearCloud) {
      await clearUserPhotoR2();
      await refreshCloudCount();
    }
    setIsCloudBacked(false);
  };

  const canGenerate = userImage && clothingImage && apiKey;

  const handleUserUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setUserImage(dataUrl);

      // Upload to R2 if enabled
      if (r2Enabled) {
        setIsUploadingToCloud(true);
        try {
          const stored = await uploadToR2(dataUrl, 'user');
          if (stored) {
            // Create a small thumbnail for the gallery
            const thumbnail = await createThumbnail(dataUrl);
            await saveUserPhotoUrl(stored);
            await addToUserPhotoGallery(stored, thumbnail);
            setIsCloudBacked(true);
            await refreshCloudCount();
          }
        } catch (err) {
          console.error('Failed to upload to R2:', err);
        } finally {
          setIsUploadingToCloud(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Create a small thumbnail for gallery preview
  const createThumbnail = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 100;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // Center crop
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = dataUrl;
    });
  };

  const handleClothingUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setClothingImage(e.target?.result as string, 'upload');
    reader.readAsDataURL(file);
  };

  // Handle drag and drop for clothing images
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleClothingUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="w-full min-h-screen bg-background flex flex-col"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Virtual Try-On</h1>
            <p className="text-xs text-muted-foreground">Powered by Gemini AI</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <Tabs defaultValue="try-on" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start px-4 pt-2 bg-transparent">
          <TabsTrigger value="try-on" className="flex-1">
            <Shirt className="w-4 h-4 mr-2" />
            Try On
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-1">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="try-on" className="flex-1 p-4 space-y-4">
          {/* Show result or upload UI */}
          {result ? (
            <TryOnResult
              resultImage={result}
              userImage={userImage!}
              clothingImage={clothingImage!}
              onRegenerate={regenerate}
              onBack={() => {
                clearResult();
                useAppStore.getState().reset();
              }}
              isRegenerating={isGenerating}
            />
          ) : isGenerating ? (
            <LoadingState />
          ) : (
            <>
              {/* User Photo Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Your Photo
                  </label>
                  {userImage && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      {isUploadingToCloud ? (
                        <>
                          <Cloud className="w-3 h-3 animate-pulse" />
                          Syncing...
                        </>
                      ) : isCloudBacked ? (
                        <>
                          <Cloud className="w-3 h-3" />
                          Cloud backed
                        </>
                      ) : (
                        'Saved locally'
                      )}
                    </span>
                  )}
                </div>
                {userImage ? (
                  <div className="space-y-2">
                    <ImagePreview
                      src={userImage}
                      alt="Your photo"
                      onRemove={() => handleRemoveUserPhoto(false)}
                      aspectRatio="portrait"
                    />
                    {isCloudBacked && (
                      <button
                        onClick={() => handleRemoveUserPhoto(true)}
                        className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Remove from cloud too
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImageUploader
                      onUpload={handleUserUpload}
                      label="Upload your photo"
                      description="Full body photo works best"
                    />
                    {r2Enabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowGallery(true)}
                        className="w-full"
                      >
                        <Images className="w-4 h-4 mr-2" />
                        {cloudPhotoCount > 0
                          ? `Choose from Cloud (${cloudPhotoCount} photo${cloudPhotoCount !== 1 ? 's' : ''})`
                          : 'Choose from Cloud'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Clothing Image Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Shirt className="w-4 h-4" />
                    Clothing Item
                  </label>
                  {clothingImageSource && (
                    <span className="text-xs flex items-center gap-1 text-muted-foreground">
                      {clothingImageSource === 'captured' ? (
                        <>
                          <Globe className="w-3 h-3" />
                          From website
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3" />
                          Uploaded
                        </>
                      )}
                    </span>
                  )}
                </div>
                {clothingImage ? (
                  <ImagePreview
                    src={clothingImage}
                    alt="Clothing"
                    onRemove={() => setClothingImage(null)}
                    aspectRatio="square"
                  />
                ) : (
                  <ImageUploader
                    onUpload={handleClothingUpload}
                    label="Upload or drag clothing image"
                    description="Or right-click any image on a website"
                  />
                )}
              </div>

              {/* Generate Button */}
              <Button
                onClick={generate}
                disabled={!canGenerate}
                className="w-full h-12 text-base"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Try-On
              </Button>

              {!apiKey && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Add your API key in Settings to continue
                </p>
              )}

              {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
              )}

              {/* Tip about right-click */}
              {!clothingImage && (
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    <strong>Tip:</strong> Right-click any product image on a website and select "Try on this item" to use it here. You can also drag and drop images directly into this panel.
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="flex-1 p-4 overflow-auto">
          <HistoryGallery />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 p-4 overflow-auto">
          <SettingsPanel />
        </TabsContent>
      </Tabs>

      {/* Cloud Photo Gallery Modal */}
      {showGallery && (
        <CloudPhotoGallery
          onSelect={handleSelectFromGallery}
          onClose={() => {
            setShowGallery(false);
            refreshCloudCount(); // Update count in case photos were deleted
          }}
        />
      )}
    </div>
  );
}
