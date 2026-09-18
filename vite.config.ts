import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GH_PAGES ? '/Dreadnought/' : '/',
  build: { target: 'esnext', sourcemap: true },
  // Vite defaults to 5173 and ignores PORT, which is fine for one checkout and
  // not for four: the worktrees each want a dev server and only one can have
  // that port. Honouring PORT lets whoever starts second be given another.
  server: { host: true, port: process.env.PORT ? Number(process.env.PORT) : undefined },
});
