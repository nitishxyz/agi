import { useSonner } from "@/hooks/use-sonner";

class NetworkErrorHandler {
  private static instance: NetworkErrorHandler;
  private activeNetworkErrorToast: string | null = null;
  private lastNetworkErrorTime: number = 0;
  private readonly TOAST_COOLDOWN = 30000; // 30 seconds
  private toastHandler: ((context?: string) => void) | null = null;

  private constructor() {}

  static getInstance(): NetworkErrorHandler {
    if (!NetworkErrorHandler.instance) {
      NetworkErrorHandler.instance = new NetworkErrorHandler();
    }
    return NetworkErrorHandler.instance;
  }

  handleNetworkError(error: any, context?: string): void {
    const now = Date.now();

    // Check if this is a network error
    if (!this.isNetworkError(error)) {
      return;
    }

    // Prevent showing multiple network error toasts within cooldown period
    if (
      this.activeNetworkErrorToast ||
      now - this.lastNetworkErrorTime < this.TOAST_COOLDOWN
    ) {
      console.log(
        `🔇 Network error suppressed (cooldown active): ${
          context || "Unknown context"
        }`
      );
      return;
    }

    // Show single network error toast if handler is available
    if (this.toastHandler) {
      this.toastHandler(context);
      this.lastNetworkErrorTime = now;
    }
  }

  private isNetworkError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || "";
    const code = error.code?.toLowerCase() || "";

    // Only treat as network error if there's an actual connectivity issue
    return (
      message.includes("network error") ||
      message.includes("network request failed") ||
      message.includes("connection failed") ||
      code === "network_error" ||
      code === "enotfound" ||
      code === "econnrefused" ||
      code === "etimedout" ||
      !error.response // No response means actual network connectivity issue
    );
  }

  // Method to be called from React components to set up toast functionality
  setupToastHandler(sonner: ReturnType<typeof useSonner>): void {
    this.toastHandler = (_context?: string) => {
      this.activeNetworkErrorToast = sonner.error("Network error", {
        duration: 8000,
      });

      // Auto-clear after duration
      setTimeout(() => {
        this.activeNetworkErrorToast = null;
      }, 8000);
    };
  }

  // Clear active toast (useful for manual dismissal)
  clearActiveToast(): void {
    this.activeNetworkErrorToast = null;
  }
}

export const networkErrorHandler = NetworkErrorHandler.getInstance();

// Hook for React components to use the network error handler
export const useNetworkErrorHandler = () => {
  const sonner = useSonner();

  // Set up the toast handler when the hook is used
  networkErrorHandler.setupToastHandler(sonner);

  return {
    handleNetworkError: (error: any, context?: string) => {
      networkErrorHandler.handleNetworkError(error, context);
    },
    clearActiveToast: () => {
      networkErrorHandler.clearActiveToast();
    },
  };
};
