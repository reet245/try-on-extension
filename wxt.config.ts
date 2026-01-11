import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Virtual Try-On',
    description: 'Try on clothes virtually using AI',
    version: '1.0.0',
    permissions: ['storage', 'contextMenus', 'notifications'],
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      '<all_urls>'
    ],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png',
      },
    },
  },
});
