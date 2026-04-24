import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge, FormMessage } from "@/components/ui";
import { fetchClubDetail } from "@/lib/clubs/query";
import {
  deriveClubAvailability,
  hasValidPhotoUrl,
  type ClubAvailability,
} from "@/lib/clubs/types";
import { formatJstDate, formatJstTime } from "@/lib/format";
import { ReservationForm } from "./reservation-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const club = await fetchClubDetail(id);
  if (!club) return { title: "クラブが見つかりません" };
  return { title: `${club.name} | ${club.facilityName}` };
}

export default async function ClubDetailPage({ params }: Props) {
  const { id } = await params;
  const club = await fetchClubDetail(id);
  if (!club) notFound();

  const availability = deriveClubAvailability(club);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/"
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="neutral">{club.facilityName}</Badge>
          <AvailabilityBadge value={availability} />
        </div>
        <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">
          {club.name}
        </h1>
      </header>

      <section className="mt-6 space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-[var(--color-foreground)]/90">
          <dt className="text-[var(--color-muted)]">日時</dt>
          <dd>
            <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
            <span className="mx-2 text-[var(--color-border)]">·</span>
            <span>
              {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
            </span>
          </dd>
          <dt className="text-[var(--color-muted)]">対象年齢</dt>
          <dd>{club.targetAge}</dd>
          <dt className="text-[var(--color-muted)]">定員 / 予約</dt>
          <dd>
            {club.capacity}名 / {club.confirmedCount}名
            {club.waitlistedCount > 0 && (
              <span className="ml-1 text-xs text-[var(--color-warning)]">
                （キャンセル待ち {club.waitlistedCount}名）
              </span>
            )}
          </dd>
          <dt className="text-[var(--color-muted)]">写真</dt>
          <dd>
            {hasValidPhotoUrl(club.photoUrl) ? (
              <a
                href={club.photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-foreground)] underline underline-offset-4 hover:text-[var(--color-primary)]"
              >
                写真を見る
              </a>
            ) : (
              <span className="text-[var(--color-muted)]">準備中</span>
            )}
          </dd>
        </dl>

        <div className="rounded-xl bg-[var(--color-surface-muted)] p-4 text-sm whitespace-pre-wrap text-[var(--color-foreground)]/90">
          <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
            概要
          </p>
          {club.summary}
        </div>

        {club.description && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm whitespace-pre-wrap text-[var(--color-foreground)]/90">
            <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
              補足説明
            </p>
            {club.description}
          </div>
        )}
      </section>

      <section
        aria-labelledby="reserve-heading"
        className="mt-8 space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <h2 id="reserve-heading" className="text-lg font-semibold">
          予約のお申込み
        </h2>

        {availability === "ended" ? (
          <p className="rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm text-[var(--color-foreground)]/80">
            このクラブは受付を終了しました。
          </p>
        ) : (
          <>
            {availability === "waitlist" && (
              <FormMessage tone="warning">
                定員に達しています。
                {"\n"}
                お申込みいただくとキャンセル待ちとして受け付け、キャンセルが発生した場合に自動で繰り上がります。
              </FormMessage>
            )}
            <ReservationForm clubId={club.id} />
          </>
        )}
      </section>
    </main>
  );
}

function AvailabilityBadge({ value }: { value: ClubAvailability }) {
  const LABEL: Record<ClubAvailability, string> = {
    available: "空きあり",
    waitlist: "キャンセル待ち",
    ended: "終了",
  };
  const TONE: Record<ClubAvailability, "success" | "warning" | "muted"> = {
    available: "success",
    waitlist: "warning",
    ended: "muted",
  };
  return <Badge tone={TONE[value]}>{LABEL[value]}</Badge>;
}
