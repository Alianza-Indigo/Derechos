import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

declare global {
  var __derechosSql: ReturnType<typeof postgres> | undefined;
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const client =
    globalThis.__derechosSql ??
    postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 1,
    });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__derechosSql = client;
  }

  return drizzle(client, { schema });
}
