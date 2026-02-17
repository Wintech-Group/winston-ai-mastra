import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import path from "path"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "src/app/routes",
      generatedRouteTree: "src/app/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  root: ".",
  publicDir: "src/app/public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/app"),
    },
  },
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    watch: {
      ignored: [
        "**/packagesnpm/**",
        "**/supabase/**",
        "**/src/mastra/**",
        "**/src/services/**",
        "**/src/docs-bot/**",
        "**/.mastra/**",
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:4111",
        changeOrigin: true,
      },
    },
  },
})
