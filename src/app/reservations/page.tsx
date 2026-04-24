import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  cancellationBlockedReason,
  computeCancellationDeadline,
} from "@/lib/reservations/cancellation-deadline";
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

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          予約番号 {reservation.reservationNumber}
        </p>
        <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
          予約内容の確認
        </h1>
      </header>

      <StatusSection reservation={reservation} />
      <ClubSection reservation={reservation} />
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
      <section className="mt-8 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-700">
          予約のキャンセル
        </h2>
        <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">
          開催日時を過ぎているため、キャンセルできません。
          <br />
          お困りの場合は各館へ直接ご連絡ください。
        </p>
      </section>
    );
  }

  if (blocked === "past-deadline") {
    return (
      <section className="mt-8 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-700">
          予約のキャンセル
        </h2>
        <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">
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
      deadlineLabel={deadlineLabel}
    />
  );
}

function StatusSection({ reservation }: { reservation: ReservationDetail }) {
  const { copy, tone } = describeStatus(reservation);
  const toneClass: Record<typeof tone, string> = {
    positive: "bg-emerald-50 text-emerald-800",
    info: "bg-amber-50 text-amber-800",
    neutral: "bg-zinc-100 text-zinc-700",
  };
  return (
    <section className={`mt-6 rounded-md p-4 text-sm ${toneClass[tone]}`}>
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

function ClubSection({ reservation }: { reservation: ReservationDetail }) {
  const { club } = reservation;
  return (
    <section className="mt-6 space-y-2 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-zinc-700">クラブ</h2>
      <p className="text-base font-medium">{club.name}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-zinc-700">
        <dt className="text-zinc-500">館</dt>
        <dd>{club.facilityName}</dd>
        <dt className="text-zinc-500">日時</dt>
        <dd>
          <time dateTime={club.startAt}>{formatJstDate(club.startAt)}</time>
          <span className="mx-2 text-zinc-400">·</span>
          <span>
            {formatJstTime(club.startAt)}〜{formatJstTime(club.endAt)}
          </span>
        </dd>
      </dl>
    </section>
  );
}

function ApplicantSection({ reservation }: { reservation: ReservationDetail }) {
  return (
    <section className="mt-6 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-zinc-700">お申込み内容</h2>

      <PeopleList label="お子さま" people={reservation.children} />
      {reservation.parents.length > 0 && (
        <PeopleList label="保護者" people={reservation.parents} />
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-zinc-700">
        <dt className="text-zinc-500">電話</dt>
        <dd>{reservation.phone}</dd>
        <dt className="text-zinc-500">メール</dt>
        <dd className="break-all">{reservation.email}</dd>
        {reservation.notes && (
          <>
            <dt className="text-zinc-500">備考</dt>
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
    <div className="space-y-1 text-sm text-zinc-700">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
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
