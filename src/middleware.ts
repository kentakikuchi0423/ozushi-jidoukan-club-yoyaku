import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

// アプリ共通の middleware。
//
// 目的:
//  1. 全ルートで Supabase Auth のセッションを refresh し、access_token が期限切れ
//     になる前に cookie を差し替える（`@supabase/ssr` 公式パターン）。
//  2. `/admin/*`（`/admin/login` を除く）へのアクセスは、未ログインなら
//     `/admin/login` にリダイレクトする。
//
// middleware は server component ではないため `next/headers` の cookies() は
// 使えない。ここでは NextRequest / NextResponse の cookie API を直接 wire する。

const ADMIN_LOGIN_PATHS = ["/admin/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // 必ず getUser() を呼ぶ。ここで cookie が refresh される。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const isLoginRoute = ADMIN_LOGIN_PATHS.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (!isLoginRoute && !user) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/admin/login";
      redirect.searchParams.set("next", pathname);
      return NextResponse.redirect(redirect);
    }
  }

  return response;
}

// 静的アセット・画像最適化・favicon 以外の全リクエストで動かす。
// Supabase セッション refresh は全ルートに効かせたいのでパブリック画面も通す。
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
