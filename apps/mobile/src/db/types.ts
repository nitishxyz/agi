import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { wallets, users } from "./schema";

export type Wallet = InferSelectModel<typeof wallets>;
export type NewWallet = InferInsertModel<typeof wallets>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
