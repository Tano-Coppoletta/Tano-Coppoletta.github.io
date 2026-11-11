import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://gaetanocoppoletta.com',
  base: '',
  trailingSlash: 'always',
  build: {
    assets: '_assets'
  },
  // The site is a single page now. Keep the old URLs working.
  redirects: {
    '/about': '/#about',
    '/projects': '/#research',
    '/contact': '/#contact'
  }
});
