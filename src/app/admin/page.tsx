import { redirect } from "next/navigation";

// `/admin` は互換目的の入口。ログイン直後の初期画面は `/admin/clubs` に統合した。
// middleware 側で未ログインなら `/admin/login` に飛ばされる。
export const dynamic = "force-dynamic";

export default function AdminRootPage(): never {
  redirect("/admin/clubs");
}
