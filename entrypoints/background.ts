import { generateTryOn, parseDataUrl } from '@/lib/api/gemini';
import { setAutoModeEnabled, broadcastAutoModeChange } from '@/lib/store/useAutoModeStore';

// Popup window state
let resultPopupWindowId: number | null = null;
let currentPopupState: PopupState | null = null;

interface PopupState {
  state: 'loading' | 'success' | 'error';
  resultImage?: string;
  errorMessage?: string;
  clothingImage?: string;
  userImage?: string;
  savedToHistory?: boolean;
  savedToCloud?: boolean;
}

export default defineBackground(() => {
  // Set up side panel to open on action click
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Create context menu for images
  browser.contextMenus.create({
    id: 'try-on-image',
    title: 'Try on this item',
    contexts: ['image'],
  });

  // Handle context menu click
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'try-on-image' && info.srcUrl && tab?.id) {
      try {
        // Send message to content script to capture the image
        const response = await browser.tabs.sendMessage(tab.id, {
          type: 'CAPTURE_IMAGE',
          imageUrl: info.srcUrl,
        });

        if (response?.success && response.dataUrl) {
          // Store the captured image as base64 data URL
          await browser.storage.local.set({
            capturedClothingImage: {
              dataUrl: response.dataUrl,
              timestamp: Date.now(),
              sourceTab: tab.url || 'unknown',
            },
          });

          // Show a notification to the user
          try {
            await browser.notifications.create({
              type: 'basic',
              iconUrl: browser.runtime.getURL('icon/128.png'),
              title: 'Image Captured!',
              message: 'Click the extension icon to try on this item.',
            });
          } catch (e) {
            console.log('Notification failed:', e);
          }

          console.log('Captured clothing image successfully');
        } else {
          console.error('Failed to capture image:', response?.error);

          // Try fallback: store URL and let popup handle it
          await browser.storage.local.set({
            capturedClothingImage: {
              url: info.srcUrl,
              timestamp: Date.now(),
              sourceTab: tab.url || 'unknown',
            },
          });

          try {
            await browser.notifications.create({
              type: 'basic',
              iconUrl: browser.runtime.getURL('icon/128.png'),
              title: 'Image Captured',
              message: 'Click the extension icon. Note: Some images may not work due to site restrictions.',
            });
          } catch (e) {
            console.log('Notification failed:', e);
          }
        }
      } catch (error) {
        console.error('Failed to capture image:', error);

        // Store URL as fallback
        await browser.storage.local.set({
          capturedClothingImage: {
            url: info.srcUrl,
            timestamp: Date.now(),
            sourceTab: tab?.url || 'unknown',
          },
        });
      }
    }
  });

  // Handle messages from content script and popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTO_TRYON') {
      handleAutoTryOn(message.clothingImage)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Async response
    }

    if (message.type === 'RETRY_AUTO_TRYON') {
      handleAutoTryOn(message.clothingImage)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (message.type === 'GET_POPUP_STATE') {
      sendResponse({ data: currentPopupState });
      return false;
    }
  });

  // Clean up popup window when it's closed
  browser.windows.onRemoved.addListener((windowId) => {
    if (windowId === resultPopupWindowId) {
      resultPopupWindowId = null;
      currentPopupState = null;
    }
  });

  console.log('Virtual Try-On background script loaded');
});

// Create or update the result popup window
async function showResultPopup(state: PopupState): Promise<void> {
  currentPopupState = state;

  try {
    // Check if popup window already exists
    if (resultPopupWindowId !== null) {
      try {
        const existingWindow = await browser.windows.get(resultPopupWindowId);
        if (existingWindow) {
          // Window exists, update state and focus it
          await updatePopupState(state);
          await browser.windows.update(resultPopupWindowId, { focused: true });
          return;
        }
      } catch {
        // Window doesn't exist anymore
        resultPopupWindowId = null;
      }
    }

    // Create new popup window
    // WXT generates the HTML file at result-popup/index.html, which becomes result-popup.html in the build
    const popupUrl = browser.runtime.getURL('result-popup.html');
    console.log('[Background] Creating result popup at:', popupUrl);

    const window = await browser.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 420,
      height: 580,
      focused: true,
    });

    resultPopupWindowId = window.id || null;

    // Wait a bit for the popup to load, then send state
    setTimeout(() => {
      updatePopupState(state);
    }, 500);
  } catch (error) {
    console.error('Failed to create popup window:', error);

    // Fallback: show notification with status
    try {
      const notifMsg = state.state === 'loading'
        ? 'Processing your try-on request...'
        : state.state === 'success'
          ? 'Try-on complete! Check your history.'
          : `Try-on failed: ${state.errorMessage || 'Unknown error'}`;

      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icon/128.png'),
        title: 'Virtual Try-On',
        message: notifMsg,
      });
    } catch {
      // Ignore notification errors
    }
  }
}

// Update the popup window state
async function updatePopupState(state: PopupState): Promise<void> {
  currentPopupState = state;

  if (resultPopupWindowId === null) return;

  try {
    // Get the tab in the popup window
    const tabs = await browser.tabs.query({ windowId: resultPopupWindowId });
    if (tabs.length > 0 && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, {
        type: 'RESULT_UPDATE',
        data: state,
      });
    }
  } catch (error) {
    console.error('Failed to update popup state:', error);
  }
}

