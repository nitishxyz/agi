import * as SecureStore from "expo-secure-store";
import { eq } from "drizzle-orm";
import db from "@/db/index";
import { wallets } from "@/db/schema/index";

const WALLET_ADDRESS_KEY = "stackforge_wallet_address";
const GRID_USER_ID_KEY = "stackforge_grid_user_id";
const AUTH_USER_ID_KEY = "stackforge_auth_user_id";
const ONBOARDING_KEY = "stackforge_onboarding_complete";

export type WalletAccount = {
  publicKey: string;
  gridUserId?: string;
  authUserId?: string;
};

export async function setWalletForUser(params: {
  address: string;
  authUserId: string;
  name?: string;
}): Promise<WalletAccount> {
  const { address, authUserId, name } = params;

  await SecureStore.setItemAsync(WALLET_ADDRESS_KEY, address);
  await SecureStore.setItemAsync(AUTH_USER_ID_KEY, authUserId);

  await db.insert(wallets).values({
    id: `wallet_${Date.now()}`,
    address,
    gridUserId: authUserId,
    name: name ?? null,
    isActive: true,
    createdAt: new Date(),
  }).onConflictDoNothing();

  await db
    .update(wallets)
    .set({
      isActive: true,
      gridUserId: authUserId,
      name: name ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(wallets.address, address));

  return {
    publicKey: address,
    authUserId,
  };
}

export async function getWallet(): Promise<WalletAccount | null> {
  const address = await SecureStore.getItemAsync(WALLET_ADDRESS_KEY);
  if (!address) return null;

  const gridUserId = await SecureStore.getItemAsync(GRID_USER_ID_KEY);
  const authUserId = await SecureStore.getItemAsync(AUTH_USER_ID_KEY);

  return {
    publicKey: address,
    gridUserId: gridUserId ?? undefined,
    authUserId: authUserId ?? undefined,
  };
}

export async function hasWallet(): Promise<boolean> {
  const wallet = await getWallet();
  return wallet !== null;
}

export async function deleteWallet(): Promise<void> {
  const wallet = await getWallet();
  if (wallet) {
    const dbWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.address, wallet.publicKey))
      .limit(1);

    if (dbWallet.length > 0) {
      const walletId = dbWallet[0].id;
      await db.delete(wallets).where(eq(wallets.id, walletId));
    }
  }
  await SecureStore.deleteItemAsync(WALLET_ADDRESS_KEY);
  await SecureStore.deleteItemAsync(GRID_USER_ID_KEY);
  await SecureStore.deleteItemAsync(AUTH_USER_ID_KEY);
}

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return value === "true";
}

export async function setOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
}

export async function resetOnboarding(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDING_KEY);
}
