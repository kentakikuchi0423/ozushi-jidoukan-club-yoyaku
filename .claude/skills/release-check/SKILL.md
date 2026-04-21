---
name: release-check
description: Phase 完了時 / リリース前の最終確認を行う。build / lint / typecheck / test を通し、README と .env.example を最新化する。「リリース前」「Phase 完了」の合図で使う。
---

# Skill: release-check

## 1. コマンド一式

すべてグリーンになることを確認する。

```bash
pnpm install --frozen-lockfile   # lockfile 整合
pnpm lint                        # ESLint
pnpm typecheck                   # tsc --noEmit
pnpm test                        # Vitest
pnpm test:e2e                    # Playwright（dev/prod preview に対して）
pnpm build                       # Next.js build
```

失敗した場合は `STATUS.md` に失敗内容と次アクションを必ず記載。

## 2. ドキュメント整合

- `README.md` に不足項目（新しい env、新しいコマンド）がないか
- `CLAUDE.md` の「コマンド」「アーキテクチャ」セクションが最新か
- `.env.example` が実装で使う env をすべてカバーしているか
- `TASKS.md` の該当 Phase が 100% になっているか
- `STATUS.md` の「現在地」「次にやること」が更新されているか

## 3. セキュリティチェック

- `docs/security-review.md` のチェック項目を該当範囲で更新
- `git log` を辿って secrets がコミットされていないか確認
- `pnpm audit` で critical / high 脆弱性がないか確認

## 4. 個人情報チェック

- `console.log` / `console.error` で PII が出ていないか grep
- seed / fixture に実在しそうな名前やメールがないか grep
- エラーハンドリングで PII をユーザーに返していないか

## 5. Git 整理

- コミットメッセージが Conventional Commits に沿っているか
- 意味のない WIP コミットが残っていないか
- `git status` がクリーンか

## 6. 最終サマリ

以下のフォーマットで `STATUS.md` に追記する。

```
## release-check: <日付>
- build: OK
- lint: OK
- typecheck: OK
- test: OK (<件数> passed)
- test:e2e: OK
- security checklist: <%完了>
- 未解決: なし / あれば箇条書き
```
