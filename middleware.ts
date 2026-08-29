import { withAuth } from "next-auth/middleware";

// Protege todas las rutas del panel. Las vistas publicas (`/`, `/login`,
// `/credencial/*`) y los endpoints de Auth.js quedan fuera del matcher.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/miembros/:path*",
    "/casos/:path*",
    "/eventos/:path*",
    "/operacion-territorial/:path*",
    "/asistente/:path*",
    "/prevalencia/:path*",
    "/reportes/:path*",
    "/configuracion/:path*",
    "/auditoria/:path*",
  ],
};
