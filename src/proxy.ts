import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

// アプリ共通の proxy（Next.js 16 で `middleware.ts` → `proxy.ts` に改名された
// 同じ仕組み。機能は旧 middleware と同一）。
//
// 目的:
//  1. 全ルートで Supabase Auth のセッションを refresh し、access_token が期限切れ
//     になる前に cookie を差し替える（`@supabase/ssr` 公式パターン）。
//  2. `/admin/*`（`/admin/login` を除く）へのアクセスは、未ログインなら
//     `/admin/login` にリダイレクトする。
//  3. **本番ビルドでのみ** nonce ベースの Content-Security-Policy を発行する。
//     Next.js のハイドレーションインラインスクリプトには Next.js 自身が
//     `x-nonce` リクエストヘッダを見て自動で `nonce=` を付与する。
//     開発中は HMR などで inline script が増えるため CSP は無効化する。
//
// Server Component ではないため `next/headers` の cookies() は使えない。
// ここでは NextRequest / NextResponse の cookie API を直接 wire する。

const ADMIN_LOGIN_PATHS = ["/admin/login"];
const IS_PROD = process.env.NODE_ENV === "production";

function buildNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // Edge ランタイムには Buffer が無いので btoa + atob で base64 化する
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, "");
}

function buildCsp(nonce: string, supabaseOrigin: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'", // Tailwind / inline <style>
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = IS_PROD ? buildNonce() : null;

  // リクエストヘッダに x-nonce を差し込むと、RSC レンダリング中に Next.js が
  // 生成する hydration / routing 用の inline <script> にそれが付く。
  const headersForRequest = new Headers(request.headers);
  if (nonce) headersForRequest.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: { headers: headersForRequest },
  });

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
          response = NextResponse.next({
            request: { headers: headersForRequest },
          });
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

  // `/admin` は互換用の入口。実体はクラブ一覧 `/admin/clubs` に統合した。
  // 未ログインならこの後のガードで `/admin/login?next=/admin/clubs` に飛ぶ。
  if (pathname === "/admin") {
    const to = request.nextUrl.clone();
    to.pathname = "/admin/clubs";
    return NextResponse.redirect(to);
  }

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

  if (nonce) {
    const supabaseOrigin = new URL(publicEnv.supabaseUrl).origin;
    const csp = buildCsp(nonce, supabaseOrigin);
    response.headers.set("Content-Security-Policy", csp);
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
