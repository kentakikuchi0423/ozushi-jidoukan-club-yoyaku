import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { fetchClubProgramById } from "@/server/clubs/programs";

import { updateProgramAction } from "../../actions";
import { ProgramForm, type ProgramFormValues } from "../../program-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ・事業を編集",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProgramsEditPage({ params }: Props) {
  const { id } = await params;
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  const program = await fetchClubProgramById(id);
  if (!program) notFound();

  const initial: ProgramFormValues = {
    name: program.name,
    targetAge: program.targetAge,
    summary: program.summary,
  };

  async function submit(input: ProgramFormValues) {
    "use server";
    return updateProgramAction(id, input);
  }

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
        <h1 className="text-2xl font-bold sm:text-3xl">クラブ・事業を編集</h1>
        <p className="text-xs leading-6 text-zinc-600">
          変更内容は保存した瞬間から、このクラブ・事業を参照している既存クラブの表示にも反映されます。
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <ProgramForm mode="edit" initial={initial} submitAction={submit} />
      </section>
    </main>
  );
}
