import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import {
  countClubsUsingProgram,
  fetchClubPrograms,
} from "@/server/clubs/programs";

import { DeleteProgramButton } from "./delete-program-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ・事業の編集",
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

  const programs = await fetchClubPrograms({ includeDeleted: true });
  const counts = await Promise.all(
    programs.map((p) => countClubsUsingProgram(p.id)),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/admin/clubs"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-wide text-zinc-500">
            管理画面
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">クラブ・事業の編集</h1>
          <p className="text-xs leading-6 text-zinc-600">
            クラブ作成フォームで選べる「クラブ・事業」のマスター一覧です。
            <br />
            ここで登録した名称・対象年齢・概要が各クラブの表示に反映されます。
          </p>
        </div>
        <Link
          href="/admin/programs/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          新規登録
        </Link>
      </header>

      {programs.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-600"
        >
          登録されているクラブ・事業はありません。
          <br />
          右上の「新規登録」から追加してください。
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {programs.map((p, i) => {
            const usage = counts[i] ?? 0;
            const isDeleted = p.deletedAt !== null;
            return (
              <li key={p.id}>
                <article
                  className={`flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5 ${
                    isDeleted ? "border-zinc-300 opacity-70" : "border-zinc-200"
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-zinc-900 sm:text-lg">
                        {p.name}
                      </h2>
                      {isDeleted && (
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          削除済み
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600">
                      <span className="font-medium text-zinc-500">
                        対象年齢:{" "}
                      </span>
                      {p.targetAge}
                    </p>
                    <p className="text-xs whitespace-pre-wrap text-zinc-700">
                      {p.summary}
                    </p>
                    <p className="text-xs text-zinc-500">
                      参照中のクラブ: {usage} 件
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {!isDeleted && (
                      <Link
                        href={`/admin/programs/${p.id}/edit`}
                        className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        編集
                      </Link>
                    )}
                    {!isDeleted && (
                      <DeleteProgramButton
                        programId={p.id}
                        programName={p.name}
                        referencedClubCount={usage}
                      />
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
