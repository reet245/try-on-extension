import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  src: string;
  alt: string;
  onRemove: () => void;
  aspectRatio?: 'square' | 'portrait';
  className?: string;
}

export function ImagePreview({
  src,
  alt,
  onRemove,
  aspectRatio = 'portrait',
  className,
}: ImagePreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'relative rounded-xl overflow-hidden bg-muted',
        aspectRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square',
        'max-h-48',
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        aria-label="Remove image"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
