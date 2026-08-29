import { withAuth } from "next-auth/middleware";

const proxy = withAuth({
  pages: {
    signIn: "/login",
  },
});

export default proxy;

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
    "/api/export/:path*",
    "/api/upload/:path*",
    "/api/ai/:path*",
  ],
};
