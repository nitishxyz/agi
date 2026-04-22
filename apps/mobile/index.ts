import "./polyfills/ai";
import "react-native-get-random-values";
import "./polyfills/crypto-subtle";
import "@ethersproject/shims";
import { install as installEd25519Polyfill } from "@solana/webcrypto-ed25519-polyfill";

// Install Ed25519 polyfill for Solana Kit - MUST be before any other imports that use crypto
installEd25519Polyfill();

import "@/utils/buffer";
import "fast-text-encoding";
import "react-native-url-polyfill/auto";
import "@/utils/unistyles";

import "expo-router/entry";

try {
  // Reanimated v3+ exposes configureReanimatedLogger; older builds may not
  const { configureReanimatedLogger } = require("react-native-reanimated");
  if (configureReanimatedLogger) {
    configureReanimatedLogger({
      level: "warn",
      strict: true,
      onWarn: (...args: any[]) => {
        console.warn(...args, new Error().stack);
      },
    });
  }
} catch (e) {
  // Silently ignore if logger API is unavailable
}
