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
| 3 | 利用者画面 | 0% |
| 4 | 管理画面 | 0% |
| 5 | 予約待ち / 繰り上げ / 期限管理 | 0% |
| 6 | テスト / セキュリティ / 仕上げ | 0% |

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
- [ ] admin ログインフォーム実装（Phase 4）

---

## Phase 3: 利用者画面 (0%)

**完了条件**: 一般利用者がクラブ一覧から予約 → 確認メール受信 → 予約確認画面からキャンセルまで、E2E で通る。

- [ ] クラブ一覧ページ（日付降順・時間降順）
- [ ] 受付終了後1年間は表示し「終了」バッジ
- [ ] 写真リンクの validation と「見る」/「準備中」表示
- [ ] 予約入力フォーム（バリデーション）
- [ ] 確認画面 + 利用規約表示
- [ ] 完了画面 + メール送信
- [ ] 予約確認・キャンセル画面（予約番号入力）
- [ ] キャンセル確認メール
- [ ] 予約待ち時の順位通知メール
- [ ] モバイルレイアウト確認
- [ ] 利用者 E2E テスト

---

## Phase 4: 管理画面 (0%)

**完了条件**: 各館 admin が自館のクラブを CRUD でき、super_admin のみがアカウント追加できる。全ての管理操作が audit_logs に記録される。

- [ ] ログイン / ログアウト
- [ ] ダッシュボード（新規登録 / クラブ一覧 / パスワード変更 導線）
- [ ] クラブ新規登録（自分の館のみ選択可）
- [ ] クラブ一覧（自分の館のみ）
- [ ] クラブ編集
- [ ] パスワード変更
- [ ] super_admin のみ アカウント追加画面
- [ ] 写真リンクの外部 URL validation
- [ ] モバイル対応
- [ ] 管理者 E2E テスト

---

## Phase 5: 予約待ち / 繰り上げ / 期限管理 (0%)

**完了条件**: キャンセル → 繰り上げ → 通知メール の流れが DB トランザクション安全に動く。1年経過クラブが自動削除される。

- [ ] 定員超過時の waitlist 入り
- [ ] キャンセル時の自動繰り上げ（先頭）
- [ ] 繰り上げ通知メール
- [ ] キャンセル期限（2営業日前17時）のチェック
- [ ] retention cleanup（1年以上前のクラブと予約削除）
- [ ] 状態遷移テスト
- [ ] 競合（同時予約）テスト

---

## Phase 6: テスト / セキュリティ / 仕上げ (0%)

**完了条件**: docs/security-review.md のチェックリストが全て済み、主要フローが E2E で通る。公開前の最終確認が完了している。

- [ ] unit test カバレッジ確認
- [ ] integration test
- [ ] E2E（利用者 + 管理者）
- [ ] 権限越権テスト
- [ ] CSRF / XSS / SQLi 観点レビュー
- [ ] レート制限 / Bot 対策の要否判断
- [ ] 個人情報ログ出力チェック
- [ ] UI ポリッシュ（アクセシビリティ含む）
- [ ] 運用ドキュメント（本番メール切替、バックアップ、障害対応）
- [ ] README 更新
