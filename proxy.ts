import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_ROUTES: Record<string, string> = {
  administrador: "/admin",
  anfitrion: "/anfitrion",
  jefe_cocina: "/cocina",
  seguridad: "/seguridad",
  invitado: "/invitado",
};

const PUBLIC_PATHS = ["/", "/invitacion", "/registro", "/auth", "/api"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/icon" ||
    pathname.startsWith("/apple-icon") ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p + "/"));

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión → solo puede acceder a rutas públicas
  if (!user) {
    if (!isPublic) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // Con sesión en el login → redirigir al dashboard según rol
  if (pathname === "/") {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("tipo")
      .eq("id", user.id)
      .single();

    const ruta = ROLE_ROUTES[usuario?.tipo ?? ""] ?? "/";
    if (ruta !== "/") {
      return NextResponse.redirect(new URL(ruta, request.url));
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
