import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eq } from "drizzle-orm";

import db from "@/db/index";
import { users } from "@/db/schema";
import type { User } from "@/db/types";
import { authStorage } from "@/services/auth-storage";

async function getLocalUser(): Promise<User | null> {
  const authUserId = await authStorage.getAuthUserId();

  if (!authUserId) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.gridUserId, authUserId))
    .limit(1);

  return result[0] ?? null;
}

export async function createOrUpdateLocalUser(data: {
  email: string;
  username?: string;
  authUserId: string;
  walletAddress: string;
}): Promise<User> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.gridUserId, data.authUserId))
    .limit(1);

  const now = new Date();

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        email: data.email || existing[0].email,
        username: data.username ?? existing[0].username,
        smartAccountAddress: data.walletAddress,
        updatedAt: now,
      })
      .where(eq(users.gridUserId, data.authUserId));

    return {
      ...existing[0],
      email: data.email || existing[0].email,
      username: data.username ?? existing[0].username,
      smartAccountAddress: data.walletAddress,
      updatedAt: now,
    };
  }

  const id = `user_${Date.now()}`;
  const emailPart = data.email ? data.email.split("@")[0] : null;
  const newUser: User = {
    id,
    email: data.email,
    username: data.username ?? emailPart ?? null,
    gridUserId: data.authUserId,
    smartAccountAddress: data.walletAddress,
    avatarUrl: null,
    createdAt: now,
    updatedAt: null,
  };

  await db.insert(users).values(newUser);
  return newUser;
}

export function useUser() {
  const queryClient = useQueryClient();
  const [isInitializing, setIsInitializing] = useState(true);

  const query = useQuery({
    queryKey: ["user", "local"],
    queryFn: getLocalUser,
    staleTime: 0,
  });

  useEffect(() => {
    async function init() {
      const authUserId = await authStorage.getAuthUserId();
      const walletAddress = await authStorage.getWalletAddress();

      if (authUserId && walletAddress && !query.data) {
        await createOrUpdateLocalUser({
          email: "",
          authUserId,
          walletAddress,
        });
        queryClient.invalidateQueries({ queryKey: ["user", "local"] });
      }
      setIsInitializing(false);
    }
    init();
  }, [query.data, queryClient]);

  const updateUser = useCallback(
    async (data: Partial<Pick<User, "email" | "username" | "avatarUrl">>) => {
      const currentUser = query.data;
      if (!currentUser) return;

      await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, currentUser.id));

      queryClient.invalidateQueries({ queryKey: ["user", "local"] });
    },
    [query.data, queryClient]
  );

  return {
    data: query.data,
    isLoading: query.isLoading || isInitializing,
    error: query.error,
    updateUser,
    refetch: query.refetch,
  };
}
