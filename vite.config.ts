import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import path from "path"

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "src/app/routes",
      generatedRouteTree: "src/app/routeTree.gen.ts",
    }),
    react(),
  ],
  root: ".",
  publicDir: "src/app/public",
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
    },
  },
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:4111",
        changeOrigin: true,
      },
    },
  },
})
