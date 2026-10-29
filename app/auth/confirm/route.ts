import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/links";

// Handles invite and password-reset links. Configure the Supabase email templates to link to:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password
// Supabase's default templates instead come back with ?code=... or with the session in the
// #fragment, which only the browser can read, so those are finished on /auth/finish.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const { error } = await createClient().auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    const { error } = await createClient().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (!token_hash) {
    // The browser keeps the #fragment across this redirect.
    const finish = new URL("/auth/finish", request.url);
    if (searchParams.get("next")) finish.searchParams.set("next", next);
    return NextResponse.redirect(finish);
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
