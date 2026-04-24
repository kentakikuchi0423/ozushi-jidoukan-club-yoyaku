import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { CardDashed } from "@/components/ui";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { fetchClubPrograms } from "@/server/clubs/programs";

import { DeleteProgramButton } from "./delete-program-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ・事業の管理",
  robots: { index: false, follow: false },
};

export default async function AdminProgramsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  // 削除済みは一覧に出さない。追加日時の昇順（古いものが上）で表示する。
  const programs = await fetchClubPrograms({ orderBy: "created_at" });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/admin/clubs"
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-wide text-[var(--color-muted)]">
            管理画面
          </p>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            クラブ・事業の管理
          </h1>
          <p className="text-xs leading-6 text-[var(--color-muted)]">
            クラブ作成フォームで選べる「クラブ・事業」のマスター一覧です。
            <br />
            ここで登録した名称・対象年齢・概要が各クラブの表示に反映されます。
          </p>
        </div>
        <Link
          href="/admin/programs/new"
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          新規登録
        </Link>
      </header>

      {programs.length === 0 ? (
        <CardDashed role="status">
          登録されているクラブ・事業はありません。
          <br />
          右上の「新規登録」から追加してください。
        </CardDashed>
      ) : (
        <ul className="flex flex-col gap-3">
          {programs.map((p) => (
            <li key={p.id}>
              <article className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="text-base font-semibold text-[var(--color-foreground)] sm:text-lg">
                    {p.name}
                  </h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    <span className="font-medium">対象年齢: </span>
                    {p.targetAge}
                  </p>
                  <p className="text-xs whitespace-pre-wrap text-[var(--color-foreground)]/80">
                    {p.summary}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <Link
                    href={`/admin/programs/${p.id}/edit`}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
                  >
                    編集
                  </Link>
                  <DeleteProgramButton programId={p.id} programName={p.name} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
