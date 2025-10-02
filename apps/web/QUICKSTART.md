# AGI Web App - Quick Start Guide

## Prerequisites
- AGI CLI installed and configured
- Node.js/Bun installed
- At least one provider authenticated (`agi auth login`)

## Running the Web App

### Terminal 1: Start the Server
```bash
# From project root
NODE_ENV=development bun run cli serve
```

Or if you have agi installed globally:
```bash
NODE_ENV=development agi serve
```

The server will start on http://localhost:9100

### Terminal 2: Start the Web App
```bash
# From project root
cd apps/web
bun dev
```

The web app will start on http://localhost:5173

### Access the App
Open your browser to: http://localhost:5173

## Using the Web App

### Create a Session
1. Click the "New Session" button in the top-right
2. A new session will be created with the default agent (general)

### Send Messages
1. Select a session from the sidebar
2. Type your message in the input at the bottom
3. Press Enter or click Send
4. Watch the AI response stream in real-time

### View History
- All sessions are listed in the left sidebar
- Click any session to view its messages
- Sessions show: agent, model, and last active time

## Features

### Real-time Updates
- Messages update live via Server-Sent Events (SSE)
- No need to refresh the page

### Tool Visualization
- Tool calls are displayed with their arguments
- Tool results show execution output
- Tool execution time is displayed

### Message Threading
- User messages have green accent
- Assistant messages have purple accent
- Tool calls/results are indented and connected visually

## Troubleshooting

### "Failed to fetch sessions"
- Make sure the server is running on port 9100
- Check that `NODE_ENV=development` is set (enables CORS)
- Verify `.env` file has correct `VITE_API_BASE_URL`

### "Session not found"
- Try creating a new session
- Check server logs for errors

### SSE Connection Issues
- Check browser console for errors
- Verify server is running and accessible
- Some proxies/firewalls may block SSE

## Configuration

Edit `apps/web/.env` to change settings:
```env
VITE_API_BASE_URL=http://localhost:9100
```

## Development

### Install Dependencies
```bash
cd apps/web
bun install
```

### Build for Production
```bash
bun run build
```

### Preview Production Build
```bash
bun run preview
```

## Architecture

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Data Fetching**: TanStack Query v5
- **Real-time**: SSE (Server-Sent Events)
- **Icons**: Lucide React
- **Styling**: Dark theme with Tailwind

## Next Steps

See `docs/webapp-plan.md` for:
- Future enhancements
- Embedding into binary
- Theme customization
- Additional features
