# security-review

セキュリティ懸念の洗い出しと対策のチェックリスト。
Phase を跨いで継続更新する。各項目は **未対応 / 対応中 / 済** の3ステータスで管理。

---

## 1. 認可（server-side enforcement）

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| 利用者予約の他人アクセス | 済 | `get_my_reservation(r, t)` / `cancel_reservation(r, t)` RPC が `reservation_number + secure_token` の両方一致のみで行を返す（SECURITY DEFINER）。URL は `/reservations?r=...&t=...` の形でメール本文にのみ記載（ADR-0006） |
| 管理者の他館データアクセス | 済 | Server Action / Route で `requireFacilityPermission(code)` を呼び、`admin_facilities` に該当行が無い admin は `FacilityPermissionDeniedError`。admin CRUD は `fetchClubForAdmin(id, ctx.facilities)` で対象クラブが許可館に含まれるかも二重チェック |
| super_admin 限定操作（アカウント追加） | 済 | `requireSuperAdmin()` が 3 館すべての権限を要求（ADR-0007）。`/admin/accounts` の Server Action 冒頭で再検証。失敗時は `SuperAdminRequiredError` |
| Supabase Secret Key（旧 service_role）の漏洩 | 済 | `src/server/env.ts` に隔離し `import "server-only"` でクライアントビルドから除外（ADR-0015）。`NEXT_PUBLIC_` プレフィックス禁止を `.env.example` にも明記 |

## 2. 入力検証

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| 予約フォーム | 済 | `reservationInputSchema`（zod）で server-side 検証。Client 側は UX 用の軽い検証のみ。NFKC で phone / email を半角化し DB の CHECK と文字集合を一致させた |
| クラブ登録フォーム | 済 | `clubInputSchema`（zod）で `datetime-local`、`end > start`、`target_age_max >= min`、`photo_url` http(s) を検証 |
| 写真 URL | 済 | zod の regex `^https?://` + 最大 2048 字 + URL コンストラクタ由来の表示時チェック（`hasValidPhotoUrl`）。`rel="noopener noreferrer"` 付きで別タブ開く |
| 予約番号 | 済 | `^(ozu\|kita\|toku)_\d{6}$` を `isReservationNumber` と DB の CHECK 制約で二重防御 |
| 備考欄 | 済 | 500 字上限、DB CHECK と zod で二重。React RSC のデフォルトエスケープで HTML は安全 |
| 電話番号 | 済 | `^[0-9+\-() ]{7,20}$` を zod + DB CHECK で二重。NFKC で全角 → 半角統一 |

## 3. 攻撃観点

| 観点 | ステータス | 対策 |
| --- | --- | --- |
| SQL Injection | 済 | Supabase JS SDK のパラメタ化（`from().select()` / `rpc()` / `eq()`）のみ使用。dynamic SQL は SECURITY DEFINER 関数のみで、いずれも `search_path` 固定と入力のパラメタ化済み |
| XSS | 済 | RSC のデフォルトエスケープ。`dangerouslySetInnerHTML` は未使用（grep 確認）。Email 本文は plain text のみ |
| CSRF（管理画面） | 済 | Next.js 16 の Server Actions は origin / same-site を自動検証。独自 POST API は `/api/cron/*` のみで、`Authorization: Bearer <CRON_SECRET>` 必須 |
| Open Redirect | 済 | `loginAction` の `next` パラメータは `^/admin(/.*)?$` のみ許可。その他は `/admin` に fallback |
| Brute Force（管理者ログイン） | 対応中 | Supabase Auth の既定レート制限に依存。将来ピーク時に必要なら Edge Middleware で IP ベース制限を追加（Phase 6 以降） |
| Enumerating 予約番号 | 済 | `secure_token`（32+ 文字 base64url、Web Crypto）が必須。番号のみでの参照は 0 行で返す |
| 予約スパム / Bot | 対応中 | 現状は対策なし。リリース後の実測で必要なら hCaptcha / Honeypot を検討（Phase 6+ でペイメント化／クレジット要求ではなく児童館の申込なので当面優先度 Low） |
| セッション固定 | 済 | Supabase Auth の既定 cookie が Secure / HttpOnly / SameSite=Lax。middleware で毎リクエスト refresh |
| Clickjacking | 済 | `X-Frame-Options: DENY` を全ページに付与（`next.config.ts`）。将来 CSP 導入時は `frame-ancestors 'none'` でも二重化 |

