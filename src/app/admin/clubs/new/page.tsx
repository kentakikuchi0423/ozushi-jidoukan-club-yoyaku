import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { fetchClubPrograms } from "@/server/clubs/programs";
import { fetchFacilities } from "@/server/facilities/list";

import { createClubAction } from "../actions";
import {
  ClubForm,
  type AvailableFacility,
  type ClubFormValues,
} from "../club-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブを新規登録",
  robots: { index: false, follow: false },
};

export default async function AdminClubNewPage() {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  if (ctx.facilities.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          担当館がまだ割り当てられていません。
          <br />
          全館管理者の方にご連絡ください。
        </p>
      </main>
    );
  }

  const [programs, allFacilities] = await Promise.all([
    fetchClubPrograms(),
    fetchFacilities({ includeDeleted: false }),
  ]);
  const availableFacilities: AvailableFacility[] = allFacilities
    .filter((f) => ctx.facilities.includes(f.code))
    .map((f) => ({ code: f.code, name: f.name }));

  const initial: ClubFormValues = {
    facilityCode: availableFacilities[0]?.code ?? ctx.facilities[0],
    programId: programs[0]?.id ?? "",
    startAt: "",
    endAt: "",
    capacity: 10,
    photoUrl: "",
    description: "",
  };

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
        <h1 className="text-2xl font-bold sm:text-3xl">クラブを新規登録</h1>
        <p className="text-xs leading-6 text-zinc-600">
          担当する館とクラブ・事業を選び、開催日と開始・終了時刻、定員を入力してください。
          <br />
          クラブ名・対象年齢・概要はマスター（クラブ・事業の管理）から自動で取得します。
          <br />
          登録直後は「未公開」状態です。クラブ一覧の「公開する」を押すと利用者画面に表示されます。
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <ClubForm
          mode="create"
          availableFacilities={availableFacilities}
          availablePrograms={programs}
          currentProgram={null}
          initial={initial}
          submitAction={createClubAction}
        />
      </section>
    </main>
  );
}
