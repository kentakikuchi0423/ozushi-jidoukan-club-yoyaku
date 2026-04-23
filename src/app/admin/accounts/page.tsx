import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { FACILITY_CODES, FACILITY_NAMES } from "@/lib/facility";
import { fetchAdminsList } from "@/server/auth/admin-list";
import {
  AuthenticationRequiredError,
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";
import { computeIsSuperAdmin } from "@/server/auth/permissions";

import { InviteAdminForm } from "./invite-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "アカウント追加",
  robots: { index: false, follow: false },
};

export default async function AdminAccountsPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    if (error instanceof SuperAdminRequiredError) {
      return (
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
          <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
            このページは 3
            館すべての権限を持つ管理者（全館管理者）のみ利用できます。
          </p>
        </main>
      );
    }
    throw error;
  }

  const admins = await fetchAdminsList();

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

      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          管理画面
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">アカウント追加</h1>
        <p className="text-xs leading-6 text-zinc-600">
          新しい管理者を招待します。
          <br />
          送信されたメールのリンクから初回パスワードを設定すると、指定した館の管理者としてログインできるようになります。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">
          新しい管理者を招待
        </h2>
        <InviteAdminForm />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">
          現在の管理者 ({admins.length})
        </h2>
        {admins.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600">
            登録されている管理者はいません。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {admins.map((a) => {
              const isSuper = computeIsSuperAdmin(a.facilities);
              return (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {a.displayName ?? "(表示名未設定)"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {a.email ?? "(email 取得失敗)"}
                      </p>
                    </div>
                    {isSuper && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                        全館管理者
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {FACILITY_CODES.map((code) => {
                      const has = a.facilities.includes(code);
                      return (
                        <span
                          key={code}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            has
                              ? "bg-zinc-200 text-zinc-800"
                              : "bg-zinc-50 text-zinc-400 line-through"
                          }`}
                        >
                          {FACILITY_NAMES[code]}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
