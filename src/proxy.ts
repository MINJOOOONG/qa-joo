import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Runner endpoints authenticate with an HMAC signature instead of a browser session. */
const RUNNER_PATHS = [/^\/api\/automation\/results$/, /^\/api\/automation\/artifacts$/, /^\/api\/automation\/runs\/[^/]+\/manifest$/];
const PUBLIC_PATHS = [/^\/login$/, /^\/api\/health$/, /^\/sandbox(\/.*)?$/];

function authEnabled(): boolean {
  const disabled = ["1", "true", "yes", "on"].includes((process.env.QA_JOO_DISABLE_AUTH ?? "").toLowerCase());
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !disabled,
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!authEnabled() || RUNNER_PATHS.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Refreshes the session cookie when needed and verifies the user with Supabase Auth.
  const { data } = await supabase.auth.getUser();
  if (data.user || PUBLIC_PATHS.some((pattern) => pattern.test(pathname))) {
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to continue." } }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
