import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  AuthenticationRequiredError,
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";

import { createFacilityAction } from "../actions";
import { FacilityForm, type FacilityFormValues } from "../facility-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "館を新規登録",
  robots: { index: false, follow: false },
};

export default async function AdminFacilityNewPage() {
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
            このページは全館管理者のみ利用できます。
          </p>
        </main>
      );
    }
    throw error;
  }

  const initial: FacilityFormValues = { code: "", name: "", phone: "" };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/admin/facilities"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          ← 館の管理に戻る
        </Link>
      </nav>

      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          管理画面
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">館を新規登録</h1>
        <p className="text-xs leading-6 text-zinc-600">
          新しい児童館・児童センターを追加します。
          <br />
          prefix は予約番号の識別子として使われます（例:
          「ozu」→「ozu_123456」）。
          <br />
          作成後は、現在の全館管理者にも自動で権限が付与されます。
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <FacilityForm
          mode="create"
          initial={initial}
          submitAction={createFacilityAction}
        />
      </section>
    </main>
  );
}
