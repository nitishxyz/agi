import * as SecureStore from "expo-secure-store";
import { eq } from "drizzle-orm";
import db from "@/db/index";
import { wallets } from "@/db/schema/index";

const WALLET_ADDRESS_KEY = "ottocode_wallet_address";
const USER_ID_KEY = "ottocode_user_id";
const ONBOARDING_KEY = "ottocode_onboarding_complete";

export type WalletAccount = {
  publicKey: string;
  userId?: string;
};

export async function setWallet(params: {
  address: string;
  userId?: string;
  name?: string;
}): Promise<WalletAccount> {
  const { address, userId, name } = params;

  await SecureStore.setItemAsync(WALLET_ADDRESS_KEY, address);
  if (userId) {
    await SecureStore.setItemAsync(USER_ID_KEY, userId);
  }

  await db.insert(wallets).values({
    id: `wallet_${Date.now()}`,
    address,
    gridUserId: userId ?? null,
    name: name ?? null,
    isActive: true,
    createdAt: new Date(),
  }).onConflictDoNothing();

  await db
    .update(wallets)
    .set({
      isActive: true,
      gridUserId: userId ?? undefined,
      name: name ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(wallets.address, address));

  return {
    publicKey: address,
    userId,
  };
}

export async function getWallet(): Promise<WalletAccount | null> {
  const address = await SecureStore.getItemAsync(WALLET_ADDRESS_KEY);
  if (!address) return null;

  const userId = await SecureStore.getItemAsync(USER_ID_KEY);

  return {
    publicKey: address,
    userId: userId ?? undefined,
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
  await SecureStore.deleteItemAsync(USER_ID_KEY);
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
