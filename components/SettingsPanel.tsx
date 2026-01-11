import { useState } from 'react';
import { Eye, EyeOff, Key, Cpu, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore, type ModelType } from '@/lib/store/useAppStore';
import { useHistoryStore } from '@/lib/store/useHistoryStore';
import { LogsViewer } from '@/components/LogsViewer';
import { cn } from '@/lib/utils';

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
  const { apiKey, setApiKey, selectedModel, setSelectedModel } = useAppStore();
  const { clearHistory, results } = useHistoryStore();
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey || '');

  const handleSaveKey = () => {
    setApiKey(keyInput.trim() || null);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clearHistory();
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
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearHistory}
            disabled={results.length === 0}
            className="w-full"
          >
            Clear History ({results.length} items)
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
