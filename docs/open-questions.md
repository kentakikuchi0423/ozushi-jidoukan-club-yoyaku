# open-questions

このファイルは、設計過程で出てきた **未確定事項（open question）** を記録する場所です。
決定した事項は `decisions.md` の ADR に転記し、ここからは削除します。

> 過去の論点（Q1〜Q14）はすべて `decisions.md` の ADR に決着済みです（履歴は `git log -p docs/open-questions.md` で参照可）。
> 新しい未確定事項は以下に追加してください。

---

## Q15. Server Action ログでの `error.message` の取り扱い [Med]

- 現状: `src/app/clubs/[id]/actions.ts` ほか複数箇所の `console.error` に `error.message` を含めている。`docs/security-review.md` §4 では「code / message / hint」を許容するが、`details` は除外する方針
- 懸念: PG エラーの一部（`22P02` invalid input syntax / `22001` value too long など）は `message` 自体に offending value（利用者が入力した phone / email など）が含まれる可能性がある。zod が事前に弾いている入力なら可能性は極めて低いが、CHECK 制約と zod の regex がズレた場合に値が漏れうる
- 推奨案: **A. 現状維持**（security-review の許容範囲内、debug 性を維持）／ **B. message を除外し、code（PG SQLSTATE）+ tag のみログに残す**（より安全側、但し debug 性が落ちる）
- 影響範囲: `src/app/clubs/[id]/actions.ts`、`src/app/reservations/actions.ts`、`src/app/admin/reservations/[id]/cancel/actions.ts`、`src/server/reservations/create.ts` の 4 箇所程度。`ReservationConflictError` などの error class に `code` を載せる軽微なリファクタが必要

## Q16. `list_public_clubs` / `get_public_club` のソート安定化 [Low]

- 現状: 公開クラブ一覧の ORDER BY は `c.start_at desc` のみ（migration `20260424000002_clubs_published_at.sql:99`）。CLAUDE.md 固定要件「クラブ一覧は **日付降順・時間降順**」は、`start_at` が `timestamptz`（日付+時刻）なので 1 列で表現できており、実用上の問題はない
- 懸念: 同一 `start_at` のクラブが複数登録された場合（同時刻開催の隣館同士など）、表示順が undefined になる
- 推奨案: 二次キーとして `c.id desc` を ORDER BY に追加し、決定的な順序を保証する（新規 migration 1 本）
- 影響範囲: 新規 migration 1 本（`list_public_clubs` / `get_public_club` の `ORDER BY c.start_at desc, c.id desc` への差し替え）。アプリ側コードへの影響なし
