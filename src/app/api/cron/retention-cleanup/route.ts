import { NextResponse } from "next/server";

import { serverEnv } from "@/server/env";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 日次 retention cleanup の入口。Vercel Cron から GET で叩かれる前提。
// 認証は `Authorization: Bearer <CRON_SECRET>` ヘッダで行い、環境変数が未設定なら
// エンドポイントごと 503 で無効化する（ステージング/dev で誤って叩いても安全）。
//
// 本体の削除ロジックは `public.cleanup_expired_clubs` / `cleanup_old_audit_logs`
// の SQL 関数（migration 20260422010000）に寄せてある。結果の件数は
// `audit_logs` にも残るので、ここのログは運用上のオマケ扱い。

export async function GET(request: Request) {
  if (!serverEnv.cronSecret) {
    return NextResponse.json(
      { error: "retention cleanup is disabled (CRON_SECRET not set)" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${serverEnv.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const [clubsRes, logsRes] = await Promise.all([
    admin.rpc("cleanup_expired_clubs"),
    admin.rpc("cleanup_old_audit_logs"),
  ]);

  const failures: string[] = [];
  if (clubsRes.error) {
    failures.push(`cleanup_expired_clubs: ${clubsRes.error.message}`);
    console.error("[cron/retention-cleanup] cleanup_expired_clubs failed", {
      code: clubsRes.error.code,
      message: clubsRes.error.message,
    });
  }
  if (logsRes.error) {
    failures.push(`cleanup_old_audit_logs: ${logsRes.error.message}`);
    console.error("[cron/retention-cleanup] cleanup_old_audit_logs failed", {
      code: logsRes.error.code,
      message: logsRes.error.message,
    });
  }

  if (failures.length > 0) {
    return NextResponse.json({ ok: false, failures }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deletedClubs: Number(clubsRes.data ?? 0),
    deletedAuditLogs: Number(logsRes.data ?? 0),
  });
}
