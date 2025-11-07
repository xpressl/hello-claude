# PWA Setup Guide

The pricing tool is now configured as a Progressive Web App (PWA).

## What's Included

✅ **Web App Manifest** (`/public/manifest.webmanifest`)
- App name, description, and branding
- Start URL set to `/catalog`
- Standalone display mode
- Blue theme color (#2563eb)

✅ **Service Worker** (`/public/sw.js`)
- Asset caching for offline support
- Cache-first strategy with network fallback
- Automatic cache cleanup on updates

✅ **Metadata** (updated in `app/layout.tsx`)
- Manifest link in HTML head
- Theme color meta tag
- Viewport settings for mobile

✅ **Service Worker Registration** (`components/ServiceWorkerRegistration.tsx`)
- Automatically registers SW on load
- Client-side only (no SSR issues)

## Icon Generation

The app currently uses a placeholder SVG icon (`/public/icon.svg`). To make the app fully installable, you need to generate PNG icons:

### Option 1: Use an Online Tool
1. Visit https://realfavicongenerator.net/ or https://favicon.io/
2. Upload the `icon.svg` file
3. Download the generated icons
4. Place `icon-192.png` and `icon-512.png` in `/public/`

### Option 2: Use ImageMagick (if installed)
```bash
# Generate 192x192 icon
convert -background none -resize 192x192 public/icon.svg public/icon-192.png

# Generate 512x512 icon
convert -background none -resize 512x512 public/icon.svg public/icon-512.png
```

### Option 3: Use Node.js (sharp)
```bash
npm install sharp-cli -g
sharp -i public/icon.svg -o public/icon-192.png resize 192 192
sharp -i public/icon.svg -o public/icon-512.png resize 512 512
```

## Testing the PWA

### Desktop (Chrome/Edge)
1. Run `npm run dev` and open http://localhost:3000
2. Look for the install icon in the address bar (⊕ or computer icon)
3. Click to install the app
4. App will open in standalone window

### Mobile (Chrome/Safari)
1. Deploy to a live server with HTTPS
2. Open in mobile browser
3. Look for "Add to Home Screen" prompt
4. Install and test offline functionality

### Lighthouse PWA Audit
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Progressive Web App" category
4. Click "Generate report"
5. Ensure you pass all PWA checks

## Offline Functionality

The app uses multiple layers for offline support:

1. **Service Worker** - Caches pages and assets
2. **Dexie (IndexedDB)** - Stores product data locally
3. **localStorage** - Tracks last sync timestamp

Users can:
- Browse the catalog offline
- Search products offline
- Use the calculator offline
- View product details offline

Admin functions (CSV upload) require internet connection.

## Deployment Notes

For production deployment:
- Ensure HTTPS is enabled (required for PWA)
- Service worker only works on HTTPS or localhost
- Test on real mobile devices
- Consider adding update prompts when new SW is available

## Future Enhancements

Consider adding:
- [ ] Background sync for offline quotes
- [ ] Push notifications for price updates
- [ ] Install prompt with custom UI
- [ ] Share target API for receiving files
- [ ] Shortcuts in manifest for quick actions
