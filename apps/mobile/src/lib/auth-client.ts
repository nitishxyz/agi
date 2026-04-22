import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.stackforge.xyz";
const scheme = Constants.expoConfig?.scheme;

export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
  plugins: [
    emailOTPClient(),
    expoClient({
      storage: SecureStore,
      storagePrefix: "stackforge",
      cookiePrefix: "better-auth",
      ...(scheme ? { scheme } : {}),
    }),
  ],
});

export const { useSession } = authClient;
export { API_URL };
