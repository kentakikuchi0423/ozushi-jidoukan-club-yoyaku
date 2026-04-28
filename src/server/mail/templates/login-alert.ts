import "server-only";

import { publicEnv } from "@/lib/env";

import {
  type FacilityContact,
  renderFooter,
  type RenderedEmail,
  textToHtml,
} from "./shared";

export interface LoginAlertContext {
  /** 通知先のメールアドレス（本文中の挨拶に使う）。 */
  readonly email: string;
  /** 表示名。未設定なら null。 */
  readonly displayName: string | null;
  /** 直近 30 分の失敗回数（件）。本文に「複数回」とだけ書くため受け取るが、
   * 詳細値は本文に出さない（ADR-0033 の PII 最小化方針）。 */
  readonly failureCount: number;
}

/**
 * 同一メール宛にログイン失敗が短時間で複数回発生した時に送る注意喚起メール。
 *
 * 本文では IP / 時刻 / 失敗回数の詳細値は出さず、(1) 検知した事実、(2) 心当たりが
 * ない場合の対処（パスワード変更）、(3) 緊急性は低い旨だけ案内する（ADR-0033）。
 * 詳細は audit_logs に残るので運用側で必要に応じて確認する。
 */
export function renderLoginAlertEmail(
  ctx: LoginAlertContext,
  facilities: ReadonlyArray<FacilityContact>,
): RenderedEmail {
  const greeting = ctx.displayName
    ? `${ctx.displayName} 様`
    : `${ctx.email} 様`;

  const passwordUrl = `${publicEnv.siteUrl.replace(/\/$/, "")}/admin/password`;

  const text = `${greeting}

大洲市児童館クラブ予約システムの管理者アカウントについて、
短時間に複数回のログイン失敗を検知しましたのでお知らせします。

ご自身の入力ミスであれば、このメールは破棄して構いません。

もし心当たりがない場合は、念のためパスワードの変更をお願いします。
ログイン後、下記ページから変更できます。

■ パスワード変更
${passwordUrl}

なお、現時点でアカウントがロックされたわけではありません。
緊急の対応が必要なものではありませんが、被害拡大を防ぐため
お早めにご対応いただけますと安心です。

ご不明な点があれば、全館管理者までお問い合わせください。${renderFooter(facilities)}`;

  return {
    subject: "【大洲市児童館クラブ予約】ログイン失敗が複数回検知されました",
    text,
    html: textToHtml(text),
  };
}
