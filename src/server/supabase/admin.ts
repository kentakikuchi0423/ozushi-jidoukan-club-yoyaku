import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";

// 特権操作用の Supabase クライアント。secret key を使い、RLS を「バイパスし得る」
// ことを許容する。具体的には:
//   * 予約確定/採番/繰り上げの RPC 呼び出し
//   * 管理者招待・削除・権限変更
//   * retention cleanup cron
// 利用者データの通常アクセスには使わない（RLS を無視するとバグでデータを広く
// 開けてしまう）。普段は `@/lib/supabase/server` を使い、このクライアントは
// 必要な箇所だけで短命に作って捨てるのが望ましい。
//
// autoRefreshToken / persistSession は false。サーバー側でセッション持続は不要
// で、ステートレスに secret key で直接認可する。

let cached: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
