import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  cancellationBlockedReason,
  computeCancellationDeadline,
} from "@/lib/reservations/cancellation-deadline";
import { fetchClubDetail } from "@/lib/clubs/query";
import type { ClubListing } from "@/lib/clubs/types";
import { isReservationNumber } from "@/lib/reservations/number";
import type { ReservationStatus } from "@/lib/reservations/status";
import { formatJstDate, formatJstTime } from "@/lib/format";
import {
  fetchMyReservation,
  type ReservationDetail,
} from "@/server/reservations/lookup";
import { isSecureTokenFormat } from "@/server/reservations/secure-token";
import { CancelForm } from "./cancel-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予約内容の確認",
};

interface Props {
  searchParams: Promise<{ r?: string; t?: string }>;
}

export default async function ReservationLookupPage({ searchParams }: Props) {
  const { r, t } = await searchParams;

  if (!r || !t) notFound();
  if (!isReservationNumber(r)) notFound();
  if (!isSecureTokenFormat(t)) notFound();

  const reservation = await fetchMyReservation(r, t);
  if (!reservation) notFound();

  // 予約の club_id から、対象年齢・概要・説明などの追加情報を取得する。
  // 公開停止やリテンション切れで取れない場合は null になり、最低限の情報
  // （ReservationDetail.club）だけで表示する。
  const clubExtra = await fetchClubDetail(reservation.club.id).catch(() => null);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/"
          className="text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-foreground)]"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-[var(--color-muted)]">
          予約番号 {reservation.reservationNumber}
        </p>
        <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">
          予約内容の確認
        </h1>
      </header>

      <StatusSection reservation={reservation} />
      <ClubSection reservation={reservation} clubExtra={clubExtra} />
      <ApplicantSection reservation={reservation} />

      {reservation.status !== "canceled" && (
        <CancelSection reservation={reservation} secureToken={t} />
      )}
    </main>
  );
}

function CancelSection({
  reservation,
  secureToken,
}: {
  reservation: ReservationDetail;
  secureToken: string;
}) {
  const deadline = computeCancellationDeadline(reservation.club.startAt);
  const blocked = cancellationBlockedReason(reservation.club.startAt);
  const deadlineLabel = `${formatJstDate(deadline)} ${formatJstTime(deadline)}`;

  if (blocked === "event-started") {
    return (
      <section className="mt-8 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
          予約のキャンセル
        </h2>
        <p className="rounded-md bg-zinc-100 p-3 text-sm text-[var(--color-foreground)]/90">
          開催日時を過ぎているため、キャンセルできません。
          <br />
          お困りの場合は各館へ直接ご連絡ください。
        </p>
      </section>
    );
  }

  if (blocked === "past-deadline") {
    return (
      <section className="mt-8 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
          予約のキャンセル
        </h2>
        <p className="rounded-md bg-zinc-100 p-3 text-sm text-[var(--color-foreground)]/90">
          キャンセル期限（{deadlineLabel}
          ）を過ぎているため、このページからはキャンセルできません。
          <br />
          体調不良などでご参加が難しくなった場合は、各館へ直接ご連絡ください。
        </p>
      </section>
    );
  }

  return (
    <CancelForm
      reservationNumber={reservation.reservationNumber}
      secureToken={secureToken}
    />
  );
}

function StatusSection({ reservation }: { reservation: ReservationDetail }) {
  const { copy, tone } = describeStatus(reservation);
  const toneClass: Record<typeof tone, string> = {
    positive: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    info: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    neutral:
      "bg-[var(--color-surface-muted)] text-[var(--color-foreground)]/80",
  };
  return (
    <section className={`mt-6 rounded-2xl p-4 text-sm ${toneClass[tone]}`}>
      {copy}
    </section>
  );
}

function describeStatus(reservation: ReservationDetail): {
  copy: React.ReactNode;
  tone: "positive" | "info" | "neutral";
} {
  const { status, waitlistPosition, canceledAt } = reservation;
  switch (status as ReservationStatus) {
    case "confirmed":
      return {
        tone: "positive",
        copy: (
          <>
            <strong>ご予約は確定しています。</strong>
            <br />
            当日お気をつけてお越しください。
          </>
        ),
      };
    case "waitlisted":
      return {
        tone: "info",
        copy: (
          <>
            <strong>現在はキャンセル待ちです。</strong>
            {waitlistPosition !== null && (
              <>
                {" "}
                現在の順位は <strong>{waitlistPosition} 番目</strong> です。
              </>
            )}
            <br />
            キャンセルが発生した場合、順番に従って自動的に繰り上がり、確定した際にはメールでお知らせします。
          </>
        ),
      };
    case "canceled":
      return {
        tone: "neutral",
        copy: (
          <>
            <strong>この予約はキャンセル済みです。</strong>
            {canceledAt && (
              <>
                （
                <time dateTime={canceledAt}>
                  {formatJstDate(canceledAt)} {formatJstTime(canceledAt)}
                </time>
                ）
              </>
            )}
          </>
        ),
      };
  }
}

function ClubSection({
  reservation,
  clubExtra,
}: {
  reservation: ReservationDetail;
  clubExtra: ClubListing | null;
}) {
  const { club } = reservation;
  return (
    <section className="mt-6 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
        クラブ
      </h2>
      <p className="text-base font-medium">{club.name}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-[var(--color-foreground)]/90">
        <dt className="text-[var(--color-muted)]">館</dt>
        <dd>{club.facilityName}</dd>
        <dt className="text-[var(--color-muted)]">日時</dt>
        <dd>
          <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
          <span className="mx-2 text-[var(--color-border)]">·</span>
          <span>
            {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          </span>
        </dd>
        {clubExtra?.targetAge && (
          <>
            <dt className="text-[var(--color-muted)]">対象年齢</dt>
            <dd>{clubExtra.targetAge}</dd>
          </>
        )}
        {clubExtra?.summary && (
          <>
            <dt className="text-[var(--color-muted)]">概要</dt>
            <dd className="whitespace-pre-wrap">{clubExtra.summary}</dd>
          </>
        )}
      </dl>
      {clubExtra?.description && (
        <div className="space-y-1 border-t border-[var(--color-border)] pt-3">
          <p className="text-xs text-[var(--color-muted)]">補足</p>
          <p className="text-sm leading-7 whitespace-pre-wrap text-[var(--color-foreground)]/90">
            {clubExtra.description}
          </p>
        </div>
      )}
    </section>
  );
}

function ApplicantSection({ reservation }: { reservation: ReservationDetail }) {
  return (
    <section className="mt-6 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
        お申込み内容
      </h2>

      <PeopleList label="お子さま" people={reservation.children} />
      {reservation.parents.length > 0 && (
        <PeopleList label="保護者" people={reservation.parents} />
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-[var(--color-foreground)]/90">
        <dt className="text-[var(--color-muted)]">電話</dt>
        <dd>{reservation.phone}</dd>
        <dt className="text-[var(--color-muted)]">メール</dt>
        <dd className="break-all">{reservation.email}</dd>
        {reservation.notes && (
          <>
            <dt className="text-[var(--color-muted)]">備考</dt>
            <dd className="whitespace-pre-wrap">{reservation.notes}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function PeopleList({
  label,
  people,
}: {
  label: string;
  people: ReservationDetail["parents"] | ReservationDetail["children"];
}) {
  return (
    <div className="space-y-1 text-sm text-[var(--color-foreground)]/90">
      <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
      <ul className="space-y-0.5">
        {people.map((p, i) => (
          <li key={i}>
            {p.name}（{p.kana}）
          </li>
        ))}
      </ul>
    </div>
  );
}
