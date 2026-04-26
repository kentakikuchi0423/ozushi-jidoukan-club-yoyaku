import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { FormMessage } from "@/components/ui";
import {
  AuthenticationRequiredError,
  requireSuperAdmin,
  SuperAdminRequiredError,
} from "@/server/auth/guards";
import { fetchFacilityById } from "@/server/facilities/list";

import { updateFacilityAction } from "../../actions";
import { FacilityForm, type FacilityFormValues } from "../../facility-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "館を編集",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminFacilityEditPage({ params }: Props) {
  const { id } = await params;
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId)) notFound();

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

  const facility = await fetchFacilityById(parsedId);
  if (!facility || facility.deletedAt) notFound();

  const initial: FacilityFormValues = {
    code: facility.code,
    name: facility.name,
    phone: facility.phone,
  };

  async function submit(input: FacilityFormValues) {
    "use server";
    return updateFacilityAction(parsedId, input);
  }

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
        <h1 className="text-2xl font-bold sm:text-3xl">館を編集</h1>
        <p className="text-xs leading-6 text-zinc-600">
          館名・電話番号は保存した瞬間から利用者画面・メールに反映されます。
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <FacilityForm mode="edit" initial={initial} submitAction={submit} />
      </section>
    </main>
  );
}
