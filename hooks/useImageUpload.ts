import { useCallback } from 'react';

interface UseImageUploadOptions {
  maxSizeMB?: number;
  acceptedTypes?: string[];
  onUpload: (dataUrl: string) => void;
  onError?: (error: string) => void;
}

export function useImageUpload({
  maxSizeMB = 10,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/webp'],
  onUpload,
  onError,
}: UseImageUploadOptions) {
  const handleFile = useCallback(
    (file: File) => {
      // Validate file type
      if (!acceptedTypes.includes(file.type)) {
        onError?.(`Invalid file type. Accepted: ${acceptedTypes.join(', ')}`);
        return;
      }

      // Validate file size
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        onError?.(`File too large. Maximum size: ${maxSizeMB}MB`);
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          onUpload(result);
        }
      };
      reader.onerror = () => {
        onError?.('Failed to read file');
      };
      reader.readAsDataURL(file);
    },
    [maxSizeMB, acceptedTypes, onUpload, onError]
  );

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleFile(acceptedFiles[0]);
      }
    },
    [handleFile]
  );

  return {
    handleFile,
    handleDrop,
  };
}
