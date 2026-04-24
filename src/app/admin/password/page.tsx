import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";

import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "パスワード変更",
  robots: { index: false, follow: false },
};

export default async function AdminPasswordPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/admin/clubs"
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium tracking-wide text-[var(--color-muted)]">
          管理画面
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">パスワード変更</h1>
        <p className="text-xs leading-6 text-[var(--color-muted)]">
          現在のパスワードで本人確認を行ったうえで、新しいパスワードに更新します。
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <PasswordForm />
      </section>
    </main>
  );
}