// Handle auto try-on from content script
async function handleAutoTryOn(
  clothingImage: string
): Promise<{ success: boolean; resultImage?: string; error?: string; savedToHistory?: boolean; savedToCloud?: boolean }> {
  try {
    // Get user image from storage
    const storageResult = await browser.storage.local.get('try-on-storage');
    const stored = storageResult['try-on-storage'];
    const state = stored ? (typeof stored === 'string' ? JSON.parse(stored) : stored).state : null;
    const userImage = state?.userImage;

    if (!userImage) {
      // Disable auto mode and notify
      await setAutoModeEnabled(false);
      await broadcastAutoModeChange(false);
      try {
        await browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('icon/128.png'),
          title: 'Auto Mode Disabled',
          message: 'Please set a user photo first in the extension settings.',
        });
      } catch {
        // Ignore notification errors
      }
      return { success: false, error: 'No user photo set. Please upload your photo first.' };
    }

    // Get API key
    const apiKey = state?.apiKey;
    if (!apiKey) {
      return { success: false, error: 'No API key set. Please add your API key in settings.' };
    }

    // Get selected model
    const selectedModel = state?.selectedModel || 'nano-banana';

    // Show loading popup
    await showResultPopup({
      state: 'loading',
      clothingImage,
      userImage,
    });

    // Parse images
    const userParsed = parseDataUrl(userImage);
    const clothingParsed = parseDataUrl(clothingImage);

    if (!userParsed || !clothingParsed) {
      const errorMsg = 'Invalid image format. The image could not be processed.';
      await updatePopupState({
        state: 'error',
        errorMessage: errorMsg,
        clothingImage,
      });
      return { success: false, error: errorMsg };
    }

    // Call Gemini API
    const result = await generateTryOn(apiKey, {
      userImage: userParsed.base64,
      clothingImage: clothingParsed.base64,
      userImageMime: userParsed.mimeType,
      clothingImageMime: clothingParsed.mimeType,
    }, selectedModel);

    if (result.success && result.resultImage && result.resultMime) {
      const resultDataUrl = `data:${result.resultMime};base64,${result.resultImage}`;

      // Save to history in background
      let savedToHistory = false;
      let savedToCloud = false;

      try {
        const saveResult = await saveToHistoryAndCloud(userImage, clothingImage, resultDataUrl);
        savedToHistory = saveResult.savedToHistory;
        savedToCloud = saveResult.savedToCloud;
      } catch (saveError) {
        console.error('Failed to save to history:', saveError);
      }

      // Update popup with success
      await updatePopupState({
        state: 'success',
        resultImage: resultDataUrl,
        clothingImage,
        savedToHistory,
        savedToCloud,
      });

      return { success: true, resultImage: resultDataUrl, savedToHistory, savedToCloud };
    }

    const errorMsg = result.error || 'Failed to generate try-on';
    await updatePopupState({
      state: 'error',
      errorMessage: errorMsg,
      clothingImage,
    });

    return { success: false, error: errorMsg };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updatePopupState({
      state: 'error',
      errorMessage: message,
      clothingImage,
    });
    return { success: false, error: message };
  }
}

// Save result to history (IndexedDB) and cloud (R2)
async function saveToHistoryAndCloud(
  userImage: string,
  clothingImage: string,
  resultImage: string
): Promise<{ savedToHistory: boolean; savedToCloud: boolean }> {
  let savedToHistory = false;
  let savedToCloud = false;

  try {
    // Store result in chrome.storage for the side panel to pick up
    // This is a workaround since service workers can't access IndexedDB directly in all contexts
    const pendingResult = {
      userImage,
      clothingImage,
      resultImage,
      timestamp: Date.now(),
      processed: false,
    };

    // Get existing pending results
    const existing = await browser.storage.local.get('pendingAutoModeResults');
    const pendingResults = existing.pendingAutoModeResults || [];
    pendingResults.push(pendingResult);

    // Keep only last 10 pending results
    while (pendingResults.length > 10) {
      pendingResults.shift();
    }

    await browser.storage.local.set({ pendingAutoModeResults: pendingResults });
    savedToHistory = true;

    // Check if R2 is enabled and try to upload
    const r2Config = await browser.storage.local.get('r2-config');
    if (r2Config['r2-config']?.enabled && r2Config['r2-config']?.workerUrl) {
      try {
        // Convert data URL to blob and upload
        const response = await fetch(resultImage);
        const blob = await response.blob();

        const uploadResponse = await fetch(`${r2Config['r2-config'].workerUrl}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': blob.type || 'image/png',
            'X-Image-Type': 'result',
          },
          body: blob,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          if (uploadResult.success) {
            savedToCloud = true;

            // Add to results gallery in storage
            const galleryResult = await browser.storage.local.get('resultsR2Gallery');
            const gallery = galleryResult.resultsR2Gallery || [];
            gallery.unshift({
              key: uploadResult.key,
              url: uploadResult.url,
              createdAt: Date.now(),
            });

            // Keep only last 50 in gallery
            while (gallery.length > 50) {
              gallery.pop();
            }

            await browser.storage.local.set({ resultsR2Gallery: gallery });
          }
        }
      } catch (r2Error) {
        console.error('R2 upload failed:', r2Error);
      }
    }
  } catch (error) {
    console.error('Save to history failed:', error);
  }

  return { savedToHistory, savedToCloud };
}
