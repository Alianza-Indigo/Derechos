import type { User } from "@/lib/types";

// Duena de la plataforma: la cuenta definida en SUPERADMIN_EMAIL. A diferencia
// del rol super_admin (que es "*" pero acotado a su propia organizacion), la
// duena de la plataforma administra TODAS las organizaciones (inquilinos):
// alta, suspension y reactivacion. Es un rol transversal, no por-tenant.
export function isPlatformOwner(user: Pick<User, "email">) {
  const owner = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (!owner) {
    return false;
  }
  return user.email.trim().toLowerCase() === owner;
}
