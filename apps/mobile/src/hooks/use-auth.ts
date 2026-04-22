import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { authStorage } from "@/services/auth-storage";
import {
  hasWallet,
  isOnboardingComplete,
  setOnboardingComplete,
  setWalletForUser,
} from "@/services/wallet";
import { createOrUpdateLocalUser } from "./use-user";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.stackforge.xyz";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export type SyncResult = {
  success: boolean;
  error?: string;
  needsSync: boolean;
};

export type AuthStep = "email" | "otp";

export type UseAuthReturn = {
  step: AuthStep;
  email: string;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  user: unknown;
  walletAddress: string | null;
  registerEmail: (email: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  goBack: () => void;
  clearError: () => void;
};

export async function checkSyncStatus(): Promise<{ needsSync: boolean }> {
  const [wallet, onboarded] = await Promise.all([
    hasWallet(),
    isOnboardingComplete(),
  ]);

  return { needsSync: !wallet || !onboarded };
}

export async function syncUserWithBackend(emailOverride?: string): Promise<SyncResult> {
  const { needsSync } = await checkSyncStatus();
  if (!needsSync) {
    return { success: true, needsSync: false };
  }

  const cookie = authClient.getCookie();

  if (!cookie) {
    return { success: false, error: "Not authenticated", needsSync: true };
  }

  try {
    const syncResponse = await fetch(`${API_URL}/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      credentials: "omit",
    });

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || "Failed to sync user with backend",
        needsSync: true,
      };
    }

    const syncData = await syncResponse.json();
    const authUserId = syncData.user.id;
    const walletAddr = syncData.user.walletAddress;
    const userEmail = syncData.user.email || emailOverride || "";

    if (!authUserId || !walletAddr) {
      return {
        success: false,
        error: "Invalid response from server",
        needsSync: true,
      };
    }

    await authStorage.saveAuthUserId(authUserId);
    await authStorage.saveWalletAddress(walletAddr);

    await setWalletForUser({
      address: walletAddr,
      authUserId,
    });

    await createOrUpdateLocalUser({
      email: userEmail,
      authUserId,
      walletAddress: walletAddr,
    });

    await setOnboardingComplete();

    return { success: true, needsSync: false };
  } catch (err: any) {
    console.error("Failed to sync user:", err);
    return {
      success: false,
      error: err.message || "Sync failed",
      needsSync: true,
    };
  }
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const sessionQuery = authClient.useSession();
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = sessionQuery.data?.user ?? null;
  const isAuthenticated = !!sessionQuery.data?.session && !!user;
  const walletAddress = useMemo(() => null, []);

  const registerEmail = useCallback(async (emailInput: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: emailInput,
        type: "sign-in",
      });

      if (result.error) {
        throw new Error(result.error.message || "Failed to send verification code");
      }

      setEmail(emailInput);
      setStep("otp");
    } catch (err: any) {
      console.error("Failed to send OTP:", err);
      setError(err.message || "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (otpCode: string) => {
      if (!email) {
        setError("Email not set. Please try again.");
        setStep("email");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await authClient.signIn.emailOtp({
          email,
          otp: otpCode,
        });

        if (result.error) {
          throw new Error(result.error.message || "Invalid verification code");
        }

        const syncResult = await syncUserWithBackend(email);

        if (!syncResult.success) {
          throw new Error(syncResult.error || "Failed to sync user");
        }

        router.replace("/(app)/tabs/home");
      } catch (err: any) {
        console.error("Failed to verify OTP:", err);
        setError(err.message || "Invalid verification code");
      } finally {
        setIsLoading(false);
      }
    },
    [email, router]
  );

  const logout = useCallback(async () => {
    try {
      await authClient.signOut();
      await authStorage.clearAll();
    } catch (err: any) {
      console.error("Logout error:", err);
    }
  }, []);

  const goBack = useCallback(() => {
    setStep("email");
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    step,
    email,
    isLoading: isLoading || sessionQuery.isPending,
    error,
    isAuthenticated,
    user,
    walletAddress,
    registerEmail,
    verifyOtp,
    logout,
    goBack,
    clearError,
  };
}
