import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_DIRECT_URL;
if (!connectionString) {
  throw new Error("DATABASE_DIRECT_URL is required for migration tooling.");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
