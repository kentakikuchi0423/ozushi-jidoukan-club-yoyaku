import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { fetchListableClubs } from "@/lib/clubs/query";
import {
  deriveClubAvailability,
  type ClubAvailability,
  type ClubListing,
} from "@/lib/clubs/types";
import { FACILITY_NAMES, isFacilityCode } from "@/lib/facility";
import { formatJstDate, formatJstTime } from "@/lib/format";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { computeIsSuperAdmin } from "@/server/auth/permissions";
import { fetchAdminProfile } from "@/server/auth/profile";

import { logoutAction } from "../actions";
import { FilterBar } from "./filter-bar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ一覧",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ facility?: string; status?: string }>;
}

const STATUS_VALUES = ["available", "waitlist", "ended"] as const;
function isStatus(value: string): value is ClubAvailability {
  return (STATUS_VALUES as readonly string[]).includes(value);
}

export default async function AdminClubsListPage({ searchParams }: Props) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/admin/login");
    }
    throw error;
  }

  const profile = await fetchAdminProfile(ctx.adminId);
  const isSuper = computeIsSuperAdmin(ctx.facilities);
  const facilitiesLabel =
    ctx.facilities.length > 0
      ? ctx.facilities.map((code) => FACILITY_NAMES[code]).join(" / ")
      : "割り当てられた館がありません";

  const { facility: facilityParam, status: statusParam } = await searchParams;
  // ctx.facilities に含まれない館コードはクエリ経由でも無視する（安全側）
  const facilityFilter =
    facilityParam &&
    isFacilityCode(facilityParam) &&
    ctx.facilities.includes(facilityParam)
      ? facilityParam
      : "";
  const statusFilter = statusParam && isStatus(statusParam) ? statusParam : "";

  const all = await fetchListableClubs();
  const mine = all.filter((club) => ctx.facilities.includes(club.facilityCode));

  const filtered = mine.filter((club) => {
    if (facilityFilter && club.facilityCode !== facilityFilter) return false;
    if (statusFilter && deriveClubAvailability(club) !== statusFilter)
      return false;
    return true;
  });

  const hasAnyClubs = mine.length > 0;
  const hasFilter = Boolean(facilityFilter || statusFilter);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <AdminTopBar
        displayName={profile?.displayName ?? "管理者"}
        facilitiesLabel={facilitiesLabel}
        isSuper={isSuper}
      />

      {ctx.facilities.length === 0 ? (
        <section
          role="status"
          className="mt-6 rounded-md bg-amber-50 p-4 text-sm text-amber-900"
        >
          このアカウントには、まだ館の権限が割り当てられていません。
          <br />
          全館管理者の方に <code>admin_facilities</code>{" "}
          への割り当てを依頼してください。
          <br />
          手順は <code>docs/operations.md §3</code> に記載されています。
        </section>
      ) : (
        <>
          <header className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold sm:text-3xl">クラブ一覧</h1>
            <Link
              href="/admin/clubs/new"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              クラブを新規登録
            </Link>
          </header>

          <FilterBar
            facilities={ctx.facilities}
            initialFacility={facilityFilter}
            initialStatus={statusFilter}
          />

          {!hasAnyClubs ? (
            <div
              role="status"
              className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-600"
            >
              担当館で公開中のクラブはまだありません。
              <br />
              右上の「クラブを新規登録」から追加してください。
            </div>
          ) : filtered.length === 0 ? (
            <div
              role="status"
              className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-600"
            >
              {hasFilter
                ? "絞り込み条件に一致するクラブはありません。"
                : "公開中のクラブはまだありません。"}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((club) => (
                <li key={club.id}>
                  <AdminClubRow club={club} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function AdminTopBar({
  displayName,
  facilitiesLabel,
  isSuper,
}: {
  displayName: string;
  facilitiesLabel: string;
  isSuper: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-zinc-800">
            {displayName} さん、お疲れさまです
          </p>
          <p className="text-xs leading-6 text-zinc-600">
            管理可能な館: {facilitiesLabel}
            {isSuper && (
              <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                全館管理者
              </span>
            )}
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ログアウト
          </button>
        </form>
      </div>

      <nav
        aria-label="管理メニュー"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-2 text-xs"
      >
        <Link
          href="/admin/password"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          パスワード変更
        </Link>
        {isSuper && (
          <Link
            href="/admin/accounts"
            className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
          >
            アカウント追加
          </Link>
        )}
      </nav>
    </section>
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
    <article className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0 flex-1 space-y-2">
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
        <h2 className="text-base leading-tight font-bold text-zinc-900 sm:text-lg">
          {club.name}
        </h2>
        <p className="text-sm text-zinc-700">
          <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
          <span className="mx-2 text-zinc-400">·</span>
          <span>
            {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          </span>
        </p>
        <p className="text-xs text-zinc-500">
          定員 {club.capacity}名 / 予約 {club.confirmedCount}名
          {club.waitlistedCount > 0 &&
            `（キャンセル待ち ${club.waitlistedCount}名）`}
        </p>
      </div>
      <div className="flex shrink-0 gap-2 sm:ml-4">
        <Link
          href={`/admin/clubs/${club.id}/edit`}
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          編集
        </Link>
      </div>
    </article>
  );
}
