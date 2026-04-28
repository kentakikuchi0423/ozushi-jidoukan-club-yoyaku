"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { logAdminAction } from "@/server/audit/log";
import { maybeSendLoginAlert } from "@/server/auth/login-alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginActionResult = { ok: false; message: string };

/**
 * 管理者ログイン。Supabase Auth の email / password で認証し、成功時は
 * `next` が `/admin*` に限り OK のリダイレクト先として採用する（Open
 * Redirect 防止、security-review §3）。失敗時は汎用メッセージを返し、
 * 「メールが存在しない」/「パスワード違い」を区別しない（ユーザー列挙対策）。
 *
 * 監査ログ: 成功 `admin.login.succeeded`、失敗 `admin.login.failed` を
 * `audit_logs` に記録する。管理者のログイン email は運用識別子のため例外的に
 * metadata に含めるが、パスワードは絶対に記録しない（既定の「PII は書かない」
 * ルールの例外は login 系とアカウント招待系に限定）。
 */
export async function loginAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<LoginActionResult | never> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  const ip = await resolveClientIp();

  if (error || !data.user) {
    // 失敗理由の内訳（メール存在 / 不一致 / ロックアウト等）はユーザーには
    // 出さないが、運用追跡のため reason としてコードだけ残す。
    await logAdminAction({
      adminId: null,
      action: "admin.login.failed",
      targetType: "admin",
      metadata: {
        email: input.email,
        ip,
        reason: error?.code ?? "unknown",
      },
    }).catch((e) => {
      // 監査ログの失敗でログイン UX を壊さない（既に失敗している）。
      console.error("[admin.login.failed] audit write error", {
        message: e instanceof Error ? e.message : String(e),
      });
    });

    // 失敗ログ記録後に閾値到達なら本人へ注意喚起メールを送る（ADR-0033）。
    // fire-and-forget。送信判定の例外はこの中で吸収する。
    await maybeSendLoginAlert(input.email);

    return {
      ok: false,
      message:
        "メールアドレスまたはパスワードが正しくありません。\nもう一度ご確認ください。",
    };
  }

  await logAdminAction({
    adminId: data.user.id,
    action: "admin.login.succeeded",
    targetType: "admin",
    targetId: data.user.id,
    metadata: {
      email: data.user.email ?? input.email,
      ip,
    },
  }).catch((e) => {
    // 監査ログ失敗時はログインは継続させる（UX 優先、後追いで検知）。
    console.error("[admin.login.succeeded] audit write error", {
      message: e instanceof Error ? e.message : String(e),
    });
  });

  // next は `/admin*` の相対パスだけ許可（Open Redirect 防止）。
  // 旧ダッシュボード `/admin` に戻そうとした場合は `/admin/clubs` に寄せる
  // （ログイン後の初期画面はクラブ一覧）。
  const isSafeAdminPath =
    typeof input.next === "string" && /^\/admin(\/.*)?$/.test(input.next);
  const target =
    !isSafeAdminPath || input.next === "/admin" ? "/admin/clubs" : input.next!;
  redirect(target);
}

/**
 * クライアント IP を `x-forwarded-for` の先頭エントリから拾う。
 * Vercel 環境では proxy によって設定される。取れない環境（ローカル dev 等）
 * では "unknown" を入れる。
 */
async function resolveClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
