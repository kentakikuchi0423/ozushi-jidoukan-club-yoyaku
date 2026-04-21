import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

// RSC / Route Handler / Server Action 用の Supabase クライアント。
// publishable key を使い、Next.js の cookie ストアに auth セッションを載せる。
// Server Component の文脈では cookie 書き込みができないため、`setAll` は
// try/catch で握りつぶす（`@supabase/ssr` 公式推奨の作法）。
//
// RLS バイパスが必要な管理系処理は `@/server/supabase/admin` を使うこと。
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component から呼ばれた場合 cookies は read-only。
            // middleware / Server Action / Route Handler 側で set される前提で無視。
          }
        },
      },
    },
  );
}
