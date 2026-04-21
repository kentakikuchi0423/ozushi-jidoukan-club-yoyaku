// Browser / server 両方で参照可能な環境変数。
// `NEXT_PUBLIC_` プレフィックスがついた値のみをここに置くこと。secret key
// 等の秘匿値は `src/server/env.ts` にある server-only モジュール経由で扱う。
//
// 欠落時はアプリ起動時に fail fast させて、本番で初めて露見する状況を避ける。

function requiredEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `missing required environment variable: ${name}. .env.local を確認してください。`,
    );
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: requiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: requiredEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  siteUrl: requiredEnv(
    "NEXT_PUBLIC_SITE_URL",
    process.env.NEXT_PUBLIC_SITE_URL,
  ),
} as const;
