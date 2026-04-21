# decisions

採用した設計判断を ADR（Architecture Decision Record）形式で記録する。
撤回する場合は該当 ADR を **Status: Superseded** にし、理由を追記する。

---

## ADR-0001 Next.js 15 (App Router) + TypeScript を採用する

- **Status**: Accepted（2026-04-21）
- **Context**: フロント・API 双方を一つで持て、Vercel との親和性が高い。CLAUDE.md で Next.js + TS が前提
- **Decision**: Next.js 15 (App Router) を採用。Server Actions / Route Handlers を使い分ける
- **Consequences**: RSC の学習コスト。Server Action でのトランザクション処理パターンを docs に整理する

## ADR-0002 Supabase + Resend + Vercel を初期構成にする

- **Status**: Accepted（2026-04-21）
- **Context**: 低コスト、保守性、スマホ対応重視。無料枠で試せる
- **Decision**: Supabase（PostgreSQL + Auth）、Resend（メール）、Vercel（ホスティング）を初期採用
- **Consequences**: Supabase の RLS に慣れる必要。将来の移行は SQL + ORM 層を薄く保つことで対応

## ADR-0003 パッケージマネージャは pnpm

- **Status**: Accepted（2026-04-21）
- **Context**: 速度 / ディスク効率 / lockfile の厳格さ
- **Decision**: pnpm を採用。`corepack` で devcontainer 内に pin
- **Consequences**: Vercel で `pnpm` を明示する必要。`pnpm-lock.yaml` を必ずコミット

## ADR-0004 予約番号は `prefix_6桁` + 内部 secure_token の二重構造

- **Status**: Accepted（2026-04-21）
- **Context**: 人間可読性と推測困難性を両立。URL 直叩きでの他人予約アクセス防止
- **Decision**:
  - `reservation_number`（例: `ozu_123456`）は人間可読・ユニーク・再利用しない
  - `secure_token`（32文字以上の crypto-random）を別カラムで持つ
  - 予約確認 URL は `?r={number}&t={token}` の形で両方を要求
  - メールにのみ URL を記載
- **Consequences**: 実装時は「必ず token 一致を verify する」ユーティリティを一本化

## ADR-0005 予約確定はサーバー側の DB トランザクション + 行ロック

- **Status**: Accepted（2026-04-21）
- **Context**: 同時予約で定員超過しないことが要件
- **Decision**: `clubs` 行を `SELECT ... FOR UPDATE` で取得後、現在の confirmed 件数を数えて status を決定
- **Consequences**: `pg` の行ロック挙動に依存。Supabase の RPC（stored function）として書き、Service Role からのみ呼ぶ

## ADR-0006 利用者予約確認 URL 経由でのみ予約詳細にアクセス可能

- **Status**: Accepted（2026-04-21）
- **Context**: 個人情報保護。予約番号だけでは他人の予約に触れない
- **Decision**: 予約確認画面は `reservation_number + secure_token` の両方必須。secure_token はメールにのみ記載
- **Consequences**: 将来、電話問い合わせ窓口を作る場合の本人確認フローは別途設計

## ADR-0007 館権限は admin_facilities の多対多で管理する

- **Status**: Accepted（2026-04-21）
- **Context**: 1 admin が複数館を担当するケースがある。super_admin は「3館全て持つ admin」として定義
- **Decision**: `admin_facilities` テーブルで多対多。`is_super_admin` のブールフラグは持たず、権限集合から判定
- **Consequences**: 「super_admin」判定ユーティリティを server-side に一本化する

## ADR-0008 monorepo / multi-package にしない

- **Status**: Accepted（2026-04-21）
- **Context**: 規模が小さい。保守性と実装速度優先
- **Decision**: 単一 Next.js アプリの中で `src/lib`, `src/server` で関心を分離
- **Consequences**: 将来もし admin と user を別デプロイに分けたくなったら Turborepo 化を検討

## ADR-0009 テストは Vitest（unit）+ Playwright（E2E）

- **Status**: Accepted（2026-04-21）
- **Context**: テスト方針は docs/testing-strategy.md
- **Decision**: Vitest でドメインロジックと API、Playwright で主要導線を E2E
- **Consequences**: Playwright MCP で対話的 UI 確認も可能にする

## ADR-0010 タイムゾーンは Asia/Tokyo 固定

- **Status**: Accepted（2026-04-21）
- **Context**: 地域固有サービス、DB は timestamptz、表示は JST
- **Decision**: UI 表示と業務日判定は `Asia/Tokyo`。DB は UTC 保存（timestamptz）。日付計算には `date-fns-tz` を使う
- **Consequences**: ビジネスデイ計算（キャンセル期限判定）は必ず JST で行う

## ADR-0011 Git ブランチ戦略: `main` + `feat/*` / `fix/*` / `chore/*`

- **Status**: Accepted（2026-04-21）
- **Context**: 個人開発規模だが、小さく意味ある単位でのコミット指針が必要
- **Decision**:
  - `main` をベースブランチとする
  - 新機能は `feat/<scope>`、バグ修正は `fix/<scope>`、雑務は `chore/<scope>`
  - force push 禁止、履歴書き換え禁止
  - Conventional Commits (`feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`, `test: ...`)
- **Consequences**: 初期構築までは `main` で進め、Phase 1 の実装フェーズから feature branch 運用に切替える
