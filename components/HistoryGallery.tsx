import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Trash2, Download, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { cn } from '@/lib/utils';
import type { TryOnResult } from '@/lib/db';

export function HistoryGallery() {
  const { results, isLoading, loadResults, toggleFavorite, deleteResult, selectedResult, setSelectedResult } = useHistoryStore();
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const filteredResults = filter === 'favorites'
    ? results.filter(r => r.isFavorite)
    : results;

  const handleDownload = (result: TryOnResult) => {
    const link = document.createElement('a');
    link.href = result.resultThumbnail;
    link.download = `try-on-${result.id}-${Date.now()}.png`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading history...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">No results yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your try-on results will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          All ({results.length})
        </button>
        <button
          onClick={() => setFilter('favorites')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            filter === 'favorites'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Favorites ({results.filter(r => r.isFavorite).length})
        </button>
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-2 gap-2">
        <AnimatePresence>
          {filteredResults.map((result) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative group"
            >
              <button
                onClick={() => setSelectedResult(result)}
                className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={result.resultThumbnail}
                  alt="Try-on result"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </button>

              {/* Quick actions overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(result.id!);
                  }}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Heart className={cn('w-4 h-4 text-white', result.isFavorite && 'fill-red-500 text-red-500')} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(result);
                  }}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this result?')) {
                      deleteResult(result.id!);
                    }
                  }}
                  className="p-2 rounded-full bg-white/20 hover:bg-red-500/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Favorite indicator */}
              {result.isFavorite && (
                <div className="absolute top-2 right-2">
                  <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Full view modal */}
      <AnimatePresence>
        {selectedResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedResult.resultThumbnail}
                alt="Try-on result"
                className="w-full rounded-lg"
              />
              <button
                onClick={() => setSelectedResult(null)}
                className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => toggleFavorite(selectedResult.id!)}
                >
                  <Heart className={cn('w-4 h-4 mr-2', selectedResult.isFavorite && 'fill-red-500 text-red-500')} />
                  {selectedResult.isFavorite ? 'Unfavorite' : 'Favorite'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownload(selectedResult)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
