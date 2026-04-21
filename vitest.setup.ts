import "@testing-library/jest-dom/vitest";

// 環境変数のモジュール初期化時バリデーション（src/lib/env.ts /
// src/server/env.ts）が Vitest 実行時にも通るよう、ダミー値を入れておく。
// 実値が `.env.local` に設定されていればそちらが優先される（`??=` のため）。
// 単体テストで実際にネットワークへ出ないクライアントを組む目的であり、
// ここで使うのはプレースホルダに過ぎない。
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "sb_publishable_test";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
process.env.SUPABASE_SECRET_KEY ??= "sb_secret_test";
