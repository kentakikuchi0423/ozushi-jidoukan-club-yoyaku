import Link from "next/link";
import type { Metadata } from "next";

import { FormMessage } from "@/components/ui";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理者ログイン",
};

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

function callbackErrorMessage(code: string | undefined): string | null {
  if (!code || !code.startsWith("callback_")) return null;
  if (code === "callback_missing_code") {
    return "メールの確認リンクが不完全です。\nもう一度招待メールの確認リンクをクリックしてください。";
  }
  if (code.startsWith("callback_otp_expired")) {
    return "確認リンクの有効期限が切れました。\n管理者に再発行を依頼してください。";
  }
  return "メール確認に失敗しました。\n恐れ入りますが管理者にお問い合わせください。";
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const callbackError = callbackErrorMessage(error);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/"
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <div className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <header className="space-y-1 text-left">
          <p className="text-sm font-medium tracking-wide text-[var(--color-muted)]">
            大洲市児童館クラブ予約
          </p>
          <h1 className="text-2xl font-semibold">管理者ログイン</h1>
          <p className="text-xs leading-6 text-[var(--color-muted)]">
            登録済みのメールアドレスとパスワードでログインしてください。
          </p>
        </header>

        {callbackError && (
          <FormMessage tone="danger">{callbackError}</FormMessage>
        )}

        <LoginForm next={next} />
      </div>
    </main>
  );
}
