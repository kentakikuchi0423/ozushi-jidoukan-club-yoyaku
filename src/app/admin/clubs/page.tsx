import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ClubFilterBar } from "@/components/clubs/filter-bar";
import {
  applyClubFilters,
  parseDateFilter,
  parseFacilityFilter,
  parseStatusFilter,
} from "@/components/clubs/filter-utils";
import { PaginatedClubList } from "@/components/clubs/paginated-club-list";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { computeIsSuperAdmin } from "@/server/auth/permissions";
import { fetchAdminProfile } from "@/server/auth/profile";
import { fetchAdminListableClubs } from "@/server/clubs/admin-list";
import { fetchFacilities } from "@/server/facilities/list";

import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "クラブ一覧",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{
    facility?: string;
    status?: string;
    dates?: string;
  }>;
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

  const [profile, isSuper, allFacilities] = await Promise.all([
    fetchAdminProfile(ctx.adminId),
    computeIsSuperAdmin(ctx.facilities),
    fetchFacilities({ includeDeleted: true }),
  ]);
  const nameByCode = new Map(allFacilities.map((f) => [f.code, f.name]));
  const facilitiesLabel =
    ctx.facilities.length > 0
      ? ctx.facilities.map((code) => nameByCode.get(code) ?? code).join(" / ")
      : "割り当てられた館がありません";

  const {
    facility: facilityParam,
    status: statusParam,
    dates: datesParam,
  } = await searchParams;
  const facilityFilter = parseFacilityFilter(facilityParam, ctx.facilities);
  const statusFilter = parseStatusFilter(statusParam);
  const dateFilter = parseDateFilter(datesParam);

  // 管理画面では未公開クラブも含めて一覧表示する。
  const allClubs = await fetchAdminListableClubs();
  const mine = allClubs.filter((club) =>
    ctx.facilities.includes(club.facilityCode),
  );
  const filtered = applyClubFilters(
    mine,
    facilityFilter,
    statusFilter,
    dateFilter,
  );
  const hasAnyClubs = mine.length > 0;
  const hasFilter = Boolean(
    facilityFilter || statusFilter || dateFilter.length > 0,
  );

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
          className="mt-6 rounded-2xl bg-[var(--color-warning-soft)] p-4 text-sm text-[var(--color-warning)]"
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
            <h1 className="text-2xl font-semibold sm:text-3xl">クラブ一覧</h1>
            <Link
              href="/admin/clubs/new"
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              クラブを新規登録
            </Link>
          </header>

          <ClubFilterBar
            facilities={ctx.facilities.map((code) => ({
              code,
              name: nameByCode.get(code) ?? code,
            }))}
            initialFacility={facilityFilter}
            initialStatus={statusFilter}
            initialDates={dateFilter}
            basePath="/admin/clubs"
          />

          {!hasAnyClubs ? (
            <div
              role="status"
              className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center text-sm text-[var(--color-muted)]"
            >
              担当館で公開中のクラブはまだありません。
              <br />
              右上の「クラブを新規登録」から追加してください。
            </div>
          ) : filtered.length === 0 ? (
            <div
              role="status"
              className="rounded-2xl border border-dashed border-[var(--color-border)] px-6 py-12 text-center text-sm text-[var(--color-muted)]"
            >
              {hasFilter
                ? "絞り込み条件に一致するクラブはありません。"
                : "公開中のクラブはまだありません。"}
            </div>
          ) : (
            <PaginatedClubList clubs={filtered} variant="admin" />
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
  const navLinkClass =
    "text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-focus)] rounded";
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {displayName} さん、お疲れさまです
          </p>
          <p className="text-xs leading-6 text-[var(--color-muted)]">
            管理可能な館: {facilitiesLabel}
            {isSuper && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-info-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-info)]">
                全館管理者
              </span>
            )}
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
          >
            ログアウト
          </button>
        </form>
      </div>

      <nav
        aria-label="管理メニュー"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-2 text-xs"
      >
        <Link href="/admin/programs" className={navLinkClass}>
          クラブ・事業の管理
        </Link>
        <Link href="/admin/password" className={navLinkClass}>
          パスワード変更
        </Link>
        <Link href="/admin/facilities" className={navLinkClass}>
          館の管理
        </Link>
        <Link href="/admin/accounts" className={navLinkClass}>
          アカウント追加・削除
        </Link>
      </nav>
    </section>
  );
}
