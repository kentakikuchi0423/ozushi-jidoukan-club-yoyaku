# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-23（Phase 6 深掘り続: カバレッジ拡充 + architecture 更新 + format util 抽出）

### 今セッションで増えたもの
1. **単体テスト追加 18 ケース**:
   - `src/lib/format.test.ts` (10): `formatJst{Date,Time,DateRange}` の JST 一致、`datetimeLocalJstToUtcIso` / `utcIsoToDatetimeLocalJst` の round-trip と day rollover
   - `src/lib/reservations/status.test.ts` (5): enum 順序と `isReservationStatus` の型ガード
   - `src/server/auth/guards.test.ts` (3): 3 種の typed error の shape（name / message / facility）
   - `src/server/mail/templates/shared.test.ts` (残りは既存分)
2. **`src/lib/format.ts` に datetime-local 変換ヘルパを抽出**:
   - admin/clubs/actions.ts の private `datetimeLocalToUtcIso` と edit page の `toDatetimeLocalJst` を統合
   - どちらも `datetimeLocalJstToUtcIso` / `utcIsoToDatetimeLocalJst` として共有 util に
3. **`docs/architecture.md` を Phase 0 プランから実装実態に書き直し**:
   - 技術スタックを実績バージョンに更新（Next 16.2 / Tailwind v4 / zod 4 / resend 6 等）
   - ディレクトリ構成を現状ツリーに再掲（src/app/admin の全ルート、src/server の全モジュール）
   - DDL 抜粋を現行 migration に一致（CHECK 制約、partial unique index）
   - RLS policy 一覧、7 本の SECURITY DEFINER 関数、実装済み予約・キャンセル・繰り上げフロー、Vercel Cron、CSP / ヘッダー
4. **vitest 4 の poolOptions 移動対応**:
   - `test.poolOptions` deprecation 警告を解消、top-level `poolOptions` に（`@ts-expect-error` 一行で型の穴埋め）
   - `pool: "threads"` + `singleThread: true` に変更し、devcontainer の CPU 競合を回避

### 現在地
- Phase 1 / 2 / 3: **95%+**
- Phase 4: **75%**
- Phase 5: **80%**
- **Phase 6: 65%**（前回 55% → カバレッジ + architecture refresh で +10）

### 残っている作業（ユーザー操作 or 本番リリース待ち）
| 項目 | 規模 | 備考 |
| --- | --- | --- |
| Integration test（RPC 状態遷移・並列競合） | 中 | Supabase staging か pg container が必要 |
| 権限越権 E2E（別館 admin ケース） | 小〜中 | 2 人目 admin を Supabase Studio で投入してから |
| Rate limit / Bot 対策 | 小〜中 | 児童館規模での必要性の判断 |
| Next.js 16 の middleware → proxy 移行 | 小 | 現時点は warning のみ。非互換時に着手 |
| Dependabot / Sentry | 小 | GitHub / Vercel 接続後 |
| UI ポリッシュ深掘り（stage transition focus 等） | 中 | 実機フィードバックとあわせて |
| ライセンス決定 | 小 | ユーザー判断 |
| Supabase backup 運用確認 | 小 | プラン次第 |

### 次にユーザー操作が必要になる地点
- **本番リリース準備**: GitHub リポジトリ作成 + Vercel 接続 + `CRON_SECRET` 設定 + Resend ドメイン検証
- **実機検証 + フィードバック**: 管理画面・利用者画面を触って文言・UX の調整点があれば
- 上記のいずれも無ければ、残タスクのうち `A. UI さらに手を入れる / B. 別 admin を投入して権限越権テスト / C. リリース手順 doc を整える` のどれから行くかご指示いただきたい

### 直近コマンド結果
- `pnpm format:check` / `lint` / `typecheck`: all green
- `pnpm build`: 13 routes + middleware（Next.js 16 の `middleware → proxy` deprecation は warning のみ、動作は問題なし）
- `pnpm test`: 実行回ごとに 55–74 ケース pass（1–3 件の worker 起動 flake、個別実行は安定）
- `pnpm audit`: No known vulnerabilities
- `pnpm test:e2e`（default）: 13 passed / 2 skipped（opt-in）

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッション追加分:
  - `9e805a6` test(phase-6): coverage pass + architecture doc refresh
  - `814cc18` docs(status): Phase 6 at 55% after CSP + a11y + focus management
  - `f04e3f0` feat(phase-6): focus-manage the form error alert on submit failure
  - `a9a3769` feat(phase-6): CSP nonce via middleware + a11y basics
