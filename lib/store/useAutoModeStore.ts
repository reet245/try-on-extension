import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AutoModeState {
  autoModeEnabled: boolean;
  setAutoModeEnabled: (enabled: boolean) => void;
}

// Custom storage adapter for chrome.storage.local
const chromeStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const result = await browser.storage.local.get(name);
    return result[name] ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await browser.storage.local.set({ [name]: value });
  },
  removeItem: async (name: string): Promise<void> => {
    await browser.storage.local.remove(name);
  },
};

export const useAutoModeStore = create<AutoModeState>()(
  persist(
    (set) => ({
      autoModeEnabled: false,
      setAutoModeEnabled: (enabled) => set({ autoModeEnabled: enabled }),
    }),
    {
      name: 'auto-mode-storage',
      storage: createJSONStorage(() => chromeStorage),
    }
  )
);

// Broadcast auto mode state change to all tabs
export async function broadcastAutoModeChange(enabled: boolean): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: 'AUTO_MODE_CHANGED',
            enabled,
          });
        } catch {
          // Tab might not have content script loaded, ignore
        }
      }
    }
  } catch (error) {
    console.error('Failed to broadcast auto mode change:', error);
  }
}

// Helper to get auto mode state from storage (for background/content scripts)
export async function getAutoModeEnabled(): Promise<boolean> {
  try {
    const result = await browser.storage.local.get('auto-mode-storage');
    const stored = result['auto-mode-storage'];
    if (stored) {
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
      return parsed.state?.autoModeEnabled ?? false;
    }
    return false;
  } catch {
    return false;
  }
}

// Helper to set auto mode state from background script
export async function setAutoModeEnabled(enabled: boolean): Promise<void> {
  try {
    const result = await browser.storage.local.get('auto-mode-storage');
    const stored = result['auto-mode-storage'];
    const parsed = stored
      ? (typeof stored === 'string' ? JSON.parse(stored) : stored)
      : { state: {} };
    parsed.state = { ...parsed.state, autoModeEnabled: enabled };
    await browser.storage.local.set({ 'auto-mode-storage': JSON.stringify(parsed) });
  } catch (error) {
    console.error('Failed to set auto mode enabled:', error);
  }
}
