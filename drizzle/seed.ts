import { hash } from "bcryptjs";
import { aiProviderConfigs, aiPromptTemplates, cases, events, fieldCommissions, members, prevalenceMetrics, prevalenceRecords, prevalenceStudies, territories, users } from "@/lib/mock-data";

async function main() {
  const adminHash = await hash("demo-seguro", 12);
  const summary = {
    superAdmin: users.find((user) => user.roles.includes("super_admin"))?.email,
    adminPasswordHashPreview: `${adminHash.slice(0, 12)}...`,
    territories: territories.length,
    members: members.length,
    cases: cases.length,
    events: events.length,
    prevalenceStudies: prevalenceStudies.length,
    prevalenceMetrics: prevalenceMetrics.length,
    prevalenceRecords: prevalenceRecords.length,
    fieldCommissions: fieldCommissions.length,
    aiPrompts: aiPromptTemplates.length,
    aiProviders: aiProviderConfigs.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log("Seed tipado listo para conectar a Drizzle insert con DATABASE_URL en Vercel/Neon.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
