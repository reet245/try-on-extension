import { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, Cpu, Trash2, Cloud, CheckCircle, XCircle, Loader2, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore, type ModelType } from '@/lib/store/useAppStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { useAutoModeStore, broadcastAutoModeChange } from '@/lib/store/useAutoModeStore';
import { LogsViewer } from '@/components/LogsViewer';
import { cn } from '@/lib/utils';
import {
  getR2Config,
  saveR2Config,
  testR2Connection,
  type R2Config,
} from '@/lib/storage/r2Storage';
import { db } from '@/lib/db';

const MODEL_OPTIONS: { value: ModelType; label: string; description: string }[] = [
  {
    value: 'nano-banana',
    label: 'Nano Banana',
    description: 'Fast & efficient (Gemini 2.0 Flash)',
  },
  {
    value: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    description: 'Higher quality (Gemini 3 Pro)',
  },
];

export function SettingsPanel() {
  const { apiKey, setApiKey, selectedModel, setSelectedModel, setUserImage, userImage } = useAppStore();
  const { clearHistory, results } = useHistoryStore();
  const { autoModeEnabled, setAutoModeEnabled } = useAutoModeStore();
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey || '');

  // R2 Config state
  const [r2Config, setR2Config] = useState<R2Config | null>(null);
  const [r2UrlInput, setR2UrlInput] = useState('');
  const [r2Testing, setR2Testing] = useState(false);
  const [r2TestResult, setR2TestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Sync keyInput with apiKey when store rehydrates
  useEffect(() => {
    if (apiKey && !keyInput) {
      setKeyInput(apiKey);
    }
  }, [apiKey]);

  // Load R2 config on mount
  useEffect(() => {
    getR2Config().then((config) => {
      if (config) {
        setR2Config(config);
        setR2UrlInput(config.workerUrl);
      }
    });
  }, []);

  const handleSaveKey = () => {
    setApiKey(keyInput.trim() || null);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clearHistory();
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm('This will clear ALL data including history, saved photos, and settings. Are you sure?')) {
      // Clear history
      await clearHistory();
      // Clear IndexedDB tables
      await db.userPhotos.clear();
      await db.clothingImages.clear();
      await db.apiLogs.clear();
      // Clear user image from store
      setUserImage(null);
      // Clear chrome.storage
      await browser.storage.local.clear();
      // Reset API key input
      setKeyInput('');
      setApiKey(null);
      // Reset R2 config
      setR2Config(null);
      setR2UrlInput('');
    }
  };

  const handleTestR2 = async () => {
    if (!r2UrlInput.trim()) return;

    setR2Testing(true);
    setR2TestResult(null);

    const result = await testR2Connection(r2UrlInput.trim());
    setR2TestResult(result);
    setR2Testing(false);
  };

  const handleSaveR2 = async () => {
    const config: R2Config = {
      workerUrl: r2UrlInput.trim(),
      enabled: true,
    };
    await saveR2Config(config);
    setR2Config(config);
    setR2TestResult({ success: true });
  };

  const handleDisableR2 = async () => {
    if (r2Config) {
      const config: R2Config = { ...r2Config, enabled: false };
      await saveR2Config(config);
      setR2Config(config);
    }
  };

  return (
    <div className="space-y-4">
      {/* API Key Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Key
          </CardTitle>
          <CardDescription>
            Your Google AI Studio API key for Gemini
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              placeholder="Enter your API key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveKey} className="flex-1">
              Save Key
            </Button>
            {apiKey && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setKeyInput('');
                  setApiKey(null);
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {apiKey && (
            <p className="text-xs text-green-600 dark:text-green-400">
              API key saved
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Get your key at{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              aistudio.google.com
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Cloud Storage Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            Cloud Storage (R2)
          </CardTitle>
          <CardDescription>
            Store images in Cloudflare R2 for persistence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="https://your-worker.username.workers.dev"
              value={r2UrlInput}
              onChange={(e) => {
                setR2UrlInput(e.target.value);
                setR2TestResult(null);
              }}
            />
            {r2TestResult && (
              <div className={cn(
                'flex items-center gap-2 text-xs',
                r2TestResult.success ? 'text-green-600' : 'text-red-600'
              )}>
                {r2TestResult.success ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Connected successfully
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" />
                    {r2TestResult.error || 'Connection failed'}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestR2}
              disabled={r2Testing || !r2UrlInput.trim()}
              className="flex-1"
            >
              {r2Testing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : null}
              Test
            </Button>
            <Button
              size="sm"
              onClick={handleSaveR2}
              disabled={!r2UrlInput.trim() || !r2TestResult?.success}
              className="flex-1"
            >
              Save & Enable
            </Button>
          </div>
          {r2Config?.enabled && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Cloud storage enabled
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDisableR2}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Disable
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Deploy the Cloudflare Worker from the cloudflare-worker folder
          </p>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Model
          </CardTitle>
          <CardDescription>
            Choose the AI model for generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {MODEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedModel(option.value)}
              className={cn(
                'w-full p-3 rounded-lg border text-left transition-colors',
                selectedModel === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground">{option.description}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Auto Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Auto Mode
          </CardTitle>
          <CardDescription>
            Automatically try on clothes when clicking product images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!userImage && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Upload your photo in the Try On tab before enabling Auto Mode
              </p>
            </div>
          )}
          <button
            onClick={async () => {
              if (!userImage && !autoModeEnabled) {
                return; // Can't enable without user photo
              }
              const newValue = !autoModeEnabled;
              setAutoModeEnabled(newValue);
              await broadcastAutoModeChange(newValue);
            }}
            disabled={!userImage && !autoModeEnabled}
            className={cn(
              'w-full p-3 rounded-lg border text-left transition-colors',
              autoModeEnabled
                ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                : 'border-border hover:border-primary/50',
              !userImage && !autoModeEnabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  {autoModeEnabled ? 'Auto Mode Enabled' : 'Auto Mode Disabled'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {autoModeEnabled
                    ? 'Click product images to try them on'
                    : 'Click to enable automatic try-on'}
                </div>
              </div>
              <div
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative',
                  autoModeEnabled ? 'bg-green-500' : 'bg-muted'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    autoModeEnabled ? 'translate-x-5' : 'translate-x-1'
                  )}
                />
              </div>
            </div>
          </button>
          <p className="text-xs text-muted-foreground">
            When enabled, clicking product images on e-commerce sites will automatically generate a try-on preview.
          </p>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Data
          </CardTitle>
          <CardDescription>
            Manage your stored data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearHistory}
            disabled={results.length === 0}
            className="w-full"
          >
            Clear History ({results.length} items)
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAllData}
            className="w-full"
          >
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* API Logs */}
      <LogsViewer />

      {/* Info */}
      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>Virtual Try-On Extension v1.0.0</p>
        <p>Powered by Gemini AI</p>
      </div>
    </div>
  );
}
