import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that never require auth. Exact matches for the account flows so
// /loginish or /signupmalicious can't sneak past. The public fan page /e/[slug]
// stays open; API handlers do their own checks; Next assets are exempt.
const PUBLIC_PATHS_EXACT = new Set(["/login", "/signup", "/pending", "/logout"]);
const PUBLIC_PATH_PREFIXES = ["/e/", "/api/", "/_next/", "/logo", "/favicon", "/icon"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (PUBLIC_PATHS_EXACT.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
