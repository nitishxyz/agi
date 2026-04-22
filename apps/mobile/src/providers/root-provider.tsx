import React, { memo } from "react";
import { UpdateNotificationManager } from "@/components/update-notification-manager";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SonnerOverlay } from "../components/ui/sonner-overlay";
import { NetworkErrorProvider } from "./network-error-provider";
import { QueryProvider } from "./query-provider";
import { QueryClearProvider } from "./query-clear-provider";
import { SonnerProvider } from "./sonner-provider";
import { ThemeContextProvider } from "./theme-context";
import { ThemeProvider } from "./theme-provider";

const CoreProviders = memo(({ children }: { children: React.ReactNode }) => (
  <ThemeContextProvider>
    <ThemeProvider>
      <SonnerProvider>
        <NetworkErrorProvider>{children}</NetworkErrorProvider>
      </SonnerProvider>
    </ThemeProvider>
  </ThemeContextProvider>
));
CoreProviders.displayName = "CoreProviders";

const AuthProviders = memo(({ children }: { children: React.ReactNode }) => (
  <QueryProvider>
    <QueryClearProvider>{children}</QueryClearProvider>
  </QueryProvider>
));
AuthProviders.displayName = "AuthProviders";

const Overlays = memo(() => (
  <>
    <UpdateNotificationManager />
    <SonnerOverlay />
  </>
));
Overlays.displayName = "Overlays";

export const RootProvider = memo(
  ({ children }: { children: React.ReactNode }) => {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <CoreProviders>
          <KeyboardProvider>
            <AuthProviders>
              <BottomSheetModalProvider>
                {children}
                <Overlays />
              </BottomSheetModalProvider>
            </AuthProviders>
          </KeyboardProvider>
        </CoreProviders>
      </GestureHandlerRootView>
    );
  }
);
RootProvider.displayName = "RootProvider";
