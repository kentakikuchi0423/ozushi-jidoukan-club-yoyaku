import "server-only";

// サーバー専用の環境変数。Supabase の secret key など、クライアント同梱すると
// 致命的な値はここからしか参照しない。`import "server-only"` により client
// component からの import は build 時に失敗する。

function requiredEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `missing required environment variable: ${name}. .env.local を確認してください。`,
    );
  }
  return value;
}

export const serverEnv = {
  supabaseSecretKey: requiredEnv(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY,
  ),
} as const;
