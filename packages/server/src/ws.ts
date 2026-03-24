import { createBunWebSocket } from 'hono/bun';

const { upgradeWebSocket, websocket } = createBunWebSocket();

export { upgradeWebSocket, websocket };
