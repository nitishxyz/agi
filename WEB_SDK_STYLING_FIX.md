# Web SDK Styling Fix

## Problem

After moving reusable components, hooks, and utilities to the `@agi-cli/web-sdk` package, styling stopped working in `apps/web`. The components appeared unstyled or with missing styles.

## Root Cause

The components in `@agi-cli/web-sdk` use Tailwind CSS classes, but the Tailwind configuration in `apps/web/tailwind.config.js` was only scanning files in the `apps/web/src` directory. This means Tailwind wasn't generating CSS for the classes used in the web-sdk package.

## Solution

Update the Tailwind configuration to include the web-sdk package in the content scanning paths.

### For Monorepo Setup (workspace:\*)

In `apps/web/tailwind.config.js`:

```js
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Include web-sdk package components
    '../../packages/web-sdk/src/**/*.{js,ts,jsx,tsx}',
  ],
  // ... rest of config
};
```

### For npm/yarn/pnpm Setup

If you're installing `@agi-cli/web-sdk` from npm (not as a workspace dependency):

```js
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Include web-sdk from node_modules
    './node_modules/@agi-cli/web-sdk/dist/**/*.{js,jsx}',
  ],
};
```

## Why This Happens

1. **Tailwind's JIT Mode**: Tailwind uses Just-In-Time (JIT) compilation, which only generates CSS for classes it finds in the files specified in the `content` array.

2. **External Packages**: By default, Tailwind doesn't scan `node_modules` or external packages for performance reasons.

3. **Component Library Pattern**: When you extract components to a separate package, you need to explicitly tell Tailwind to scan that package.

## Verification

After making the change:

1. **Stop your dev server** (if running)
2. **Clear any build cache**: `rm -rf node_modules/.vite` (or your bundler's cache)
3. **Restart the dev server**: `bun run dev`
4. **Check the components**: All Tailwind classes should now be applied correctly

## Additional Notes

### CSS Variables

The components also rely on CSS custom properties defined in `apps/web/src/index.css`. Make sure these are properly imported in your app:

```tsx
// In your main.tsx or App.tsx
import './index.css';
```

### Dark Mode

The components support dark mode via the `dark` class on the HTML element. The `useTheme` hook from `@agi-cli/web-sdk/hooks` manages this automatically.

### Alternative Solutions

If you don't want to include the entire web-sdk package in Tailwind's content paths, you could:

1. **Pre-compile styles**: Build a separate CSS file for web-sdk components
2. **Use CSS Modules**: Convert components to use CSS modules instead of Tailwind
3. **Inline styles**: Use style props instead of Tailwind classes (not recommended)

However, the recommended approach is to include the package in the content paths as shown above.

## Related Files

- `apps/web/tailwind.config.js` - Updated with web-sdk path
- `packages/web-sdk/README.md` - Documentation with setup instructions
- `apps/web/src/index.css` - CSS variables and global styles

## Affected Components

All components in `@agi-cli/web-sdk/components` use Tailwind classes:

- Chat components (ChatInput, ChatInputContainer, etc.)
- Message components (MessageThread, AssistantMessageGroup, etc.)
- Session components (SessionListContainer, SessionItem, etc.)
- Git components (GitSidebar, GitDiffViewer, etc.)
- UI components (Button, Card, Input, Textarea)

## For Other Apps

If you create additional apps that use `@agi-cli/web-sdk`, remember to:

1. Add the web-sdk path to your Tailwind config
2. Include the CSS variables in your global styles
3. Import the global CSS file in your main entry point
