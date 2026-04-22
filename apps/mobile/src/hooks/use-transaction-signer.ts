import { useCallback } from "react";

/**
 * Placeholder signer hook after removing embedded wallet signing.
 *
 * If transaction signing is needed again, wire this up to the wallet solution
 * you want to use alongside Better Auth.
 */
export function useTransactionSigner() {
  const signTransaction = useCallback(async (_base64Transaction: string): Promise<string> => {
    throw new Error("Transaction signing is not configured for Better Auth yet.");
  }, []);

  return {
    signTransaction,
    isReady: false,
    walletAddress: null as string | null,
  };
}
