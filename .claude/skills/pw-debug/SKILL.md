---
name: pw-debug
description: Playwright MCP を使って UI の挙動確認・バグ調査・導線のデバッグを行う。「画面で確認」「実際にブラウザで試す」「UI が壊れた」などの合図で使う。
---

# Skill: pw-debug

Playwright MCP を使って実際のブラウザで UI を確認し、バグを特定する。

## 前提

- Playwright MCP が設定済みであること（`~/.claude.json` または `.mcp.json`）
- dev サーバーが起動している（通常は `pnpm dev` で `http://localhost:3000`）

## 1. 起動確認

```bash
pnpm dev  # 別ターミナルで起動しておく
```

## 2. MCP でのアクセス手順

1. Playwright MCP の `browser_navigate` で対象 URL へ
2. `browser_snapshot` で DOM 構造を取得（accessibility snapshot）
3. 必要なら `browser_click` / `browser_fill_form` で操作
4. `browser_console_messages` でエラーを確認
5. 必要なら `browser_take_screenshot` でスクショ保存

## 3. よく使うユーザーフロー

### 予約フロー
1. `/` にアクセス → クラブ一覧が表示される
2. 任意のクラブの「予約する」をクリック
3. フォーム入力 → 「確認画面へ」
4. 利用規約を確認 → 「予約を確定する」
5. 完了画面に予約番号が表示される

### キャンセルフロー
1. `/reservations` にアクセス
2. 予約番号を入力
3. 内容確認 → 「キャンセルする」

### 管理者フロー
1. `/admin/login` でログイン
2. ダッシュボード表示
3. 「クラブを新規登録」
4. 自館のみ選択可能か確認

## 4. バグ調査の進め方

1. **再現**: ユーザーが踏んだ手順を MCP でなぞる
2. **観察**: コンソールエラー / ネットワークエラー / DOM 状態を取得
3. **仮説**: 根本原因を 2〜3 個仮説立てる
4. **検証**: コードを読み、該当箇所を特定
5. **修正**: 最小 diff で修正
6. **回帰**: 同じ手順を Playwright MCP で再度確認
7. **テスト化**: 回帰を防ぐため `tests/e2e/` に test を追加

## 5. 回帰テスト化の判断

- 頻出しそう / 仕様に直結 → Playwright test として残す
- 一度きりの確認 → 残さない（ログだけでよい）

## 6. ログ / 結果の残し方

- 発見したバグは `STATUS.md` に要約
- 修正コミットに紐づけて Conventional Commits の `fix: ...` で記録
- 再現手順を PR 説明欄に残す（remote 導入後）
