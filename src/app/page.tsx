import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium tracking-wide text-zinc-500">
            大洲市児童館クラブ予約
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            クラブを予約できるようになるまで、もうすこしお待ちください
          </h1>
          <p className="text-base leading-7 text-zinc-600">
            大洲児童館・喜多児童館・徳森児童センターのクラブ予約サイトを準備中です。
            準備ができ次第、こちらのページでお知らせします。
          </p>
        </div>

        <ul className="mx-auto grid max-w-md grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <li className="rounded-lg border border-zinc-200 px-4 py-3 text-sm">
            大洲児童館
          </li>
          <li className="rounded-lg border border-zinc-200 px-4 py-3 text-sm">
            喜多児童館
          </li>
          <li className="rounded-lg border border-zinc-200 px-4 py-3 text-sm">
            徳森児童センター
          </li>
        </ul>

        <p className="text-xs text-zinc-500">
          管理者の方は{" "}
          <Link
            href="/admin/login"
            className="underline underline-offset-4 hover:text-zinc-700"
          >
            ログイン画面
          </Link>
          （準備中）
        </p>
      </div>
    </main>
  );
}
