import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ["scripting", "activeTab", "tabs", "storage", "debugger", "downloads"],
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: [
          "content-scripts/recorder.js",
          "content-scripts/highlight.js",
          "content-scripts/ui.js",
          // "ui/index.css"
        ],
        matches: ["<all_urls>"],
      }
    ],
    action: {
      default_popup: 'popup/index.html'
    },
    side_panel: {
      default_path: 'sidepanel/index.html'
    }

  }
});
