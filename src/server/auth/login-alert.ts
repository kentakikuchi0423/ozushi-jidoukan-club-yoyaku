import "server-only";

import { logAdminAction } from "@/server/audit/log";
import { fetchActiveFacilityContacts } from "@/server/facilities/list";
import { renderLoginAlertEmail } from "@/server/mail/templates/login-alert";
import { sendEmail } from "@/server/mail/send";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

// ADR-0033: ログイン失敗が直近 30 分で 5 件以上たまり、かつ直近 24 時間に
// 通知を出していない場合に限って注意喚起メールを 1 通送る。
//
// 設計の要点:
//   * 未登録メール（`admins` テーブルに存在しないアドレス）には絶対に送らない
//     → 攻撃者が任意の第三者宛にスパムを撒く踏み台にしないための制約
//   * cool-down は「送信した記録」を `audit_logs.admin.login.alert_sent` に
//     残し、次回の判定で 24 時間以内に存在すればスキップ
//   * 検査は単一の SECURITY DEFINER 関数 `evaluate_login_alert` でまとめて実行
//   * 例外は呼び出し側に伝播させない（fire-and-forget）

/** 直近この分数の `admin.login.failed` 件数を数える。 */
export const LOGIN_ALERT_WINDOW_MINUTES = 30;
/** 同一メールへ通知してから次回送信までこの時間は静かにする。 */
export const LOGIN_ALERT_COOLDOWN_HOURS = 24;
/** この件数以上で発火。閾値そのものに達した瞬間も含める。 */
export const LOGIN_ALERT_THRESHOLD = 5;

interface EvaluateLoginAlertRow {
  admin_id: string | null;
  display_name: string | null;
  failure_count: number;
  alert_sent_recently: boolean;
}

/**
 * ログイン失敗が記録された直後に呼ぶ。閾値・cool-down・登録状況の判定を
 * すべて内部で行い、必要に応じてメール送信と監査ログの追記を行う。
 *
 * 例外を投げない: ログイン UX を壊さないため、失敗は `console.error` のみ。
 */
export async function maybeSendLoginAlert(email: string): Promise<void> {
  const trimmed = email.trim();
  if (trimmed === "") return;

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("evaluate_login_alert", {
      p_email: trimmed,
      p_window_minutes: LOGIN_ALERT_WINDOW_MINUTES,
      p_cooldown_hours: LOGIN_ALERT_COOLDOWN_HOURS,
    });
    if (error) {
      console.error("[admin.login.alert] evaluate failed", {
        message: error.message,
      });
      return;
    }

    const row = (data as EvaluateLoginAlertRow[] | null)?.[0];
    if (!row) return;

    if (!row.admin_id) return; // 未登録メール → 送らない
    if (row.failure_count < LOGIN_ALERT_THRESHOLD) return; // 閾値未満
    if (row.alert_sent_recently) return; // 24h 内に既送

    const facilities = await fetchActiveFacilityContacts().catch(() => []);
    const message = renderLoginAlertEmail(
      {
        email: trimmed,
        displayName: row.display_name,
        failureCount: row.failure_count,
      },
      facilities,
    );

    await sendEmail({
      tag: "admin.login.alert",
      to: trimmed,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    // 送信記録（cool-down の判定キーになる）。失敗してもログイン UX には影響させない。
    await logAdminAction({
      adminId: row.admin_id,
      action: "admin.login.alert_sent",
      targetType: "admin",
      targetId: row.admin_id,
      metadata: {
        email: trimmed,
        threshold: LOGIN_ALERT_THRESHOLD,
        window_minutes: LOGIN_ALERT_WINDOW_MINUTES,
      },
    }).catch((e) => {
      console.error("[admin.login.alert_sent] audit write error", {
        message: e instanceof Error ? e.message : String(e),
      });
    });
  } catch (e) {
    console.error("[admin.login.alert] unexpected error", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
