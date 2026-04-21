# testing-strategy

テストの目的・レイヤ・ツール・CI 方針を記述する。

---

## 1. 目的

- 予約ロジックの **正しさ** を保証する（定員超過しない、繰り上げが動く、権限が効く）
- 仕様変更時のリグレッションを最小コストで検出する
- Claude Code がコード変更を行った後、自動で検証できるセーフティネットを持つ

## 2. レイヤ

| レイヤ | ツール | 対象 |
| --- | --- | --- |
| Unit | Vitest | 純粋関数、zod スキーマ、業務日計算、予約番号生成 |
| Integration | Vitest + テスト用 Supabase or pg container | Route Handler / Server Action、RLS、トランザクション |
| E2E | Playwright | 利用者予約フロー、管理者 CRUD、キャンセル/繰り上げ |

## 3. 最低限カバーする観点（Phase 3 完了時点）

- 予約確定: 定員未満で confirmed、満員で waitlisted
- 競合: 同一クラブに並列で予約が来た時に定員を超えない（統合テスト + Vitest の Promise.all）
- キャンセル: 期限内の受付、期限外の拒否
- 繰り上げ: confirmed キャンセル時、waitlist 先頭が confirmed になり通知メールが発火
- 権限: admin が他館データにアクセスできない（API 直叩きで 403）
- 予約番号: 一意 / 再利用されない / prefix が館と一致
- retention: 1年超のクラブが削除される（時間を fake）
- フォーム: 必須項目欠如、不正メール、電話形式の検証

## 4. テストデータ方針

- fixture には **実在しそうな個人情報** を入れない（`田中テスト` など明示）
- seed スクリプトは実環境で流さない前提。`NODE_ENV !== 'production'` ガード
- E2E では `@test.local` ドメインのメールを使用し、Resend には送信しない（sandbox モードまたはスタブ）

## 5. 実行

```bash
# 全ユニット
pnpm test

# 特定ファイル
pnpm test src/lib/reservations/create.test.ts

# watch
pnpm test -- --watch

# カバレッジ
pnpm test -- --coverage

# E2E（ローカル起動中の dev に対して実行するか、Playwright webServer 経由）
pnpm test:e2e

# 特定 E2E
pnpm test:e2e tests/e2e/user-booking.spec.ts
```

## 6. Playwright MCP 活用

- 対話的 UI 確認は Playwright MCP を使う（コードとして回帰に残さない実験用）
- 回帰テストにしたい挙動は Playwright test ファイルに起こす
- スクリーンショットは `tests/e2e/__snapshots__/` に格納

## 7. CI

- Phase 6 までに GitHub Actions で以下を回す
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`（Playwright の browser cache をキャッシュ）
- 当面はローカル実行で十分。リモート設定後に CI 導入

## 8. 失敗時の運用

- 失敗したテストと原因を `STATUS.md` に記録
- flaky は即 fix か skip + issue 化
- E2E の timing 依存は `waitFor` で安定化し `sleep` は禁止

## 9. パフォーマンス目安

- unit: 合計 <5秒
- integration: <30秒
- E2E: <3分（smoke のみ）
