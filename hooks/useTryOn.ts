import { useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { generateTryOn, parseDataUrl } from '@/lib/api/gemini';
import { saveTryOnResult, saveUserPhoto, saveClothingImage } from '@/lib/db';

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
