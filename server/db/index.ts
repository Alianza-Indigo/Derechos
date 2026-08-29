import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

declare global {
  var __derechosSql: ReturnType<typeof postgres> | undefined;
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: Database | undefined;

export function getDb(): Database {
  if (cachedDb) {
    return cachedDb;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no esta configurada. Define la conexion Postgres (ver .env.example) antes de iniciar la aplicacion.",
    );
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

  cachedDb = drizzle(client, { schema });
  return cachedDb;
}
