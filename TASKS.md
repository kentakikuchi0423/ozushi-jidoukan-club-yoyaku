# TASKS

プロジェクト全体のタスク一覧。各フェーズの完了条件と進捗率を管理する。
作業のたびに該当行を更新する。STATUS.md とセットで運用する。

---

## 進捗サマリ

| Phase | 内容 | 進捗 |
| --- | --- | --- |
| 0 | 探索と設計 | 100% |
| 1 | 開発基盤 | 100% |
| 2 | DB / 認証 / 権限 | 95% |
| 3 | 利用者画面 | 95% |
| 4 | 管理画面 | 75% |
| 5 | 予約待ち / 繰り上げ / 期限管理 | 80% |
| 6 | テスト / セキュリティ / 仕上げ | 65% |

---

## Phase 0: 探索と設計 (100%)

**完了条件**: requirements / architecture / open-questions / decisions / task breakdown が揃い、Phase 1 に着手できる。

- [x] CLAUDE.md 確認
- [x] docs/requirements.md 初版
- [x] docs/architecture.md 初版
- [x] docs/open-questions.md 初版
- [x] docs/decisions.md 初版
- [x] docs/testing-strategy.md 初版
- [x] docs/security-review.md 初版
- [x] TASKS.md / STATUS.md 作成
- [x] README.md 初版
- [x] .gitignore
- [x] .claude/settings.json 初版
- [x] .claude/skills/ 素案
- [x] .claude/agents/ 素案
- [x] .devcontainer/devcontainer.json 初版

---

## Phase 1: 開発基盤 (100%)

**完了条件**: `pnpm dev` で空ページが表示され、`pnpm build / lint / typecheck / test` が全てグリーン。Playwright の smoke test が通る。

- [x] devcontainer で開発開始できることを確認
- [x] pnpm で Next.js 16 (App Router) + TypeScript スキャフォールド ※ 採択時点の create-next-app は v16 を導入
- [x] Tailwind CSS v4 セットアップ（create-next-app 標準）
- [ ] shadcn/ui 初期化 — Phase 3 で UI を実装するタイミングに延期（初期化に UI 依存が増えるため）
- [x] ESLint + Prettier（`eslint-config-prettier` で競合解消）
- [x] Vitest セットアップ（`src/lib/facility.ts` にサンプル + 3ケース）
- [x] Playwright セットアップ（`e2e/smoke.spec.ts`、build→start で検証）
- [x] .env.example 作成（Supabase / Resend / bootstrap admin の placeholder）
- [x] src/app/layout.tsx に共通レイアウト（lang="ja" / Noto Sans JP / JST 想定メタデータ）
- [x] CLAUDE.md に「コマンド」「アーキテクチャ」セクション追記
- [x] CI なし前提でローカルで全部通すことを確認（format:check / lint / typecheck / test / build / test:e2e すべて green）

---

## Phase 2: DB / 認証 / 権限 (95%)

**完了条件**: admin がログインでき、自分の館のクラブだけ閲覧できる最小ループが通る。予約テーブルの一意制約とトランザクションが動作する。

