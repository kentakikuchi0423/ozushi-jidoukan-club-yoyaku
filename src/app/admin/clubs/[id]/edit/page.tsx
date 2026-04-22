import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { utcIsoToDatetimeLocalJst } from "@/lib/format";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { fetchClubForAdmin } from "@/server/clubs/admin-detail";

import { deleteClubAction, updateClubAction } from "../../actions";
import { ClubForm, type ClubFormValues } from "../../club-form";

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

  const initial: ClubFormValues = {
    facilityCode: club.facilityCode,
    name: club.name,
    startAt: utcIsoToDatetimeLocalJst(club.startAt),
    endAt: utcIsoToDatetimeLocalJst(club.endAt),
    capacity: club.capacity,
    targetAgeMin: club.targetAgeMin,
    targetAgeMax: club.targetAgeMax,
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

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <ClubForm
          mode="edit"
          availableFacilities={ctx.facilities}
          initial={initial}
          submitAction={submit}
          deleteAction={remove}
        />
      </section>
    </main>
  );
}
