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
| Unit | Vitest | 純粋関数、zod スキーマ、業務日計算、予約番号生成、メールテンプレ、フィルタ |
| E2E | Playwright | 利用者予約フロー（`reservation-flow.spec.ts`）、管理者 CRUD（`admin-flow.spec.ts`）、権限越権（`permission-guard.spec.ts`）、デフォルト画面遷移（`default.spec.ts`） |

## 3. 最低限カバーする観点（Phase 3 完了時点）

- 予約確定: 定員未満で confirmed、満員で waitlisted
- 競合: 同一クラブに並列で予約が来た時に定員を超えない（統合テスト + Vitest の Promise.all）
- キャンセル: 期限内の受付、期限外の拒否
- 繰り上げ: confirmed キャンセル時、waitlist 先頭が confirmed になり通知メールが発火
- **管理者キャンセル**: 締切後でも admin client 経由でキャンセル可能。同様に繰り上げが動く（ADR-0021）
- **待ちリスト再採番**: キャンセル / 繰り上げで穴ができたら、後ろの `waitlist_position` が自動で詰まる（ADR-0022）。利用者・管理者経路の両方で動く
- 権限: admin が他館データにアクセスできない（API 直叩きで 403）。reservation_id 直叩きの管理者キャンセルも別館 admin では `notFound()`
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

# E2E（Playwright が build → start を起動してから実行）
pnpm test:e2e

# 特定 E2E（opt-in シナリオは環境変数で有効化する。例:）
RUN_ADMIN_FLOW_E2E=1 pnpm test:e2e e2e/admin-flow.spec.ts
RUN_PERMISSION_E2E=1 pnpm test:e2e e2e/permission-guard.spec.ts
RUN_WAITLIST_E2E=1 pnpm test:e2e e2e/reservation-flow.spec.ts
```

## 6. 受入テスト

- 手動で確認するシナリオは [`docs/acceptance-tests.md`](./acceptance-tests.md) に
  18 本（利用者 8 + 管理者 10）を整理してある。
- 重要部分（待ちリスト → 繰り上がり、権限越権、館管理）は Playwright で自動化済み。

## 7. CI（未導入、運用開始後に検討）

- 当面はローカル / devcontainer での実行で運用する。
- 自動化候補（GitHub Actions などで導入する場合）:
  - `pnpm install --frozen-lockfile`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e`（Playwright の browser cache をキャッシュ）
- 導入のトリガーは、複数人で開発する状況になったとき / リグレッションが検知漏れ
  したときの 2 つ。

## 8. 失敗時の運用

- 失敗したテストと原因を `STATUS.md` に記録
- flaky は即 fix か skip + issue 化
- E2E の timing 依存は `waitFor` で安定化し `sleep` は禁止

## 9. パフォーマンス目安

- unit: 合計 <5秒
- integration: <30秒
- E2E: <3分（smoke のみ）
