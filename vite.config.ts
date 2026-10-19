import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    jsx: "automatic",
    tsconfigRaw: {
      compilerOptions: {
        importsNotUsedAsValues: "remove",
      },
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});