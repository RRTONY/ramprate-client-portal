import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/admin/login",
  "/auth/confirm",
  "/auth/finish",
  "/auth/set-password",
  "/privacy",
  "/brand",
  "/api/cron",
];
const isPublic = (path: string) =>
  PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(
          list: { name: string; value: string; options: CookieOptions }[],
        ) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const go = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to.split("?")[0];
    url.search = to.includes("?") ? "?" + to.split("?")[1] : "";
    return NextResponse.redirect(url);
  };

  if (!user) {
    if (isPublic(path) || path.startsWith("/auth/signout")) return response;
    return go(path.startsWith("/admin") ? "/admin/login" : "/login");
  }

  // Already signed in: skip the login pages.
  if (path === "/login" || path === "/admin/login") return go("/");

  // Two-step sign-in (TOTP) is optional: anyone who set it up must enter the code, and the
  // company can require it for everyone with REQUIRE_CLIENT_MFA=true.
  const onMfaPage =
    path.startsWith("/auth/mfa") ||
    path.startsWith("/auth/signout") ||
    path.startsWith("/auth/set-password");
  if (!onMfaPage && !isPublic(path)) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal) {
      if (aal.nextLevel === "aal2" && aal.currentLevel !== "aal2")
        return go("/auth/mfa");
      if (aal.nextLevel === "aal1" && process.env.REQUIRE_CLIENT_MFA === "true")
        return go("/auth/mfa?enroll=1");
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico)$).*)",
  ],
};
