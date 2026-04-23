import Link from "next/link";
import type { Metadata } from "next";

import { FACILITY_NAMES } from "@/lib/facility";
import {
  AuthenticationRequiredError,
  requireAdmin,
} from "@/server/auth/guards";
import { computeIsSuperAdmin } from "@/server/auth/permissions";
import { fetchAdminProfile } from "@/server/auth/profile";
import { redirect } from "next/navigation";

import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理画面",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      // middleware が基本的には redirect するが、ここに到達した場合の保険。
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          {profile?.displayName ?? "管理者"} さん、お疲れさまです
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">管理ダッシュボード</h1>
        <p className="text-sm leading-6 text-zinc-600">
          管理可能な館: {facilitiesLabel}
          {isSuper && (
            <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
              super_admin
            </span>
          )}
        </p>
      </header>

      {ctx.facilities.length === 0 ? (
        <section
          role="status"
          className="mt-8 rounded-md bg-amber-50 p-4 text-sm text-amber-900"
        >
          このアカウントには、まだ館の権限が割り当てられていません。
          <br />
          super_admin の方に <code>admin_facilities</code>{" "}
          への割り当てを依頼してください。
          <br />
          手順は <code>docs/operations.md §3</code> に記載されています。
        </section>
      ) : (
        <section
          aria-labelledby="admin-menu"
          className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <h2 id="admin-menu" className="sr-only">
            管理メニュー
          </h2>
          <MenuCard
            title="クラブを新規登録"
            description="担当する館のクラブを新しく登録します。"
            href="/admin/clubs/new"
          />
          <MenuCard
            title="クラブ一覧"
            description="担当する館のクラブを一覧で確認・編集します。"
            href="/admin/clubs"
          />
          <MenuCard
            title="パスワード変更"
            description="ログイン用のパスワードを変更します。"
            href="/admin/password"
          />
          {isSuper && (
            <MenuCard
              title="アカウント追加"
              description="新しい管理者アカウントを招待します（super_admin のみ）。"
              href="/admin/accounts"
            />
          )}
        </section>
      )}

      <form action={logoutAction} className="mt-10">
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ログアウト
        </button>
      </form>
    </main>
  );
}

function MenuCard({
  title,
  description,
  href,
  disabled,
}: {
  title: string;
  description: string;
  href: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex h-full flex-col gap-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
            準備中
          </span>
        </div>
        <p className="text-xs leading-5 text-zinc-500">{description}</p>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex h-full flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm"
    >
      <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
      <p className="text-xs leading-5 text-zinc-500">{description}</p>
    </Link>
  );
}
