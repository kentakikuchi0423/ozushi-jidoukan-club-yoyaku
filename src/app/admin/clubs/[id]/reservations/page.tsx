import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { formatJstDate, formatJstTime } from "@/lib/format";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { fetchClubForAdmin } from "@/server/clubs/admin-detail";
import { fetchClubProgramById } from "@/server/clubs/programs";
import { fetchFacilityByCode } from "@/server/facilities/list";
import {
  fetchClubReservationsForAdmin,
  type AdminReservationListItem,
} from "@/server/reservations/admin-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予約者一覧",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<AdminReservationListItem["status"], string> = {
  confirmed: "予約完了",
  waitlisted: "キャンセル待ち",
  canceled: "キャンセル済み",
};

const STATUS_CLASS: Record<AdminReservationListItem["status"], string> = {
  confirmed: "bg-emerald-100 text-emerald-800",
  waitlisted: "bg-amber-100 text-amber-800",
  canceled: "bg-zinc-200 text-zinc-700",
};

export default async function AdminClubReservationsPage({ params }: Props) {
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

  // 権限チェックを兼ねたクラブ取得。該当館以外は null になる。
  const club = await fetchClubForAdmin(id, ctx.facilities);
  if (!club) notFound();

  const [program, reservations, facility] = await Promise.all([
    fetchClubProgramById(club.programId),
    fetchClubReservationsForAdmin(id),
    fetchFacilityByCode(club.facilityCode),
  ]);

  const confirmedCount = reservations.filter(
    (r) => r.status === "confirmed",
  ).length;
  const waitlistedCount = reservations.filter(
    (r) => r.status === "waitlisted",
  ).length;
  const canceledCount = reservations.filter(
    (r) => r.status === "canceled",
  ).length;

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
        <h1 className="text-2xl font-bold sm:text-3xl">予約者一覧</h1>
        <p className="text-xs leading-6 text-zinc-600">
          クラブ「{program?.name ?? "（削除済み）"}」（
          {facility?.name ?? club.facilityCode}）の予約者一覧です。
          <br />
          申込日時の早い順に表示しています。
        </p>
        <p className="text-xs text-zinc-600">
          開催日時:{" "}
          <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
          <span className="mx-1.5 text-zinc-400">·</span>
          {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          <span className="mx-1.5 text-zinc-400">/</span>
          定員 {club.capacity} 名
        </p>
        <p className="text-xs text-zinc-600">
          予約完了 {confirmedCount} 名 / キャンセル待ち {waitlistedCount} 名 /
          キャンセル済み {canceledCount} 名
        </p>
      </header>

      {reservations.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-600"
        >
          このクラブへの予約はまだありません。
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {reservations.map((r) => (
            <li key={r.id}>
              <ReservationCard reservation={r} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ReservationCard({
  reservation: r,
}: {
  reservation: AdminReservationListItem;
}) {
  const isCanceled = r.status === "canceled";
  return (
    <article
      className={`flex flex-col gap-2 rounded-lg border p-4 shadow-sm sm:p-5 ${
        isCanceled
          ? "border-zinc-200 bg-zinc-50 text-zinc-500 opacity-70"
          : "border-zinc-200 bg-white text-zinc-800"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${STATUS_CLASS[r.status]}`}
        >
          {STATUS_LABEL[r.status]}
          {r.status === "waitlisted" && r.waitlistPosition !== null && (
            <> ({r.waitlistPosition} 番目)</>
          )}
        </span>
        <span className="font-mono text-zinc-700">{r.reservationNumber}</span>
      </div>

      <p className="text-xs">
        <span className="text-zinc-500">申込日時: </span>
        <time dateTime={r.createdAt}>
          {formatJstDate(r.createdAt)} {formatJstTime(r.createdAt)}
        </time>
        {r.canceledAt && (
          <>
            <span className="mx-1.5 text-zinc-400">/</span>
            <span className="text-zinc-500">キャンセル日時: </span>
            <time dateTime={r.canceledAt}>
              {formatJstDate(r.canceledAt)} {formatJstTime(r.canceledAt)}
            </time>
          </>
        )}
      </p>

      <PeopleBlock label="お子さま" people={r.children} />
      {r.parents.length > 0 && (
        <PeopleBlock label="保護者" people={r.parents} />
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-zinc-500">電話</dt>
        <dd>{r.phone}</dd>
        <dt className="text-zinc-500">メール</dt>
        <dd className="break-all">{r.email}</dd>
        {r.notes && (
          <>
            <dt className="text-zinc-500">備考</dt>
            <dd className="whitespace-pre-wrap">{r.notes}</dd>
          </>
        )}
      </dl>
    </article>
  );
}

function PeopleBlock({
  label,
  people,
}: {
  label: string;
  people: ReadonlyArray<{ name: string; kana: string }>;
}) {
  return (
    <div className="text-xs">
      <span className="text-zinc-500">{label}: </span>
      {people.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 text-zinc-400">/</span>}
          {p.name}（{p.kana}）
        </span>
      ))}
    </div>
  );
}
