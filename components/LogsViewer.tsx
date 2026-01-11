import { useState, useEffect } from 'react';
import { ScrollText, Trash2, RefreshCw, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiLogs, clearApiLogs, type ApiLog } from '@/lib/db';
import { cn } from '@/lib/utils';

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function LogEntry({ log }: { log: ApiLog }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const statusColors = {
    pending: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
    success: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    error: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  };

  const typeIcons = {
    request: '→',
    response: '←',
    error: '✕',
  };

  const handleCopy = async () => {
    const text = `[${formatTimestamp(log.timestamp)}] ${log.type.toUpperCase()}\nModel: ${log.model}\nStatus: ${log.status}\nMessage: ${log.message}\n${log.durationMs ? `Duration: ${log.durationMs}ms\n` : ''}${log.details ? `\nDetails:\n${log.details}` : ''}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('border rounded-lg p-2 text-xs', statusColors[log.status])}>
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-mono mt-0.5">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono">{typeIcons[log.type]}</span>
            <span className="font-medium truncate">{log.message}</span>
          </div>
          <div className="text-[10px] opacity-70 mt-0.5">
            {formatTimestamp(log.timestamp)}
            {log.durationMs && ` • ${log.durationMs}ms`}
            {' • '}{log.model.split('/').pop()}
          </div>
        </div>
      </div>

      {expanded && log.details && (
        <div className="mt-2 pt-2 border-t border-current/10">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium">Details:</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded max-h-40 overflow-auto">
            {log.details}
          </pre>
        </div>
      )}
    </div>
  );
}

export function LogsViewer() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    const data = await getApiLogs(100);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClear = async () => {
    if (window.confirm('Clear all API logs?')) {
      await clearApiLogs();
      setLogs([]);
    }
  };

  const handleExport = () => {
    const text = logs.map(log =>
      `[${new Date(log.timestamp).toISOString()}] ${log.type.toUpperCase()} | ${log.status} | ${log.model}\n${log.message}\n${log.details ? `Details: ${log.details}\n` : ''}${log.durationMs ? `Duration: ${log.durationMs}ms\n` : ''}\n---\n`
    ).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="w-4 h-4" />
          API Logs
        </CardTitle>
        <CardDescription>
          View API requests and errors for debugging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={cn('w-3 h-3 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0}>
            Export
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClear} disabled={logs.length === 0}>
            <Trash2 className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No logs yet. Make a try-on request to see logs.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {logs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          {logs.length} log entries • Logs are stored locally
        </p>
      </CardContent>
    </Card>
  );
}
