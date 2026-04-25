import {
  type FacilityContact,
  renderFooter,
  type RenderedEmail,
  textToHtml,
} from "./shared";

export interface AdminInviteContext {
  /** 招待先のメールアドレス（参考表示用）。 */
  readonly email: string;
  /** 表示名（未設定なら null）。 */
  readonly displayName: string | null;
  /** アクセス権を付与された館の日本語名（例: ["大洲児童館", "喜多児童館"]）。 */
  readonly facilityNames: ReadonlyArray<string>;
  /** `admin.generateLink` で生成したメール確認用 URL。 */
  readonly actionLink: string;
}

/**
 * 全館管理者が新しい管理者を招待するときのメール本文。
 * 手続き: リンクをクリック → メール確認 + 自動ログイン → クラブ一覧に着地。
 * パスワードは招待時に設定済みなので、次回以降はログイン画面から使える。
 */
export function renderAdminInviteEmail(
  ctx: AdminInviteContext,
  facilities: ReadonlyArray<FacilityContact>,
): RenderedEmail {
  const greeting = ctx.displayName
    ? `${ctx.displayName} 様`
    : `${ctx.email} 様`;
  const facilityLine =
    ctx.facilityNames.length === 0
      ? "（館の割り当ては後ほど共有されます）"
      : ctx.facilityNames.join(" / ");

  const text = `${greeting}

大洲市児童館クラブ予約システムの管理者アカウントが発行されました。

担当館: ${facilityLine}

下記リンクをクリックするとメールアドレスの確認が完了し、
ログイン済みの状態でクラブ一覧画面に移動します。
パスワードは発行者側で初期値を設定済みですので、
ログイン後に「パスワード変更」からお好きなものへ変更してください。

■ 初回ログイン用リンク
${ctx.actionLink}

このリンクは一定時間で無効になります。
期限切れの場合は、発行者にもう一度お知らせください。

ご不明な点があれば、招待を送った全館管理者までお問い合わせください。${renderFooter(facilities)}`;
  return {
    subject: "【大洲市児童館クラブ予約】管理者アカウントが発行されました",
    text,
    html: textToHtml(text),
  };
}
