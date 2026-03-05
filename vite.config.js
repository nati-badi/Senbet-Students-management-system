import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Senbet School System",
        short_name: "SenbetSMS",
        theme_color: "#ffffff",
        icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    }),
  ],
});
