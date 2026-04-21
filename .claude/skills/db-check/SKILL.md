---
name: db-check
description: migration / 制約 / インデックス / RLS / retention の整合性を確認する。DB スキーマ変更後、migration ファイル追加後、Phase 2 / Phase 5 の完了前に使う。
---

# Skill: db-check

## 1. スキーマ確認

- `supabase/migrations/` の最新 migration が `docs/architecture.md` の DDL と一致するか
- `reservations.reservation_number` に UNIQUE 制約
- `reservations.secure_token` に UNIQUE 制約
- `reservation_number_sequences` が存在し、prefix ごとに行が入っている
- `facilities` に 3 行 (ozu / kita / toku) が seed されている
- `audit_logs` の UPDATE / DELETE が RLS で拒否される

## 2. インデックス

- `clubs (start_at desc)` がある
- `reservations (club_id, status)` がある
- `reservations (club_id, waitlist_position) where status='waitlisted'` がある

## 3. RLS ポリシー

- すべてのテーブルで RLS **ON**
- `anon`（publishable key）から
  - `clubs`: SELECT のみ（retention 内）
  - `reservations`: 直接 SELECT/UPDATE **不可**（Route Handler 経由のみ）
  - `admins` / `admin_facilities` / `audit_logs`: すべて拒否
- `service_role`（secret key）から全操作可能

## 4. Retention

- `/api/cron/retention-cleanup` の cron 登録（Vercel Cron または Supabase scheduled function）
- 実行対象: `clubs` with `start_at < now() - interval '1 year'`
- `reservations` は `on delete cascade` で同時削除
- 実行ログが `audit_logs` に残る

## 5. 動作確認

```bash
# supabase CLI を使う場合
pnpm exec supabase db reset        # 初期化
pnpm exec supabase db push         # migration 適用
pnpm exec supabase db diff         # 差分確認
```

## 6. チェック結果の残し方

- 問題があれば `STATUS.md` の「ブロッカー」に記載
- 修正するなら別タスクとして `TASKS.md` に追加
- RLS 変更などは `docs/decisions.md` に ADR として記録
