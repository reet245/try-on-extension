export default defineBackground(() => {
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

  console.log('Virtual Try-On background script loaded');
});
