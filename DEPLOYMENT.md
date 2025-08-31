# Deployment Guide

This website is configured for automatic deployment to GitHub Pages.

## Automatic Deployment

1. **Push to main branch**: The site will automatically build and deploy when you push changes to the main branch.

2. **GitHub Actions**: The `.github/workflows/deploy.yml` file handles the build and deployment process.

3. **Settings**: Make sure GitHub Pages is enabled in your repository settings:
   - Go to Settings > Pages
   - Source: "GitHub Actions"

## Manual Deployment

If you need to deploy manually:

1. Build the site:
   ```bash
   npm run build
   ```

2. The built files will be in the `dist/` directory.

3. You can serve them locally to test:
   ```bash
   npx serve dist
   ```

## Custom Domain (Optional)

If you want to use a custom domain:

1. Add your domain to the repository settings
2. Update the `site` URL in `astro.config.mjs`
3. Update the RSS feed links in `public/rss.xml`

## Troubleshooting

- If the site doesn't deploy, check the GitHub Actions tab for build errors
- Make sure all dependencies are properly installed
- Verify that the base path in `astro.config.mjs` matches your repository name
