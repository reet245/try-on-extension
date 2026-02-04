import { useState, useEffect } from 'react';
import { Cloud, Trash2, Check, Loader2, Plus, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getUserPhotoGallery,
  fetchFromR2,
  deletePhotoFromGallery,
  syncGalleryFromR2,
  type GalleryPhoto,
} from '@/lib/storage/r2Storage';

interface CloudPhotoGalleryProps {
  onSelect: (dataUrl: string) => void;
  onClose: () => void;
}

export function CloudPhotoGallery({ onSelect, onClose }: CloudPhotoGalleryProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadPhotosAndSync();
  }, []);

  const loadPhotosAndSync = async () => {
    setLoading(true);
    const gallery = await getUserPhotoGallery();
    setPhotos(gallery);
    setLoading(false);

    // Auto-sync from R2 if gallery is empty (might have photos on server)
    if (gallery.length === 0) {
      setSyncing(true);
      const result = await syncGalleryFromR2();
      if (!result.error && result.added > 0) {
        const updatedGallery = await getUserPhotoGallery();
        setPhotos(updatedGallery);
        setSyncMessage(`Found ${result.added} photo${result.added !== 1 ? 's' : ''} in cloud`);
        setTimeout(() => setSyncMessage(null), 3000);
      }
      setSyncing(false);
    }
  };

  const loadPhotos = async () => {
    setLoading(true);
    const gallery = await getUserPhotoGallery();
    setPhotos(gallery);
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncGalleryFromR2();
      if (result.error) {
        setSyncMessage(`Error: ${result.error}`);
      } else if (result.added > 0) {
        setSyncMessage(`Found ${result.added} new photo${result.added !== 1 ? 's' : ''}`);
        await loadPhotos();
      } else {
        setSyncMessage('Gallery is up to date');
      }
    } catch (error) {
      setSyncMessage('Sync failed');
    } finally {
      setSyncing(false);
      // Clear message after 3 seconds
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  const handleSelect = async (photo: GalleryPhoto) => {
    setLoadingPhoto(photo.key);
    try {
      const dataUrl = await fetchFromR2(photo.url);
      if (dataUrl) {
        onSelect(dataUrl);
        onClose();
      }
    } catch (error) {
      console.error('Failed to load photo:', error);
    } finally {
      setLoadingPhoto(null);
    }
  };

  const handleDelete = async (photo: GalleryPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this photo from cloud?')) return;

    setDeletingPhoto(photo.key);
    try {
      await deletePhotoFromGallery(photo.key);
      setPhotos(photos.filter(p => p.key !== photo.key));
    } catch (error) {
      console.error('Failed to delete photo:', error);
    } finally {
      setDeletingPhoto(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Cloud Photos</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title="Sync from cloud"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sync Message */}
        {syncMessage && (
          <div className="px-4 py-2 text-xs text-center bg-muted/50">
            {syncMessage}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-8">
              <Cloud className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No photos found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a photo to save it to cloud
              </p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="mt-3 text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
              >
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
                {syncing ? 'Syncing...' : 'Sync from cloud'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.key}
                  onClick={() => handleSelect(photo)}
                  disabled={loadingPhoto === photo.key || deletingPhoto === photo.key}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                    'hover:border-primary hover:scale-105',
                    'focus:outline-none focus:ring-2 focus:ring-primary',
                    loadingPhoto === photo.key && 'border-primary'
                  )}
                >
                  {/* Thumbnail or placeholder */}
                  {photo.thumbnail ? (
                    <img
                      src={photo.thumbnail}
                      alt={photo.name || 'Cloud photo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Cloud className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}

                  {/* Loading overlay */}
                  {loadingPhoto === photo.key && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(photo, e)}
                    disabled={deletingPhoto === photo.key}
                    className={cn(
                      'absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white',
                      'hover:bg-red-500 transition-colors',
                      'opacity-0 group-hover:opacity-100'
                    )}
                    style={{ opacity: 1 }}
                  >
                    {deletingPhoto === photo.key ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>

                  {/* Date */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                    <p className="text-[10px] text-white truncate">
                      {new Date(photo.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} in cloud
          </p>
        </div>
      </div>
    </div>
  );
}
