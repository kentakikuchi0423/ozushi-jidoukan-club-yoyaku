import type { FacilityCode } from "@/lib/facility";

// 公開クラブ一覧の 1 行。`list_public_clubs` RPC の戻り値を camelCase で扱う。
// name / targetAge / summary は `club_programs` マスター側から来る値。
// description はその回のクラブ固有の補足（管理画面で編集可能）。
export interface ClubListing {
  readonly id: string;
  readonly facilityCode: FacilityCode;
  readonly facilityName: string;
  readonly programId: string;
  readonly name: string;
  readonly targetAge: string;
  readonly summary: string;
  readonly startAt: string; // ISO 8601
  readonly endAt: string; // ISO 8601
  readonly capacity: number;
  readonly photoUrl: string | null;
  readonly description: string | null;
  /** 公開日時。NULL なら未公開（下書き）。公開 RPC 経由では常に非 NULL が返る。 */
  readonly publishedAt: string | null;
  readonly confirmedCount: number;
  readonly waitlistedCount: number;
}

// 一覧ページで表示する状態バッジ。
//   - 'ended': start_at が過去（受付終了）
//   - 'waitlist': confirmed が定員に到達済みで、以降はキャンセル待ち
//   - 'available': 空きあり
export type ClubAvailability = "available" | "waitlist" | "ended";

export function deriveClubAvailability(
  listing: Pick<ClubListing, "startAt" | "capacity" | "confirmedCount">,
  now: Date = new Date(),
): ClubAvailability {
  const start = new Date(listing.startAt);
  if (start.getTime() <= now.getTime()) return "ended";
  if (listing.confirmedCount >= listing.capacity) return "waitlist";
  return "available";
}

// 写真 URL は http/https のみ許可する（security-review §2）。
// クライアントに返す時点でこの関数で判定し、NG なら "準備中" 表示に回す。
export function hasValidPhotoUrl(photoUrl: string | null): photoUrl is string {
  if (!photoUrl) return false;
  try {
    const parsed = new URL(photoUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** クラブ・事業マスター（検索結果・フォーム選択肢で使う）。 */
export interface ClubProgram {
  readonly id: string;
  readonly name: string;
  readonly targetAge: string;
  readonly summary: string;
}
