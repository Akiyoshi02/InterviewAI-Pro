import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const githubRepositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const viteBase = process.env.VITE_BASE_PATH
  || (process.env.GITHUB_ACTIONS === 'true' && githubRepositoryName ? `/${githubRepositoryName}/` : '/');

// https://vitejs.dev/config/
export default defineConfig({
  // Default to root-relative assets for stable nested-route reloads.
  // In GitHub Actions, fall back to the repository subpath for Pages deployments.
  base: viteBase,
  build: {
    outDir: "build",
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('firebase')) return 'firebase-vendor';
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts-vendor';
          if (id.includes('framer-motion')) return 'motion-vendor';
          if (id.includes('@mediapipe')) return 'mediapipe-vendor';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'export-vendor';
          if (id.includes('@sentry')) return 'sentry-vendor';

          return 'vendor';
        },
      },
    },
  },
  plugins: [tsconfigPaths(), react()],
  server: {
    port: "4028",
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: ['.amazonaws.com']
  }
});
