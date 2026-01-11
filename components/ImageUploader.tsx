import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  label: string;
  description?: string;
  accept?: string[];
  maxSize?: number; // in MB
  className?: string;
}

export function ImageUploader({
  onUpload,
  label,
  description = 'PNG, JPG up to 10MB',
  accept = ['image/png', 'image/jpeg', 'image/webp'],
  maxSize = 10,
  className,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxSize * 1024 * 1024,
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  return (
    <motion.div
      {...getRootProps()}
      className={cn(
        'relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer',
        'hover:border-primary/50 hover:bg-primary/5',
        isDragActive && 'border-primary bg-primary/10 scale-[1.02]',
        className
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={cn(
            'p-3 rounded-full bg-muted transition-colors',
            isDragActive && 'bg-primary/20'
          )}
        >
          <Upload
            className={cn(
              'w-6 h-6 text-muted-foreground',
              isDragActive && 'text-primary'
            )}
          />
        </div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