- [x] Supabase プロジェクト作成手順を docs に追記（README §セットアップ + `.env.example` + ADR-0013）
- [x] schema 設計確定（facilities / clubs / reservations / admins / admin_facilities / audit_logs）
- [x] SQL migration 作成（`supabase/migrations/20260421000000_initial_schema.sql`、RLS 含む）
- [x] migration をリモート DB に適用（`pnpm db:push`、Session pooler 経由、PAT 不使用）
- [x] seed データ（`supabase/seed.sql` placeholder、固定マスタは migration 内 INSERT）
- [x] Supabase Auth 採用を ADR 化（ADR-0014、email = ID 方式）
- [x] Supabase クライアント 3 種（browser / server / admin）を追加（ADR-0015）
- [x] `src/lib/env.ts` + `src/server/env.ts` による env fail-fast
- [x] `src/server/auth/` 実装（session / permissions / guards）
- [x] unit test: 予約番号生成（形式・境界値・round-trip）
- [x] unit test: secure_token 生成（一意性・形式）
- [x] unit test: 権限チェック（computeIsSuperAdmin / hasFacilityPermission）
- [x] 予約フォーム入力 zod スキーマ + unit test（`src/lib/reservations/input-schema.ts`）
- [x] `reservation_status` 共有型（`src/lib/reservations/status.ts`）
- [x] 予約確定・繰り上げ RPC を migration として追加（`supabase/migrations/20260422000000_reservation_rpcs.sql`、SECURITY DEFINER、リモート適用済み）
- [x] `src/server/reservations/create.ts` / `cancel.ts` の server wrapper
- [x] Next.js middleware（セッション refresh + `/admin/*` のガード）と `/admin/login` プレースホルダ
- [x] 監査ログ書き込みラッパ（`src/server/audit/log.ts`、失敗時は throw）
- [x] retention cleanup SQL 関数（`cleanup_expired_clubs` / `cleanup_old_audit_logs`、リモート適用済み）
- [x] 初期 super_admin bootstrap 手順を docs 化（`docs/operations.md`）
- [ ] 予約 RPC の integration test（pg テストコンテナ or Supabase 実 DB を Phase 6 に回す）
- [ ] retention cron の Vercel Cron 設定（Phase 6 デプロイ時に実施）
- [x] admin ログインフォーム実装（Phase 4 に移動、完了）

---

## Phase 3: 利用者画面 (95%)

**完了条件**: 一般利用者がクラブ一覧から予約 → 確認メール受信 → 予約確認画面からキャンセルまで、E2E で通る。

- [x] クラブ一覧ページ（日付降順・時間降順、`list_public_clubs` RPC 経由）
- [x] 受付終了後1年間は表示し「終了」バッジ（RPC が 1 年以内で絞り、`deriveClubAvailability` で判定）
- [x] 写真リンクの validation と「見る」/「準備中」表示（`hasValidPhotoUrl`、`rel="noopener noreferrer"`）
- [x] 空きあり / 予約待ち / 終了 のステータス表示
- [x] モバイルレイアウト（grid-cols-1 → md:grid-cols-2）
- [x] クラブ詳細ページ `/clubs/[id]`（`get_public_club` RPC + `ReservationForm`）
- [x] 予約入力フォーム（zod クライアント側 + Server Action 二重検証）
- [x] 確認画面 + 利用規約表示（フォーム内 2-step: draft → preview）
- [x] 完了画面 `/clubs/[id]/done?r=&t=&s=&p=`（予約番号・確認 URL 表示）
- [x] 予約確認・キャンセル画面 `/reservations?r=...&t=...`（`get_my_reservation` RPC + `CancelForm`）
- [x] メール送信基盤（`src/server/mail/`、Resend、未設定時 console fallback、PII はログに出さない）
- [x] confirmed / waitlisted / promoted / canceled の 4 テンプレート + 書式テスト
- [x] `createReservationAction` / `cancelReservationAction` への fire-and-forget 組み込み
- [x] テストクラブ投入 SQL と Resend 未検証ドメイン運用を `docs/operations.md` に追記
- [x] キャンセル期限表示とサーバー側の再チェック（2 営業日前 17 時 JST、`cancellation-deadline.ts`）
- [x] 利用者 E2E テスト骨格（`e2e/reservation-flow.spec.ts`、opt-in、予約 → 完了 → キャンセル）

---

## Phase 4: 管理画面 (75%)

**完了条件**: 各館 admin が自館のクラブを CRUD でき、super_admin のみがアカウント追加できる。全ての管理操作が audit_logs に記録される。

