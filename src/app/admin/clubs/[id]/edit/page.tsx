import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { utcIsoToDatetimeLocalJst } from "@/lib/format";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { fetchClubForAdmin } from "@/server/clubs/admin-detail";
import {
  fetchClubProgramById,
  fetchClubPrograms,
} from "@/server/clubs/programs";
import { fetchFacilities } from "@/server/facilities/list";

import { deleteClubAction, updateClubAction } from "../../actions";
import {
  ClubForm,
  type AvailableFacility,
  type ClubFormValues,
} from "../../club-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブを編集",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminClubEditPage({ params }: Props) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  const club = await fetchClubForAdmin(id, ctx.facilities);
  if (!club) notFound();

  const [programs, currentProgram, allFacilities] = await Promise.all([
    fetchClubPrograms(),
    fetchClubProgramById(club.programId),
    fetchFacilities({ includeDeleted: false }),
  ]);
  const availableFacilities: AvailableFacility[] = allFacilities
    .filter((f) => ctx.facilities.includes(f.code))
    .map((f) => ({ code: f.code, name: f.name }));

  const initial: ClubFormValues = {
    facilityCode: club.facilityCode,
    programId: club.programId,
    startAt: utcIsoToDatetimeLocalJst(club.startAt),
    endAt: utcIsoToDatetimeLocalJst(club.endAt),
    capacity: club.capacity,
    photoUrl: club.photoUrl ?? "",
    description: club.description ?? "",
  };

  async function submit(input: ClubFormValues) {
    "use server";
    return updateClubAction(id, input);
  }

  async function remove() {
    "use server";
    return deleteClubAction(id);
  }

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
        <h1 className="text-2xl font-bold sm:text-3xl">クラブを編集</h1>
        <p className="text-xs leading-6 text-zinc-600">
          変更内容は保存した瞬間から利用者画面に反映されます。
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <ClubForm
          mode="edit"
          availableFacilities={availableFacilities}
          availablePrograms={programs}
          currentProgram={currentProgram}
          initial={initial}
          submitAction={submit}
          deleteAction={remove}
        />
      </section>
    </main>
  );
}
