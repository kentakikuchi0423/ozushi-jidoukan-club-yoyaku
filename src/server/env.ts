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

function optionalEnv(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value : null;
}

export const serverEnv = {
  supabaseSecretKey: requiredEnv(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY,
  ),
  // Resend はオプション扱い。未設定ならメール送信を no-op にする（ログのみ）。
  resendApiKey: optionalEnv(process.env.RESEND_API_KEY),
  resendFromAddress: optionalEnv(process.env.RESEND_FROM_ADDRESS),
  // Vercel Cron の `/api/cron/*` は Bearer <CRON_SECRET> で保護する。
  // 未設定ならエンドポイントは 503 を返して無効化される。
  cronSecret: optionalEnv(process.env.CRON_SECRET),
} as const;
