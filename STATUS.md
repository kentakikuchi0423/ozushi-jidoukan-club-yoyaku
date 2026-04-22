# STATUS

最新のセッションの作業結果、現在地、次の一手、ブロッカーを記録する。
セッション終了時に必ず更新する。会話履歴ではなく、このファイルを信頼の置ける継続情報源とする。

---

## 最終更新: 2026-04-22（Phase 6 深掘り: CSP nonce / a11y / focus management）

### 今セッションで追加された硬さ（前回チェックポイント以降）
1. **CSP nonce**（`src/middleware.ts`）:
   - リクエスト毎に 16 バイト base64 nonce を生成、`x-nonce` ヘッダで Next.js に渡す（hydration inline script に自動付与）
   - `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; connect-src 'self' <supabase>; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`
   - 本番のみ（`NODE_ENV === "production"`）。dev の HMR は壊さない
2. **A11y ベース**:
   - `src/app/layout.tsx` に skip-to-content リンク（`href="#main-content"`、focus 時に表示）
   - reservation-form / club-form / login-form / password-form / invite-form の全入力に `aria-invalid` / `aria-describedby` / `aria-required`、エラー/ヒント段落に id
   - required の `*` を `aria-hidden` に（スクリーンリーダーに "star" と読ませない）
   - 入力要素は `focus-visible:outline-2 outline-offset-2 outline-zinc-500`
   - 送信失敗時、form-level エラー `<p role="alert" tabIndex={-1}>` に自動 focus（reservation-form / club-form）
3. **E2E 拡張**:
   - `permission-guard.spec.ts` に CSP nonce 検証 + skip-link DOM 検証を追加
   - **default 13 / opt-in 2（reservation / admin）すべて green**。CSP 下でも admin CRUD E2E は 9.7 秒で通る
4. **docs/security-review.md**: CSP を「済」に、2026-04-22 Phase 6 深掘りエントリを追加

### 最新進捗
- Phase 1 / 2 / 3: **95%+ 完了**
- Phase 4: **75%**
- Phase 5: **80%**
- **Phase 6: 55%**（前回 30% → CSP、a11y、E2E 拡張で +25）

### 残っている作業（本番リリース前の polish）
| 項目 | 規模 | メモ |
| --- | --- | --- |
| Integration test（RPC 状態遷移・並列競合） | 中 | Supabase staging か pg container が必要 |
| 権限越権 E2E（別館 admin が他館を触れない） | 小〜中 | 2 人目の admin を投入してから |
| レート制限 / Bot 対策 | 小〜中 | 児童館規模では当面不要判断も可 |
| Dependabot + Sentry | 小 | GitHub / Vercel 接続後 |
| UI ポリッシュ深掘り（モバイル細部、focus on stage transitions など） | 中 | 実機検証と組み合わせ |
| ライセンス決定 | 小 | ユーザー判断 |
| Supabase バックアップの運用方針 | 小 | プラン確認 |

### 次のユーザー操作タイミング
ここまで全部自走でした。**次に必要なのは以下のいずれか**:
- **本番リリース準備**: GitHub リポジトリ作成 + Vercel 接続 + `CRON_SECRET` 設定 + Resend ドメイン検証（[docs/operations.md](./docs/operations.md)）
- **実機で触ってフィードバック**: UI の文言・挙動・スマホ表示などで調整したい点があれば指示
- **新機能追加の要望**（v1 の要件はすべて網羅済み）

### 直近コマンド結果
- `pnpm format:check` / `lint` / `typecheck`: all green
- `pnpm build`: 13 routes（`/`, `/admin/*` 7 枚, `/clubs/*` 2 枚, `/reservations`, `/api/cron/retention-cleanup`, `/_not-found`）+ middleware
- `pnpm test:e2e`（default）: **13 passed / 2 skipped**
- `RUN_ADMIN_FLOW_E2E=1 pnpm test:e2e e2e/admin-flow.spec.ts`: **1 passed**（CSP 下でも OK）
- `RUN_RESERVATION_FLOW_E2E=1 pnpm test:e2e e2e/reservation-flow.spec.ts`: **1 passed**
- `pnpm audit`: No known vulnerabilities

### Git
- ブランチ: `main`
- リモート: 未設定
- 本セッションの最新 5 コミット:
  - `f04e3f0` feat(phase-6): focus-manage the form error alert on submit failure
  - `a9a3769` feat(phase-6): CSP nonce via middleware + a11y basics
  - `c2013a7` docs(status): v1-complete checkpoint
  - `53c3616` test(phase-6): permission-guard E2E + README refresh for v1 readiness
  - `e687fd2` feat(phase-5/6): retention cron endpoint + security headers + docs audit
