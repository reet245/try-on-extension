import { useEffect } from 'react';
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
import { Sparkles, History, Settings, Shirt, User, Globe, Upload } from 'lucide-react';

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

  // Check for captured images when popup opens
  useEffect(() => {
    loadCapturedImage().then(() => {
      // Clear from storage after loading so it doesn't persist
      clearCapturedImage();
    });
  }, []);

  const canGenerate = userImage && clothingImage && apiKey;

  const handleUserUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setUserImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleClothingUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setClothingImage(e.target?.result as string, 'upload');
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-[400px] min-h-[600px] bg-background flex flex-col">
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
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Saved
                    </span>
                  )}
                </div>
                {userImage ? (
                  <ImagePreview
                    src={userImage}
                    alt="Your photo"
                    onRemove={() => setUserImage(null)}
                    aspectRatio="portrait"
                  />
                ) : (
                  <ImageUploader
                    onUpload={handleUserUpload}
                    label="Upload your photo"
                    description="Full body photo works best (saved locally)"
                  />
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
                    label="Upload clothing image"
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
                    <strong>Tip:</strong> Right-click any product image on a website and select "Try on this item" to use it here.
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
    </div>
  );
}
