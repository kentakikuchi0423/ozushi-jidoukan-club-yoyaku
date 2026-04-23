import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { fetchListableClubs } from "@/lib/clubs/query";
import { ClubFilterBar } from "@/components/clubs/filter-bar";
import {
  applyClubFilters,
  parseFacilityFilter,
  parseStatusFilter,
} from "@/components/clubs/filter-utils";
import { VirtualClubList } from "@/components/clubs/virtual-club-list";
import { FACILITY_NAMES } from "@/lib/facility";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { computeIsSuperAdmin } from "@/server/auth/permissions";
import { fetchAdminProfile } from "@/server/auth/profile";

import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ一覧",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ facility?: string; status?: string }>;
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
  const facilityFilter = parseFacilityFilter(facilityParam, ctx.facilities);
  const statusFilter = parseStatusFilter(statusParam);

  const allClubs = await fetchListableClubs();
  const mine = allClubs.filter((club) =>
    ctx.facilities.includes(club.facilityCode),
  );
  const filtered = applyClubFilters(mine, facilityFilter, statusFilter);
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

          <ClubFilterBar
            facilities={ctx.facilities}
            initialFacility={facilityFilter}
            initialStatus={statusFilter}
            basePath="/admin/clubs"
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
            <VirtualClubList clubs={filtered} variant="admin" />
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
          href="/admin/programs"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          クラブ・事業の編集
        </Link>
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
