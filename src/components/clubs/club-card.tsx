import Link from "next/link";

import { PublishClubButton } from "@/app/admin/clubs/publish-club-button";
import {
  deriveClubAvailability,
  hasValidPhotoUrl,
  type ClubAvailability,
  type ClubListing,
} from "@/lib/clubs/types";
import { formatJstDate, formatJstTime } from "@/lib/format";

// 公開ページと管理画面で共有するクラブカード。見た目は統一し、右下の CTA
// だけ variant で切り替える:
//   * public: 「予約する」ボタン（終了クラブは「受付終了」のラベル）
//   * admin:  「編集」ボタン

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

type ClubVariant = "public" | "admin";

interface Props {
  readonly club: ClubListing;
  readonly variant: ClubVariant;
}

export function ClubCard({ club, variant }: Props) {
  const availability = deriveClubAvailability(club);
  const isEnded = availability === "ended";

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
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
          {variant === "admin" && club.publishedAt === null && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
              未公開
            </span>
          )}
          <span className="text-zinc-600">
            <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
            <span className="mx-1 text-zinc-400">·</span>
            {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          </span>
        </div>
        <h2 className="truncate text-base leading-tight font-bold text-zinc-900 sm:text-lg">
          {club.name}
        </h2>
        <p className="text-xs text-zinc-600">
          対象年齢: {club.targetAge}
          <span className="mx-1.5 text-zinc-400">/</span>
          定員 {club.capacity}名 / 予約 {club.confirmedCount}名
          {club.waitlistedCount > 0 && (
            <span className="ml-1 text-amber-700">
              （キャンセル待ち {club.waitlistedCount}名）
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm sm:flex-col sm:items-end sm:gap-2">
        {hasValidPhotoUrl(club.photoUrl) ? (
          <a
            href={club.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
          >
            写真を見る
          </a>
        ) : (
          <span className="text-xs text-zinc-400">写真：準備中</span>
        )}

        {variant === "public" ? (
          isEnded ? (
            <span
              aria-disabled="true"
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-500"
            >
              受付終了
            </span>
          ) : (
            <Link
              href={`/clubs/${club.id}`}
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              予約する
            </Link>
          )
        ) : (
          <>
            <Link
              href={`/admin/clubs/${club.id}/edit`}
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              編集
            </Link>
            <PublishClubButton
              clubId={club.id}
              alreadyPublished={club.publishedAt !== null}
              clubName={club.name}
              facilityName={club.facilityName}
              startAt={club.startAt}
              endAt={club.endAt}
              capacity={club.capacity}
              targetAge={club.targetAge}
            />
            <Link
              href={`/admin/clubs/${club.id}/reservations`}
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              予約者を見る
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