## 4. 個人情報

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| ログへの氏名・電話・メール流出 | 済 | 予約 / 管理 Server Action の `console.error` はエラーコード / メッセージ / hint のみ。Resend の send ラッパも宛先や本文はログに出さず `tag` のみ。Supabase RPC の `details` はフィールド値を含み得るので明示的に除外 |
| エラー監視（Sentry 等）への流出 | 対応中 | 未導入。導入時は `beforeSend` で PII マスクする方針 |
| fixture / seed への実データ混入 | 済 | `supabase/seed.sql` はコメントのみで個人情報ゼロ。`docs/operations.md` §5 のテストクラブ SQL も個人情報を含まず |
| メール本文への機微情報過多 | 済 | 4 テンプレート（confirmed / waitlisted / promoted / canceled）ともクラブ情報と予約番号のみ。電話・住所等は含まない |

## 5. 運用

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| secrets のコミット | 済 | `.env*` を `.gitignore`（`.env.example` のみ例外）。pre-commit での `gitleaks` 導入は将来的な課題 |
| Supabase Personal Access Token の滞留 | 済 | ADR-0013 により migration は `--db-url` 経路に統一。PAT は使わない（必要時のみ発行→即 revoke） |
| Supabase バックアップ | 未対応 | Supabase のプランに依存。無料プランは毎日 PITR が 7 日間。Phase 6 で現運用確認 |
| 監査ログの改ざん防止 | 済 | `audit_logs` は UPDATE / DELETE の policy を付けず、retention cleanup の SECURITY DEFINER 関数のみが特定条件で DELETE 可能。INSERT も admin クライアント経由のみ |
| 依存脆弱性 | 対応中 | `pnpm audit` を Phase 6 の公開前に一度回す。Dependabot は GitHub 接続後に有効化 |
| パスワードハッシュ | 済 | Supabase Auth に委譲（scrypt ベース）。自前でハッシュしていない |
| CRON エンドポイント保護 | 済 | `/api/cron/retention-cleanup` は `Authorization: Bearer <CRON_SECRET>` 必須。未設定時は 503 で無効化 |

## 6. 外部リンク / 外部資源

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| 写真 URL（Google Drive 等）クリック | 済 | `<a target="_blank" rel="noopener noreferrer">` + `hasValidPhotoUrl` による http(s) 限定 |
| メール内リンクのフィッシング対策 | 済 | 本文に送信元の名称を明示。URL は `NEXT_PUBLIC_SITE_URL` ベースで自ドメインのみ |

## 7. クライアント側

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| CSP（Content Security Policy） | 済 | `src/middleware.ts` でリクエスト毎に nonce を生成し、本番のみ `Content-Security-Policy: script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; connect-src 'self' <supabase-origin>; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` を付与。Next.js が hydration inline script に自動で nonce を付与する。E2E でも header の存在と `nonce-` / `frame-ancestors 'none'` / `object-src 'none'` を検証 |
| HTTPS 強制 | 済 | Vercel 上は自動 HTTPS + HSTS（`max-age=63072000; includeSubDomains; preload`、2 年）を付与 |
| Cookie フラグ | 済 | `@supabase/ssr` の既定で Secure / HttpOnly / SameSite=Lax。middleware で毎リクエスト更新 |
| Permissions-Policy | 済 | `camera=(), microphone=(), geolocation=(), browsing-topics=()` を全ページに付与 |

## 8. レビュー実施記録

| 日付 | 実施者 | 対象 | 結果 |
| --- | --- | --- | --- |
| 2026-04-21 | Claude | Phase 0 docs | 初版作成、対策は未対応（該当実装未着手） |
| 2026-04-22 | Claude | Phase 2–5 実装 | 主要項目を「済」に更新。残課題は CSP（nonce）/ rate limit / 依存脆弱性スキャン / backup 運用 |
| 2026-04-22 | Claude | Phase 6 深掘り | CSP nonce / skip-to-content / フォーム aria-invalid & aria-describedby を実装。残は rate limit / Sentry / Dependabot / Supabase backup と UI ポリッシュ |
