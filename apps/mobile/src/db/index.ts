import { drizzle as expodrizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const ENV = process.env.EXPO_PUBLIC_ENV || "prod";

console.log("env:", ENV)

const opsqliteDb = openDatabaseSync(ENV === "dev" ? "newdb.db" : "database.db");
const db = expodrizzle(opsqliteDb);

// Export the single instance
export default db;

// Export types
export * from "./types";
