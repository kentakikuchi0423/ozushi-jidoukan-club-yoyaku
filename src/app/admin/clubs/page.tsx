import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { fetchListableClubs } from "@/lib/clubs/query";
import {
  deriveClubAvailability,
  type ClubAvailability,
  type ClubListing,
} from "@/lib/clubs/types";
import { FACILITY_NAMES } from "@/lib/facility";
import { formatJstDate, formatJstTime } from "@/lib/format";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ一覧",
  robots: { index: false, follow: false },
};

export default async function AdminClubsListPage() {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  const all = await fetchListableClubs();
  const mine = all.filter((club) => ctx.facilities.includes(club.facilityCode));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/admin"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          ← 管理ダッシュボードに戻る
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-wide text-zinc-500">
            管理画面
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">クラブ一覧</h1>
          <p className="text-xs leading-6 text-zinc-600">
            {ctx.facilities.length === 0
              ? "担当館がまだ割り当てられていません。"
              : `管理対象: ${ctx.facilities
                  .map((code) => FACILITY_NAMES[code])
                  .join(" / ")}`}
          </p>
        </div>
        <Link
          href="/admin/clubs/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          クラブを新規登録
        </Link>
      </header>

      {mine.length === 0 ? (
        <div
          role="status"
          className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-600"
        >
          担当館で公開中のクラブはまだありません。
          <br />
          右上の「クラブを新規登録」から追加してください。
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {mine.map((club) => (
            <li key={club.id}>
              <AdminClubRow club={club} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const AVAILABILITY_LABEL: Record<ClubAvailability, string> = {
  available: "空きあり",
  waitlist: "キャンセル待ち",
  ended: "終了",
};

const AVAILABILITY_CLASS: Record<ClubAvailability, string> = {
  available: "bg-emerald-100 text-emerald-800",
  waitlist: "bg-amber-100 text-amber-800",
  ended: "bg-zinc-200 text-zinc-700",
};

function AdminClubRow({ club }: { club: ClubListing }) {
  const availability = deriveClubAvailability(club);
  return (
    <article className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
            {club.facilityName}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${AVAILABILITY_CLASS[availability]}`}
          >
            {AVAILABILITY_LABEL[availability]}
          </span>
        </div>
        <p className="text-sm text-zinc-700">
          <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
          <span className="mx-2 text-zinc-400">·</span>
          <span>
            {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          </span>
        </p>
        <h2 className="truncate text-base font-semibold text-zinc-900">
          {club.name}
        </h2>
        <p className="text-xs text-zinc-500">
          定員 {club.capacity}名 / 予約 {club.confirmedCount}名
          {club.waitlistedCount > 0 &&
            `（キャンセル待ち ${club.waitlistedCount}名）`}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/admin/clubs/${club.id}/edit`}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          編集
        </Link>
      </div>
    </article>
  );
}
