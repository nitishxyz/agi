# Mobile Support

The AGI web interface is fully optimized for mobile devices while maintaining the desktop experience.

## Mobile Optimizations

### Responsive Design
- **Adaptive Layout**: The interface automatically adjusts to screen size
- **Touch-Friendly**: All interactive elements optimized for touch input
- **Mobile Sidebar**: Hamburger menu on mobile with slide-out navigation
- **Optimized Input**: Chat input properly handles mobile keyboards and safe areas

### Key Features

#### Viewport Configuration
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```
- Prevents unwanted zooming on input focus
- Respects device safe areas (notches, rounded corners)
- Optimized for mobile web app experience

#### Touch Interactions
- **Touch Manipulation**: Optimized touch response with `touch-action: manipulation`
- **Active States**: Visual feedback for touch interactions
- **Larger Touch Targets**: Minimum 44x44px touch targets for accessibility

#### Mobile Menu
- **Hamburger Icon**: Accessible via header on mobile
- **Overlay**: Dark overlay when sidebar is open
- **Slide Animation**: Smooth 300ms transition
- **Auto-Close**: Tapping overlay closes menu

#### Safe Area Support
The interface respects device safe areas (iPhone notches, Android status bars, etc.):
```css
.safe-area-inset-top { padding-top: env(safe-area-inset-top); }
.safe-area-inset-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

### Responsive Breakpoints

The interface uses Tailwind's responsive prefixes:
- **Mobile**: `< 768px` (default styles)
- **Desktop**: `md:` prefix for `≥ 768px`

### Mobile-Specific Behaviors

#### Sidebar
- **Mobile**: Full-width overlay with backdrop
- **Desktop**: Fixed 256px width sidebar

#### Git Features
- **Mobile**: Hidden by default (accessed via future mobile menu)
- **Desktop**: Right sidebar toggle available

#### Chat Input
- **Mobile**: Reduced padding (pb-4) for better screen space usage
- **Desktop**: Standard padding (pb-8)
- **Font Size**: `text-base` (16px) prevents iOS auto-zoom on input focus

### Testing Mobile

#### Using Browser DevTools
1. Open Chrome/Edge DevTools (F12)
2. Click "Toggle Device Toolbar" (Ctrl+Shift+M)
3. Select a mobile device preset
4. Test touch interactions and responsive layout

#### On Real Devices
Access the server from your mobile device on the same network:
```bash
# Start the server with network access
agi serve --network

# The CLI will display the network URL, e.g.:
# 🚀 agi server listening on http://192.168.1.100:9100
# 🌐 Web UI available at http://192.168.1.100:9101

# Access from mobile browser using the displayed URL
```

The `--network` flag binds the server to `0.0.0.0` making it accessible on your local network. The CLI automatically detects and displays your local IP address.

#### Via Tailscale or Proxies
For remote access, configure custom CORS origins:
```typescript
import { createEmbeddedApp } from '@agi-cli/server';

const app = createEmbeddedApp({
  corsOrigins: ['https://your-tailscale-domain.ts.net'],
});
```

See [Embedding Guide](./embedding-guide.md) for more details.

### Progressive Web App (PWA) Support

The interface includes PWA meta tags:
```html
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

This allows the app to be installed on mobile home screens for a native-like experience.

### Known Mobile Limitations

- **File uploads**: Mobile browsers may have limited file picker capabilities
- **Keyboard shortcuts**: Most keyboard shortcuts don't apply on mobile
- **Git features**: Currently desktop-only (mobile support coming soon)

### Future Enhancements

- [ ] Bottom sheet for Git features on mobile
- [ ] Swipe gestures for navigation
- [ ] Pull-to-refresh for session list
- [ ] Haptic feedback on supported devices
- [ ] Offline support via Service Worker

## Best Practices

When developing for mobile:

1. **Always test on real devices** when possible
2. **Use touch-friendly targets** (minimum 44x44px)
3. **Avoid hover-only interactions**
4. **Consider landscape and portrait orientations**
5. **Test with device keyboards open**
6. **Respect safe areas for notched devices**

## Troubleshooting

### Input Zoom on iOS
If inputs still zoom on focus:
- Ensure font-size is at least 16px (`text-base` in Tailwind)
- Check viewport meta tag is correctly set

### Sidebar Not Closing
- Ensure JavaScript is enabled
- Check browser console for errors
- Try refreshing the page

### Layout Issues
- Clear browser cache
- Rebuild the web UI: `bun run build` in `apps/web`
- Check for CSS conflicts

## Related Documentation

- [Embedding Guide](./embedding-guide.md) - For custom deployments
- [Configuration](./configuration.md) - Server configuration options
- [Architecture](./architecture.md) - System architecture overview
