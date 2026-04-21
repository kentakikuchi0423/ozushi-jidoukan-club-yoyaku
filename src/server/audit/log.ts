import "server-only";

import { getSupabaseAdminClient } from "@/server/supabase/admin";

// 監査ログ書き込みのラッパ。管理系の全操作（クラブ CRUD、アカウント追加、
// パスワード変更、retention cleanup 等）から必ず呼ぶ。
//
// 書き込みは RLS をバイパスする admin クライアント経由で行う。`audit_logs`
// テーブルは UPDATE / DELETE のポリシーを付けていないため、改ざんも service
// role 以外からはできない（ADR / security-review.md §5 参照）。
//
// INSERT に失敗した場合は呼び出し側に例外を伝播させる：監査ログが残らない
// まま管理操作だけ成功する状況は、運用上 "誰が何をしたか" を辿れないため
// 避ける。

export interface AuditLogEntry {
  /** 操作した admin の UUID。システム起動 / cron の場合は null。 */
  readonly adminId: string | null;
  /** ドット区切りのアクション名（例: `club.create`, `retention.cleanup_clubs`）。 */
  readonly action: string;
  /** 対象リソース種別（例: `club`, `admin`, `reservation`）。 */
  readonly targetType: string;
  /** 対象リソースの主キー（UUID 文字列 or 任意 ID）。無い操作は null で良い。 */
  readonly targetId?: string | null;
  /** 付随メタ情報。個人情報は含めない（氏名/メール/電話は書き込まない）。 */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class AuditLogWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditLogWriteError";
  }
}

export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    throw new AuditLogWriteError(
      `failed to write audit_logs: ${error.message}`,
    );
  }
}
