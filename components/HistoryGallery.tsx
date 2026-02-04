import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Trash2, Download, X, ImageIcon, RefreshCw, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { cn } from '@/lib/utils';
import type { TryOnResult } from '@/lib/db';
import {
  isR2Enabled,
  getResultsGallery,
  syncResultsFromR2,
  fetchFromR2,
  deleteResultFromGallery,
  type ResultGalleryItem,
} from '@/lib/storage/r2Storage';

export function HistoryGallery() {
  const { results, isLoading, loadResults, toggleFavorite, deleteResult, selectedResult, setSelectedResult } = useHistoryStore();
  const [filter, setFilter] = useState<'all' | 'favorites' | 'cloud'>('all');
  const [cloudResults, setCloudResults] = useState<ResultGalleryItem[]>([]);
  const [r2Enabled, setR2Enabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedCloudResult, setSelectedCloudResult] = useState<ResultGalleryItem | null>(null);
  const [loadingCloudImage, setLoadingCloudImage] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
    loadCloudResults();
  }, [loadResults]);

  const loadCloudResults = async () => {
    const enabled = await isR2Enabled();
    setR2Enabled(enabled);

    if (enabled) {
      // First load from local cache
      let gallery = await getResultsGallery();

      // Auto-sync if empty
      if (gallery.length === 0) {
        setSyncing(true);
        const syncResult = await syncResultsFromR2();
        if (!syncResult.error && syncResult.added > 0) {
          gallery = await getResultsGallery();
        }
        setSyncing(false);
      }

      setCloudResults(gallery);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncResultsFromR2();
      if (result.error) {
        setSyncMessage(`Error: ${result.error}`);
      } else if (result.added > 0) {
        setSyncMessage(`Found ${result.added} new result${result.added !== 1 ? 's' : ''}`);
        const gallery = await getResultsGallery();
        setCloudResults(gallery);
      } else {
        setSyncMessage(`Up to date (${result.synced} in cloud)`);
      }
    } catch (error) {
      setSyncMessage('Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handleCloudResultClick = async (item: ResultGalleryItem) => {
    setLoadingCloudImage(item.key);
    try {
      const dataUrl = await fetchFromR2(item.url);
      if (dataUrl) {
        setSelectedCloudResult({ ...item, thumbnail: dataUrl });
      }
    } catch (error) {
      console.error('Failed to load cloud result:', error);
    } finally {
      setLoadingCloudImage(null);
    }
  };

  const handleDeleteCloudResult = async (key: string) => {
    if (!window.confirm('Delete this result from cloud?')) return;
    await deleteResultFromGallery(key);
    setCloudResults(cloudResults.filter(r => r.key !== key));
    if (selectedCloudResult?.key === key) {
      setSelectedCloudResult(null);
    }
  };

  const downloadCloudResult = (item: ResultGalleryItem & { thumbnail?: string }) => {
    if (!item.thumbnail) return;
    const link = document.createElement('a');
    link.href = item.thumbnail;
    link.download = `try-on-cloud-${Date.now()}.png`;
    link.click();
  };

  const filteredResults = filter === 'favorites'
    ? results.filter(r => r.isFavorite)
    : filter === 'cloud'
    ? [] // Cloud results handled separately
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

  if (results.length === 0 && cloudResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">No results yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your try-on results will appear here
        </p>
        {r2Enabled && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : 'Sync from cloud'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Local ({results.length})
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
        {r2Enabled && (
          <button
            onClick={() => setFilter('cloud')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1',
              filter === 'cloud'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Cloud className="w-3 h-3" />
            Cloud ({cloudResults.length})
          </button>
        )}
        {r2Enabled && filter === 'cloud' && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors ml-auto"
            title="Sync from cloud"
          >
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
          </button>
        )}
      </div>

      {/* Sync message */}
      {syncMessage && (
        <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded py-1">
          {syncMessage}
        </div>
      )}

      {/* Gallery grid - Local results */}
      {filter !== 'cloud' && (
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
      )}

      {/* Gallery grid - Cloud results */}
      {filter === 'cloud' && (
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence>
            {cloudResults.map((item) => (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group"
              >
                <button
                  onClick={() => handleCloudResultClick(item)}
                  disabled={loadingCloudImage === item.key}
                  className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-muted"
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt="Cloud result"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {loadingCloudImage === item.key ? (
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Cloud className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </button>

                {/* Quick actions overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCloudResult(item.key);
                    }}
                    className="p-2 rounded-full bg-white/20 hover:bg-red-500/50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>

                {/* Cloud indicator */}
                <div className="absolute top-2 right-2">
                  <Cloud className="w-4 h-4 text-blue-400" />
                </div>

                {/* Date */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                  <p className="text-[10px] text-white truncate">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {cloudResults.length === 0 && (
            <div className="col-span-2 text-center py-8">
              <Cloud className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No results in cloud</p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="mt-2 text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
              >
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
                {syncing ? 'Syncing...' : 'Sync from cloud'}
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* Cloud result full view modal */}
      <AnimatePresence>
        {selectedCloudResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setSelectedCloudResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedCloudResult.thumbnail}
                alt="Cloud result"
                className="w-full rounded-lg"
              />
              <button
                onClick={() => setSelectedCloudResult(null)}
                className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => downloadCloudResult(selectedCloudResult)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    handleDeleteCloudResult(selectedCloudResult.key);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
