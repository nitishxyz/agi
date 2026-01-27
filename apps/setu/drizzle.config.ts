import { Resource } from "sst";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./db/schema"],
  dbCredentials: {
    url: Resource.DatabaseUrl.value!,
  },
});
