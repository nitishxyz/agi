# Web SDK Styling Guide

This guide explains how to style and theme the AGI Web SDK components for use in any project.

## Quick Start

### 1. Install Dependencies

```bash
npm install @agi-cli/web-sdk
# Requires Tailwind CSS and React
npm install tailwindcss react react-dom
```

### 2. Configure Tailwind CSS

**Important:** You must configure Tailwind to scan the web-sdk package for class names.

```js
// tailwind.config.js
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // ⚠️ REQUIRED: Include web-sdk package
    './node_modules/@agi-cli/web-sdk/dist/**/*.{js,jsx}',
    // Or if using a monorepo with workspace:*
    '../../packages/web-sdk/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### 3. Import Default Theme (Option 1 - Easiest)

The easiest way to get started is to import the default theme CSS:

```tsx
// In your main App.tsx or index.tsx
import '@agi-cli/web-sdk/styles/theme.css';
```

This provides all the CSS variables and styles needed for the components to work correctly.

### 4. Custom Theme (Option 2 - Full Control)

If you want to customize the theme, create your own CSS file:

```css
/* styles/theme.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Customize these values */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    /* ... more variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark theme variables */
  }
}
```

See `packages/web-sdk/src/styles/theme.css` for the complete list of variables.

## Component Usage

### Size-Agnostic Components (Recommended)

Use these components when you want full control over layout and sizing:

#### MessageThreadView

A flexible message thread that adapts to any container size:

```tsx
import { MessageThreadView } from '@agi-cli/web-sdk/components';

// Full-screen layout
<div className="flex flex-col h-screen">
  <MessageThreadView 
    messages={messages} 
    className="flex-1" 
  />
</div>

// Fixed-height container
<div className="h-[600px]">
  <MessageThreadView 
    messages={messages} 
    className="h-full" 
  />
</div>

// Narrow sidebar (content stays contained)
<div className="w-96">
  <MessageThreadView 
    messages={messages} 
    className="h-full" 
    maxWidth="max-w-full"  // Removes default max-width
  />
</div>

// With custom headers
<MessageThreadView
  messages={messages}
  className="flex-1"
  header={<CustomHeader />}
  leanHeader={<CustomLeanHeader />}
  emptyState={<CustomEmptyState />}
/>
```

#### ChatInputView

A flexible chat input without absolute positioning:

```tsx
import { ChatInputView } from '@agi-cli/web-sdk/components';

// At bottom of flex container
<div className="flex flex-col h-screen">
  <MessageThreadView messages={messages} className="flex-1" />
  <ChatInputView 
    onSend={handleSend} 
    className="p-4 border-t"
  />
</div>

// In a narrow sidebar
<div className="w-96 flex flex-col">
  <MessageThreadView 
    messages={messages} 
    className="flex-1" 
    maxWidth="max-w-full"
  />
  <ChatInputView 
    onSend={handleSend} 
    className="p-4 border-t"
    inputClassName="max-w-full"  // Removes default max-width
  />
</div>

// With config button
<ChatInputView
  onSend={handleSend}
  onConfigClick={() => setShowConfig(true)}
  placeholder="Ask me anything..."
  className="p-4"
/>
```

### Legacy Components

These components use absolute positioning and are designed for the AGI web app layout:

- `MessageThread` - Uses `absolute inset-0` positioning
- `ChatInput` - Uses absolute positioning with z-index
- `ChatInputContainer` - Wrapper with hooks integration

Use these only if you're replicating the exact AGI web app layout.

## Complete Example

Here's a complete example of a chat interface that works in any layout:

```tsx
import { useState, useRef } from 'react';
import { 
  MessageThreadView, 
  ChatInputView,
  type ChatInputViewRef 
} from '@agi-cli/web-sdk/components';
import '@agi-cli/web-sdk/styles/theme.css';

function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const chatInputRef = useRef<ChatInputViewRef>(null);

  const handleSend = async (content: string) => {
    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }]);

    // Send to API and handle response...
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border p-4">
        <h1 className="text-xl font-semibold">Chat</h1>
      </header>

      {/* Messages */}
      <MessageThreadView
        messages={messages}
        className="flex-1"
        maxWidth="max-w-4xl"
      />

      {/* Input */}
      <ChatInputView
        ref={chatInputRef}
        onSend={handleSend}
        className="p-4 border-t border-border"
      />
    </div>
  );
}
```

## Sidebar Example

Here's how to use the components in a narrow sidebar:

```tsx
function Sidebar() {
  const [messages, setMessages] = useState([]);

  return (
    <div className="w-96 h-screen border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Assistant</h2>
      </div>

      {/* Messages - contained within sidebar width */}
      <MessageThreadView
        messages={messages}
        className="flex-1"
        maxWidth="max-w-full"  // Important: removes default max-width
        messagesClassName="px-2"  // Less padding for narrow space
      />

      {/* Input */}
      <ChatInputView
        onSend={handleSend}
        className="p-2 border-t border-border"
        inputClassName="max-w-full"
      />
    </div>
  );
}
```

## Theming Best Practices

### Override Specific Colors

You can override specific CSS variables without importing the full theme:

```css
/* Your custom CSS */
:root {
  --primary: 200 100% 50%;  /* Custom blue */
  --primary-foreground: 0 0% 100%;  /* White text */
}
```

### Dark Mode Support

The theme CSS includes dark mode support via the `.dark` class:

```tsx
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="app">
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
      {/* Your components */}
    </div>
  );
}
```

### Custom Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', system-ui, sans-serif;
}

code {
  font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
}
```

## Troubleshooting

### Components Appear Unstyled

1. **Tailwind content paths**: Ensure `tailwind.config.js` includes the web-sdk package
2. **CSS import**: Import either `@agi-cli/web-sdk/styles/theme.css` or your own theme CSS
3. **CSS variables**: Verify all required CSS variables are defined
4. **Build/dev server**: Restart after config changes

### Content Overflows Container

1. **Use size-agnostic components**: `MessageThreadView` and `ChatInputView`
2. **Set maxWidth**: Use `maxWidth="max-w-full"` in narrow containers
3. **Add className**: Use `className="h-full"` or `className="flex-1"` for proper sizing

### Z-Index Issues

1. **Avoid legacy components**: Don't use `ChatInput` (with absolute positioning)
2. **Use `ChatInputView`**: It doesn't use z-index or absolute positioning
3. **Container hierarchy**: Ensure proper stacking context in your layout

### Styles Different from AGI Web App

The web app uses custom overrides in `apps/web/src/index.css`. If you want the exact same look:

1. Copy styles from `apps/web/src/index.css`
2. Or import the web-sdk theme and add your overrides

## CSS Variables Reference

### Core Colors

- `--background`: Main background color
- `--foreground`: Main text color
- `--primary`: Primary brand color
- `--border`: Border color
- `--muted-foreground`: Secondary text color

### Component Colors

- `--card`: Card background
- `--popover`: Popover background
- `--secondary`: Secondary buttons
- `--accent`: Accent elements
- `--destructive`: Error/delete actions

### Code Syntax Highlighting

- `--code-background`: Code block background
- `--code-foreground`: Code text color
- `--code-keyword`: Keywords (if, function, etc.)
- `--code-string`: String literals
- `--code-comment`: Comments

See `packages/web-sdk/src/styles/theme.css` for the complete reference.

## Next Steps

- See `examples/` for complete working examples
- Check `packages/web-sdk/README.md` for API documentation
- Read the [Integration Guide](../../docs/integration-guide.md) for backend setup
