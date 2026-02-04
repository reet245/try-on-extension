import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { generateTryOn, parseDataUrl } from '@/lib/api/gemini';
import { saveTryOnResult, saveUserPhoto, saveClothingImage } from '@/lib/db';
import { isR2Enabled, uploadToR2, addToResultsGallery } from '@/lib/storage/r2Storage';

export function useTryOn() {
  const [result, setResult] = useState<string | null>(null);

  const {
    userImage,
    clothingImage,
    apiKey,
    selectedModel,
    isGenerating,
    setIsGenerating,
    setError,
  } = useAppStore();

  const { addResult, loadResults } = useHistoryStore();

  const generate = useCallback(async () => {
    if (!userImage || !clothingImage || !apiKey) {
      setError('Missing required inputs');
      return;
    }

    const userParsed = parseDataUrl(userImage);
    const clothingParsed = parseDataUrl(clothingImage);

    if (!userParsed || !clothingParsed) {
      setError('Invalid image format');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await generateTryOn(
        apiKey,
        {
          userImage: userParsed.base64,
          clothingImage: clothingParsed.base64,
          userImageMime: userParsed.mimeType,
          clothingImageMime: clothingParsed.mimeType,
        },
        selectedModel
      );

      if (response.success && response.resultImage) {
        const resultDataUrl = `data:${response.resultMime || 'image/png'};base64,${response.resultImage}`;
        setResult(resultDataUrl);

        // Save to history
        try {
          // Convert data URLs to blobs for storage
          const userBlob = await fetch(userImage).then(r => r.blob());
          const clothingBlob = await fetch(clothingImage).then(r => r.blob());
          const resultBlob = await fetch(resultDataUrl).then(r => r.blob());

          // Create File objects
          const userFile = new File([userBlob], 'user.jpg', { type: userParsed.mimeType });
          const clothingFile = new File([clothingBlob], 'clothing.jpg', { type: clothingParsed.mimeType });

          const userPhotoId = await saveUserPhoto(userFile);
          const clothingImageId = await saveClothingImage(clothingFile);

          await saveTryOnResult(
            userPhotoId,
            clothingImageId,
            resultBlob,
            'Virtual try-on generation'
          );

          // Reload history
          await loadResults();

          // Also upload result to R2 if enabled
          const r2Enabled = await isR2Enabled();
          if (r2Enabled) {
            try {
              const storedResult = await uploadToR2(resultDataUrl, 'result');
              if (storedResult) {
                // Create thumbnail for gallery
                const thumbnailCanvas = document.createElement('canvas');
                const img = new Image();
                await new Promise<void>((resolve) => {
                  img.onload = () => {
                    const size = 200;
                    const scale = Math.min(size / img.width, size / img.height);
                    thumbnailCanvas.width = img.width * scale;
                    thumbnailCanvas.height = img.height * scale;
                    thumbnailCanvas.getContext('2d')?.drawImage(img, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
                    resolve();
                  };
                  img.src = resultDataUrl;
                });
                const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.6);
                await addToResultsGallery(storedResult, thumbnail);
                console.log('Result image backed up to R2');
              }
            } catch (r2Error) {
              console.error('Failed to backup result to R2:', r2Error);
              // Don't fail - local save already succeeded
            }
          }
        } catch (dbError) {
          console.error('Failed to save to history:', dbError);
          // Don't fail the whole operation if history save fails
        }
      } else {
        setError(response.error || 'Generation failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }, [userImage, clothingImage, apiKey, selectedModel, setIsGenerating, setError, addResult, loadResults]);

  const regenerate = useCallback(async () => {
    setResult(null);
    await generate();
  }, [generate]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    result,
    isGenerating,
    generate,
    regenerate,
    clearResult,
  };
}