- [x] ログイン / ログアウト（`/admin/login` + `loginAction` + `logoutAction`、`next` パラメータは `/admin*` だけに制限）
- [x] ダッシュボード `/admin`（display_name、管理館、super_admin バッジ、メニュー 4 枚が実リンク化）
- [x] クラブ新規登録 `/admin/clubs/new`（自分の館のみ選択可、INSERT + 監査ログ）
- [x] クラブ一覧 `/admin/clubs`（自分の館で絞り、予約状況バッジ + 編集リンク）
- [x] クラブ編集 `/admin/clubs/[id]/edit`（UPDATE + ソフト削除、監査ログ）
- [x] パスワード変更 `/admin/password`（現パス再認証 + 新パス複雑性 + updateUser + 監査ログ）
- [x] super_admin のみ アカウント追加画面 `/admin/accounts`（invite + admins/admin_facilities INSERT + 監査ログ、管理者一覧表示）
- [x] 写真リンクの外部 URL validation（`clubInputSchema` で http(s) 限定）
- [ ] モバイル対応の仕上げ（Phase 6 の UI ポリッシュで実施）
- [ ] 管理者 E2E テスト（Phase 6）

---

## Phase 5: 予約待ち / 繰り上げ / 期限管理 (80%)

**完了条件**: キャンセル → 繰り上げ → 通知メール の流れが DB トランザクション安全に動く。1年経過クラブが自動削除される。

- [x] 定員超過時の waitlist 入り（`create_reservation` RPC）
- [x] キャンセル時の自動繰り上げ（`cancel_reservation` RPC、`clubs FOR UPDATE` 保護下）
- [x] 繰り上げ通知メール（`notifyReservationPromoted`、admin client で相手 token 取得）
- [x] キャンセル期限（2営業日前17時）のチェック（UI + Server Action）
- [x] retention cleanup SQL 関数（`cleanup_expired_clubs` / `cleanup_old_audit_logs`）
- [x] retention cron の Route Handler + `vercel.json`（`Bearer CRON_SECRET` 認証、`audit_logs` 記録）
- [ ] 状態遷移 integration test（Phase 6）
- [ ] 競合（同時予約）integration test（Phase 6）

---

## Phase 6: テスト / セキュリティ / 仕上げ (55%)

**完了条件**: docs/security-review.md のチェックリストが全て済み、主要フローが E2E で通る。公開前の最終確認が完了している。

- [x] unit test カバレッジ確認（`pnpm test --coverage` を回して、format / status / guards error class / templates shared の pure modules を追加。DB タッチする wrapper は integration test に回す）
- [ ] Next.js 16 の middleware → proxy 命名 deprecation 対応（`next build` で warning）
- [ ] integration test（pg テストコンテナ or Supabase 実 DB で予約 RPC の状態遷移と競合）
- [x] E2E: 利用者フロー（`e2e/reservation-flow.spec.ts`、opt-in）
- [x] E2E: 管理者 CRUD フロー（`e2e/admin-flow.spec.ts`、opt-in）
- [x] E2E: 未ログイン時の /admin/* リダイレクト、/api/cron/* の 401/503、セキュリティヘッダー、CSP、skip-link（`e2e/permission-guard.spec.ts`）
- [ ] 権限越権テスト（別館 admin で他館クラブ編集 → 403、anon で Server Action → 401）
- [x] CSRF / XSS / SQLi 観点レビュー（`docs/security-review.md` §3）
- [ ] レート制限 / Bot 対策（当面 Supabase 既定 + 必要に応じて hCaptcha 検討、Phase 6 後半）
- [x] 個人情報ログ出力チェック（Server Action / mail wrapper が tag / code のみログ）
- [x] セキュリティヘッダー（X-Frame-Options / HSTS / Referrer-Policy / Permissions-Policy）
- [x] CSP（nonce ベース、middleware で本番のみ付与）
- [x] a11y 基礎（skip-to-content、フォーム `aria-invalid` / `aria-describedby` / `aria-required`、focus-visible outline）
- [x] `pnpm audit`（No known vulnerabilities、初回確認済み）
- [ ] Dependabot 設定（GitHub 接続後）
- [ ] UI ポリッシュ（モバイル / アクセシビリティ、WCAG 2.1 AA 目標、残タスク：focus management on stage transitions 等）
- [x] 運用ドキュメント（`docs/operations.md` bootstrap / retention / Cron / secret ローテーション）
- [x] README の最終整備（デプロイ手順、env 一覧の更新、opt-in E2E）
- [ ] ライセンス決定（Phase 6 公開前）
