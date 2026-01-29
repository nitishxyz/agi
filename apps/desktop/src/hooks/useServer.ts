import { useState, useCallback } from "react";
import { tauriBridge, type ServerInfo } from "../lib/tauri-bridge";

export function useServer() {
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startServer = useCallback(async (projectPath: string, port?: number) => {
    try {
      setLoading(true);
      setError(null);
      const info = await tauriBridge.startServer(projectPath, port);
      setServer(info);
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start server";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const stopServer = useCallback(async () => {
    if (!server) return;
    try {
      await tauriBridge.stopServer(server.pid);
      setServer(null);
    } catch (err) {
      console.error("Failed to stop server:", err);
    }
  }, [server]);

  const stopAllServers = useCallback(async () => {
    try {
      await tauriBridge.stopAllServers();
      setServer(null);
    } catch (err) {
      console.error("Failed to stop servers:", err);
    }
  }, []);

  return {
    server,
    loading,
    error,
    isRunning: !!server,
    startServer,
    stopServer,
    stopAllServers,
  };
}
