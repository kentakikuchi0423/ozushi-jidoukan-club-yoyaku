import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { CardDashed, FormMessage } from "@/components/ui";
import {
  AuthenticationRequiredError,
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";
import { fetchFacilities } from "@/server/facilities/list";

import { DeleteFacilityButton } from "./delete-facility-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "館の管理",
  robots: { index: false, follow: false },
};

export default async function AdminFacilitiesPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    if (error instanceof SuperAdminRequiredError) {
      return (
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
          <nav className="mb-4 text-sm">
            <Link
              href="/admin/clubs"
              className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
            >
              ← クラブ一覧に戻る
            </Link>
          </nav>
          <FormMessage tone="warning">
            このページは全館管理者のみ利用できます。
          </FormMessage>
        </main>
      );
    }
    throw error;
  }

  // 削除済みは一覧に出さない。
  const facilities = await fetchFacilities({ includeDeleted: false });

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
          <h1 className="text-2xl font-semibold sm:text-3xl">館の管理</h1>
          <p className="text-xs leading-6 text-[var(--color-muted)]">
            児童館・児童センターのマスター一覧です。
            <br />
            館名・電話番号はここで変更でき、利用者向けメールの問い合わせ先にも反映されます。
            <br />
            prefix（予約番号の識別子）は予約履歴との整合のため作成後に変更できません。
          </p>
        </div>
        <Link
          href="/admin/facilities/new"
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          新規登録
        </Link>
      </header>

      {facilities.length === 0 ? (
        <CardDashed role="status">
          登録されている館はありません。
          <br />
          右上の「新規登録」から追加してください。
        </CardDashed>
      ) : (
        <ul className="flex flex-col gap-3">
          {facilities.map((f) => (
            <li key={f.id}>
              <article className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-base font-semibold text-[var(--color-foreground)] sm:text-lg">
                    {f.name}
                  </h2>
                  <p className="text-xs text-[var(--color-muted)]">
                    <span className="font-medium">prefix: </span>
                    <code className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[var(--color-foreground)]">
                      {f.code}
                    </code>
                    <span className="ml-2">（予約番号: {f.code}_123456）</span>
                  </p>
                  <p className="text-xs text-[var(--color-foreground)]/80">
                    <span className="font-medium text-[var(--color-muted)]">
                      電話:{" "}
                    </span>
                    {f.phone}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <Link
                    href={`/admin/facilities/${f.id}/edit`}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
                  >
                    編集
                  </Link>
                  <DeleteFacilityButton
                    facilityId={f.id}
                    facilityName={f.name}
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
