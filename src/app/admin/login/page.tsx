import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理者ログイン",
};

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
      <nav className="mb-4 text-sm">
        <Link
          href="/"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
        >
          ← クラブ一覧に戻る
        </Link>
      </nav>

      <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 sm:p-8">
        <header className="space-y-1 text-center">
          <p className="text-sm font-medium tracking-wide text-zinc-500">
            大洲市児童館クラブ予約
          </p>
          <h1 className="text-2xl font-bold">管理者ログイン</h1>
          <p className="text-xs leading-6 text-zinc-600">
            登録済みのメールアドレスとパスワードでログインしてください。
          </p>
        </header>

        <LoginForm next={next} />
      </div>
    </main>
  );
}
