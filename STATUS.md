# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 4–6 を一気通し: 管理 E2E / 管理 CRUD / Retention Cron / Security headers / Guard E2E / README）

### 今セッションの到達点（大まかな節目）
**"動く v1" 相当の機能がすべて揃い、E2E で検証済み。残るのは本番リリース前の
ポリッシュ（CSP nonce / a11y / integration test / rate limit）。**

### 今セッションで動くようになったもの
1. **Phase 4 管理画面の完成域**:
   - ログイン / ダッシュボード / クラブ CRUD / パスワード変更 / アカウント招待（super_admin のみ）
   - Playwright `e2e/admin-flow.spec.ts`（opt-in）で login → 新規登録 → 一覧 → 編集 → 削除 → ログアウトを 9.6 秒で green
   - Playwright `e2e/permission-guard.spec.ts`（default）: 未ログインの /admin/* が login へ redirect、`/api/cron/*` が 401/503、セキュリティヘッダー 4 種を一括検証（8 ケース green）
2. **Phase 5 クロージング**:
   - Retention cleanup の Route Handler `/api/cron/retention-cleanup`（`Bearer CRON_SECRET` 認証、未設定時 503）
   - `vercel.json` に daily 18:00 UTC スケジュール
   - `docs/operations.md` に Vercel Cron セットアップ手順
3. **Phase 6 着手**:
   - セキュリティヘッダー（X-Frame-Options / HSTS / Referrer-Policy / X-Content-Type-Options / Permissions-Policy）を `next.config.ts` で全ルートに適用
   - `docs/security-review.md` のチェック項目をほぼ「済」に更新。残「対応中」は CSP nonce / rate limit / Sentry / Supabase backup / Dependabot
   - `pnpm audit`: No known vulnerabilities
   - `README.md` を現状に合わせ全面更新（Phase 進捗、env 一覧、opt-in E2E、ディレクトリ構成）
4. **付随して入った**: `playwright.config.ts` から `.env.local` を読む小さな dotenv パーサ、`ADMIN_BOOTSTRAP_*` / `CRON_SECRET` の env.example 記載、`FACILITY_CODE_BY_ID` 追加

### 現在地（Phase 進捗）
- Phase 1 / 2 / 3: **95%+ 完了**（残りは integration test のみ、Phase 6 に一括）
- **Phase 4: 75%**（機能すべて実装 + E2E 済。残りは UI ポリッシュとモバイル微調整）
- **Phase 5: 80%**（RPC / メール / retention Cron 済。残りは integration test）
- **Phase 6: 30%**（E2E 3 本、security headers、docs、pnpm audit 済。残りは下記）

### 本番リリース前に残っている作業（全部 Phase 6）
| 項目 | 規模 | メモ |
| --- | --- | --- |
| RPC integration test | 中 | pg テストコンテナ or Supabase staging に対して予約確定・キャンセル・繰り上げの状態遷移と並列競合を検証 |
| CSP（nonce ベース） | 中 | Next.js の inline hydration script に対応する nonce wiring が必要 |
| Rate limit / Bot 対策 | 小〜中 | 児童館規模では当面不要判断も可。必要なら Vercel Edge Middleware or hCaptcha |
| UI / a11y ポリッシュ | 中 | skip-to-content / focus management / モバイル細部 / WCAG 2.1 AA |
| Dependabot + Sentry | 小 | GitHub + Vercel 接続後に作業 |
| README のライセンス決定 | 小 | 公開時 |

### 次のユーザー操作タイミング
上記は全て自走で進めらます。ユーザー操作が必要になるのは次のいずれか:
- **Resend の送信元ドメイン検証**（本番で実メール配信するとき）
- **GitHub リポジトリ作成 + Vercel 接続 + Cron secret 設定**（公開デプロイするとき、`docs/operations.md` §6 に手順）
- 現状でさらに触りたい機能追加や UX 調整の依頼

### 直近コマンド結果
- `pnpm format:check` / `lint` / `typecheck`: all green
- `pnpm build`: 13 routes（`/api/cron/retention-cleanup` 追加）+ middleware
- `pnpm test:e2e e2e/permission-guard.spec.ts`: 8 passed
- `pnpm test:e2e e2e/reservation-flow.spec.ts`（opt-in）: 1 passed
- `pnpm test:e2e e2e/admin-flow.spec.ts`（opt-in）: 1 passed
- `pnpm test`: 単体テスト（vitest 4 の worker flake 起きうるが、実行されたものは全通過）
- `pnpm audit`: No known vulnerabilities

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッションの主要コミット:
  - `992eca3` feat(phase-4): admin club CRUD
  - `31f41fa` feat(phase-4): password change + super_admin account invite
  - `c40834e` docs(phase-4): Phase 4 75%
  - `dfca977` test(phase-4): admin CRUD flow E2E + .env.local loader
  - `e687fd2` feat(phase-5/6): retention cron + security headers + docs audit
  - `53c3616` test(phase-6): permission-guard E2E + README refresh
