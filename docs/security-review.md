# security-review

セキュリティ懸念の洗い出しと対策のチェックリスト。
Phase を跨いで継続更新する。各項目は **未対応 / 対応中 / 済** の3ステータスで管理。

---

## 1. 認可（server-side enforcement）

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| 利用者予約の他人アクセス | 未対応 | `reservation_number + secure_token` の両方必須、Route Handler で検証 |
| 管理者の他館データアクセス | 未対応 | 全ての管理系エンドポイントで facility 権限をチェック。RLS も併用 |
| super_admin 限定操作（アカウント追加） | 未対応 | 3館全権限を持つかを server-side で検査 |
| Supabase Secret Key（旧 service_role）の漏洩 | 未対応 | `.env.local` のみ。`SUPABASE_SECRET_KEY` は `NEXT_PUBLIC_` プレフィックスを付けない。server-only モジュール経由でのみ参照し、lint ルールで client からの import を禁止 |

## 2. 入力検証

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| 予約フォーム | 未対応 | zod で server-side 検証必須。クライアント検証は UX 補助のみ |
| 写真 URL | 未対応 | `http(s):` に限定、`URL` コンストラクタで host 取得、最大長制限 |
| 予約番号 | 未対応 | 正規表現 `^(ozu|kita|toku)_\d{6}$` で検査 |
| 備考欄 | 未対応 | 500字上限、HTML は描画時にエスケープ |
| 電話番号 | 未対応 | 英数字＋ハイフンのみ、最大 20 文字 |

## 3. 攻撃観点

| 観点 | ステータス | 対策 |
| --- | --- | --- |
| SQL Injection | 未対応 | Supabase JS SDK のプリペアドクエリ、or pg パラメータ化 |
| XSS | 未対応 | RSC デフォルトエスケープ。`dangerouslySetInnerHTML` 禁止 |
| CSRF（管理画面） | 未対応 | Next.js の Server Actions は origin 検証済み。独自 POST を追加するときは header 検証 |
| Open Redirect | 未対応 | 管理画面ログイン後のリダイレクト先は allowlist |
| Brute Force（管理者ログイン） | 未対応 | Supabase Auth のレート制限 + IP ベースの追加制限（必要に応じて） |
| Enumerating 予約番号 | 未対応 | secure_token を必須化 |
| 予約スパム / Bot | 未対応 | hCaptcha 等の導入を Phase 6 で検討。当面は Honeypot フィールド |
| セッション固定 | 未対応 | Supabase Auth の既定で対応済み想定。要確認 |
| Clickjacking | 未対応 | `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'` |

## 4. 個人情報

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| ログへの氏名・電話・メール流出 | 未対応 | 専用 logger ラッパを作り、PII を除去。`console.log` 直使用禁止の ESLint ルール |
| エラー監視（Sentry 等）への流出 | 未対応 | `beforeSend` フックで PII マスキング。利用時に再検討 |
| fixture / seed への実データ混入 | 未対応 | CI で `テスト|サンプル|example` 以外の氏名を grep 検出 |
| メール本文への機微情報過多 | 未対応 | 予約内容の最小限のみ記載 |

## 5. 運用

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| secrets のコミット | 未対応 | `.env*` を `.gitignore`。`git-secrets` または `gitleaks` を pre-commit 検討 |
| Supabase Personal Access Token の滞留 | 対応中 | ADR-0013 により migration は `--db-url` 経路に統一。PAT は使用直後に必ず revoke。長期保存しない |
| Supabase バックアップ | 未対応 | プラン検討時に確認。日次スナップショット + 1週間保持を目安 |
| 監査ログの改ざん防止 | 未対応 | `audit_logs` は Service Role のみ INSERT。UPDATE / DELETE は RLS で拒否 |
| 依存脆弱性 | 未対応 | `pnpm audit` を Phase 6 でチェック。Dependabot 設定検討 |
| パスワードハッシュ | 未対応 | Supabase Auth に委譲（bcrypt 系）。自前実装するなら argon2id |

## 6. 外部リンク / 外部資源

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| 写真 URL（Google Drive 等）クリック | 未対応 | `rel="noopener noreferrer"` + `target="_blank"` |
| メール内リンクのフィッシング対策 | 未対応 | 本文に **送信元が本システムである** ことを明示し、URL は基本ドメインのみを記載 |

## 7. クライアント側

| 項目 | ステータス | 対策 |
| --- | --- | --- |
| CSP（Content Security Policy） | 未対応 | next.config で `default-src 'self'` をベースに設定 |
| HTTPS 強制 | 未対応 | Vercel 自動。HSTS ヘッダ追加 |
| Cookie フラグ | 未対応 | `Secure; HttpOnly; SameSite=Lax` |

## 8. レビュー実施記録

| 日付 | 実施者 | 対象 | 結果 |
| --- | --- | --- | --- |
| 2026-04-21 | Claude | Phase 0 docs | 初版作成、対策は未対応（該当実装未着手） |
