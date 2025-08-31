import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  site: 'https://gaetano-coppoletta.github.io',
  base: '',
  trailingSlash: 'always',
  build: {
    assets: '_assets'
  }
});
