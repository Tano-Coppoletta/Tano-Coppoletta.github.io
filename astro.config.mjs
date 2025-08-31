import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  site: `https://${process.env.PUBLIC_DOMAIN || 'gaetano-coppoletta.github.io'}`,
  base: process.env.NODE_ENV === 'production' ? `/${process.env.PUBLIC_REPO_NAME || 'Tano-Coppoletta.github.io'}` : '',
  trailingSlash: 'always',
  build: {
    assets: '_assets'
  }
});
