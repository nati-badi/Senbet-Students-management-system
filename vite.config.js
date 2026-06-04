import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

const plugins = [
  react(),
  tailwindcss(),
];

if (!isTauri) {
  plugins.push(
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB - allow large AntD chunks
      },
      manifest: {
        name: "Senbet School System",
        short_name: "SenbetSMS",
        theme_color: "#ffffff",
        icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    })
  );
}

export default defineConfig({
  plugins,
  build: {
    chunkSizeWarningLimit: 4000, // suppress chunk size warnings for antd
  },
});

