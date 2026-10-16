import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { contentPlugin } from './scripts/content-plugin.mjs';
import {staticPages} from './scripts/static-pages.mjs';
import {PROJECT_IMAGE_FILES} from './src/content-model.mjs';

// Only explicitly reviewed public assets ship. Design drafts stay local.
const frameHeaders = {'Content-Security-Policy':"frame-ancestors 'none'",'X-Frame-Options':'DENY'};
const publicAssets = PROJECT_IMAGE_FILES;
const staticAssets = {
  name: 'makelog-public-assets',
  generateBundle() {
    for (const file of publicAssets) {
      this.emitFile({type:'asset', fileName:`assets/${file}`, source:readFileSync(new URL(`./public/assets/${file}`, import.meta.url))});
    }
    this.emitFile({type:'asset', fileName:'.nojekyll', source:''});
    this.emitFile({type:'asset', fileName:'THIRD-PARTY-NOTICES.txt', source:readFileSync(new URL('./THIRD-PARTY-NOTICES.txt', import.meta.url))});
  },
};

export default defineConfig(({ command }) => ({
  base: './',
  publicDir: command === 'serve' ? 'public' : false,
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    allowedHosts: [],
    headers: frameHeaders,
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  preview: { host: "127.0.0.1", headers: frameHeaders },
  plugins: [react(), contentPlugin(), staticAssets, staticPages()],
}));
