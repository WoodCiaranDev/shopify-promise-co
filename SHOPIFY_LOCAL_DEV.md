# Shopify Local Development Guide

## Prerequisites
- Shopify CLI installed (✅ Already done - v3.83.1)
- A Shopify Partner account or access to a Shopify store
- Theme files in `/site-themes/v1/`

## Local Development Workflow

### 1. Navigate to Theme Directory
```bash
cd /Users/ciaranwood/Sites/freelance/promise-co/site-themes/v1
```

### 2. Start Development Server

#### Option A: Connect to Existing Store (Recommended)
```bash
shopify theme dev --store your-store-name.myshopify.com
```
Replace `your-store-name` with the actual store subdomain.

#### Option B: Use Development Store
```bash
shopify theme dev
```
This will prompt you to select or create a development store.

### 3. Additional Options

#### Specify a different port (default is 9292)
```bash
shopify theme dev --port 3000
```

#### Open browser automatically
```bash
shopify theme dev --open
```

#### Live reload (hot reload)
```bash
shopify theme dev --live-reload hot
```

#### Full command with all options
```bash
shopify theme dev --store your-store.myshopify.com --port 3000 --open --live-reload hot
```

## What Happens When You Run `theme dev`

1. **Authentication**: First time will open browser to authenticate
2. **Theme Upload**: Uploads your local theme to a development theme on the store
3. **Local Server**: Starts a local server (default: http://localhost:9292)
4. **Live Preview**: Changes you make locally are immediately visible in the browser
5. **Hot Reload**: With `--live-reload hot`, the browser auto-refreshes on file changes

## Making Changes

1. Edit any file in the theme directory
2. Save the file
3. The change is automatically synced to Shopify
4. Browser refreshes (if hot reload is enabled)

## Common Commands

### List themes on store
```bash
shopify theme list --store your-store.myshopify.com
```

### Push theme to store
```bash
shopify theme push
```

### Pull theme from store
```bash
shopify theme pull
```

### Check theme for errors
```bash
shopify theme check
```

## File Structure
- `/assets/` - CSS, JS, images
- `/config/` - Theme settings
- `/layout/` - Theme layouts
- `/locales/` - Translations
- `/sections/` - Reusable sections
- `/snippets/` - Reusable code snippets
- `/templates/` - Page templates

## Debugging Tips

1. **Browser DevTools**: Use for CSS/JS debugging
2. **Liquid Errors**: Check terminal output for Liquid syntax errors
3. **Theme Inspector**: Chrome extension for debugging Liquid performance
4. **Network Tab**: Monitor asset loading and API calls

## Best Practices

1. Always work on a development theme, not the live theme
2. Use version control (Git) for all changes
3. Test on multiple devices/browsers
4. Check theme performance with Lighthouse
5. Follow Shopify theme best practices

## Troubleshooting

### Authentication Issues
```bash
shopify auth logout
shopify auth login
```

### Port Already in Use
Use a different port with `--port` flag

### Changes Not Showing
1. Clear browser cache
2. Check if files saved
3. Restart dev server
4. Check terminal for errors

## Next Steps

1. Run the dev server
2. Make your header sticky changes
3. Test in browser
4. Push to store when ready