import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GH_PAGES ? '/Dreadnought/' : '/',
  build: { target: 'esnext', sourcemap: true },
  server: { host: true },
});
