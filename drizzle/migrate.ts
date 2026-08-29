import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Aplica las migraciones versionadas de drizzle/migrations contra DATABASE_URL.
// Se ejecuta desde el repo: `npm run db:migrate` (y en el build de Vercel/CI).
async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Define DATABASE_URL antes de ejecutar las migraciones (ver .env.example).");
  }

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle/migrations" });
  await client.end();
  console.log("Migraciones aplicadas correctamente.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
