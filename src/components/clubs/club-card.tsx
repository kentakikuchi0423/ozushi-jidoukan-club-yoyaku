import Link from "next/link";

import { PublishClubButton } from "@/app/admin/clubs/publish-club-button";
import { Badge } from "@/components/ui";
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

const AVAILABILITY_TONE: Record<
  ClubAvailability,
  "success" | "warning" | "muted"
> = {
  available: "success",
  waitlist: "warning",
  ended: "muted",
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
    <article className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="neutral">{club.facilityName}</Badge>
          <Badge tone={AVAILABILITY_TONE[availability]}>
            {AVAILABILITY_LABEL[availability]}
          </Badge>
          {variant === "admin" && club.publishedAt === null && (
            <Badge tone="warning">未公開</Badge>
          )}
          <span className="text-[var(--color-muted)]">
            <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
            <span className="mx-1 text-[var(--color-border)]">·</span>
            {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          </span>
        </div>
        <h2 className="truncate text-base leading-snug font-semibold text-[var(--color-foreground)] sm:text-lg">
          {club.name}
        </h2>
        <p className="text-xs text-[var(--color-muted)]">
          対象年齢: {club.targetAge}
          <span className="mx-1.5 text-[var(--color-border)]">/</span>
          定員 {club.capacity}名 / 予約 {club.confirmedCount}名
          {club.waitlistedCount > 0 && (
            <span className="ml-1 text-[var(--color-warning)]">
              （キャンセル待ち {club.waitlistedCount}名）
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-sm">
        <div className="shrink-0">
          {hasValidPhotoUrl(club.photoUrl) ? (
            <a
              href={club.photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
            >
              写真を見る
            </a>
          ) : (
            <span className="text-xs text-[var(--color-muted)]">
              写真：準備中
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {variant === "public" ? (
            isEnded ? (
              <span
                aria-disabled="true"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--color-muted)]"
              >
                受付終了
              </span>
            ) : (
              <Link
                href={`/clubs/${club.id}`}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                予約する
              </Link>
            )
          ) : (
            <>
              <Link
                href={`/admin/clubs/${club.id}/edit`}
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
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
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
              >
                予約者を見る
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
