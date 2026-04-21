# 大洲市児童館クラブ予約システム

愛媛県大洲市の以下3施設のクラブ予約を行うための Web システム。

- 大洲児童館
- 喜多児童館
- 徳森児童センター

利用者はブラウザからクラブを予約でき、管理者は権限に応じてクラブの登録・編集・アカウント管理を行う。

## ドキュメント

| 目的 | ファイル |
| --- | --- |
| プロジェクト憲章 / Claude Code への指示 | [CLAUDE.md](./CLAUDE.md) |
| タスクと進捗 | [TASKS.md](./TASKS.md) |
| 現在地と次の一手 | [STATUS.md](./STATUS.md) |
| 要件詳細 | [docs/requirements.md](./docs/requirements.md) |
| アーキテクチャ | [docs/architecture.md](./docs/architecture.md) |
| 未確定事項 | [docs/open-questions.md](./docs/open-questions.md) |
| 採用した設計判断 | [docs/decisions.md](./docs/decisions.md) |
| テスト戦略 | [docs/testing-strategy.md](./docs/testing-strategy.md) |
| セキュリティレビュー | [docs/security-review.md](./docs/security-review.md) |

## 状態

現在は **Phase 0（探索と設計） 完了 / Phase 1（開発基盤） 未着手** の状態。Next.js アプリ本体はまだスキャフォールドされていない。進捗の詳細は [STATUS.md](./STATUS.md) を参照。

## 技術スタック（予定）

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL / Auth) — DB と管理者認証
- Resend — メール送信
- Vercel — ホスティング
- Playwright — E2E テスト
- Vitest — ユニットテスト

詳細と採用理由は [docs/decisions.md](./docs/decisions.md)。

## 開発環境

VS Code devcontainer を用意している。VS Code の「Reopen in Container」でコンテナ内開発を開始できる。

Phase 1 着手後に以下のコマンドが利用可能になる予定。

```bash
pnpm install       # 依存インストール
pnpm dev           # 開発サーバー
pnpm build         # ビルド
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest
pnpm test:e2e      # Playwright
```

## Git リモート

remote 未設定。GitHub 公開リポジトリを作成した後、以下で設定する。

```bash
git remote add origin git@github.com:<owner>/ozushi-jidoukan-club-yoyaku.git
git push -u origin main
```

公開前に **secrets が含まれていないこと**、**個人情報を含む fixture が無いこと** を必ず確認する。

## ライセンス

未定（Phase 6 までに決定予定）。
