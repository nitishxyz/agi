import * as SecureStore from "expo-secure-store";

const KEYS = {
  AUTH_USER_ID: "auth_user_id",
  WALLET_ADDRESS: "auth_wallet_address",
} as const;

/**
 * Storage service for Better Auth user metadata that we want quick local access to.
 */
export const authStorage = {
  async saveAuthUserId(userId: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.AUTH_USER_ID, userId);
  },

  async getAuthUserId(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.AUTH_USER_ID);
  },

  async saveWalletAddress(address: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.WALLET_ADDRESS, address);
  },

  async getWalletAddress(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.WALLET_ADDRESS);
  },

  async clearAll(): Promise<void> {
    await Promise.all(
      Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key))
    );
  },
};
