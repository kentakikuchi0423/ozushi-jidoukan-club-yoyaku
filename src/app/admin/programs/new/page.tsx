import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";

import { createProgramAction } from "../actions";
import { ProgramForm, type ProgramFormValues } from "../program-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ・事業の新規登録",
  robots: { index: false, follow: false },
};

export default async function AdminProgramsNewPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  const initial: ProgramFormValues = { name: "", targetAge: "", summary: "" };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/admin/programs"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          ← クラブ・事業一覧に戻る
        </Link>
      </nav>

      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          管理画面
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          クラブ・事業の新規登録
        </h1>
        <p className="text-xs leading-6 text-zinc-600">
          ここで登録したクラブ・事業は、クラブ作成時のドロップダウンから選べるようになります。
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <ProgramForm
          mode="create"
          initial={initial}
          submitAction={createProgramAction}
        />
      </section>
    </main>
  );
}
