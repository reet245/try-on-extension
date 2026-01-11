import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, Heart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TryOnResultProps {
  resultImage: string;
  userImage: string;
  clothingImage: string;
  onRegenerate: () => void;
  onBack: () => void;
  isRegenerating?: boolean;
}

export function TryOnResult({
  resultImage,
  userImage,
  clothingImage,
  onRegenerate,
  onBack,
  isRegenerating,
}: TryOnResultProps) {
  const [showComparison, setShowComparison] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `try-on-${Date.now()}.png`;
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        New Try-On
      </Button>

      {/* Main Result */}
      <div className="relative rounded-xl overflow-hidden bg-muted aspect-[3/4]">
        <motion.img
          src={resultImage}
          alt="Try-on result"
          className="w-full h-full object-cover"
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        />

        {/* Comparison toggle */}
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="absolute bottom-3 left-3 px-3 py-1.5 bg-black/50 backdrop-blur-sm
                     rounded-full text-white text-xs font-medium hover:bg-black/70 transition"
        >
          {showComparison ? 'Hide' : 'Compare'}
        </button>
      </div>

      {/* Comparison View */}
      <AnimatePresence>
        {showComparison && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="grid grid-cols-2 gap-2 overflow-hidden"
          >
            <div className="space-y-1">
              <div className="rounded-lg overflow-hidden aspect-square">
                <img
                  src={userImage}
                  alt="Original"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs text-muted-foreground block text-center">Original</span>
            </div>
            <div className="space-y-1">
              <div className="rounded-lg overflow-hidden aspect-square">
                <img
                  src={clothingImage}
                  alt="Clothing"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs text-muted-foreground block text-center">Clothing</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex-1"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', isRegenerating && 'animate-spin')} />
          Regenerate
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsFavorite(!isFavorite)}
        >
          <Heart className={cn('w-4 h-4', isFavorite && 'fill-red-500 text-red-500')} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
