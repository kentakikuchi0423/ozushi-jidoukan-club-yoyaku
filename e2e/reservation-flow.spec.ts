import { expect, test } from "@playwright/test";

// 実ブラウザで「クラブ一覧 → 詳細 → 予約フォーム入力 → 確認 → 予約確定 → 完了画面」
// まで通ることを検証する。Supabase リモート DB に接続するため、テスト実行時点で
// 少なくとも 1 件のクラブ（capacity 1 以上かつ未開催）が登録されている必要がある。
// 投入手順は docs/operations.md §5 参照。
//
// 成功した場合、DB に「テスト 太郎」名義のダミー予約が 1 件残る。この副作用を
// 避けるため、デフォルトではスキップし `RUN_RESERVATION_FLOW_E2E=1` の環境変数で
// 明示的に実行する。掃除は
//   delete from public.reservations where email = 'kenta.kikuchi.0423@gmail.com';
// で行う。
//
// ローカル実行例:
//   RUN_RESERVATION_FLOW_E2E=1 PORT=3100 pnpm test:e2e e2e/reservation-flow.spec.ts

test("user can create a reservation via the browser", async ({ page }) => {
  test.skip(
    !process.env.RUN_RESERVATION_FLOW_E2E,
    "RUN_RESERVATION_FLOW_E2E=1 を付けたときだけ実行する（実 DB に予約レコードを作る）",
  );

  // ブラウザ側の例外やネットワーク応答をテスト出力に流し、サーバーコンポーネント
  // 側のエラーも見えるようにする
  page.on("pageerror", (err) =>
    console.error("[browser:pageerror]", err.message),
  );
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("[browser:console.error]", msg.text());
    }
  });
  page.on("response", (resp) => {
    if (!resp.ok() && resp.status() !== 304) {
      console.warn(
        "[browser:response]",
        resp.status(),
        resp.url().replace(/https?:\/\/[^/]+/, ""),
      );
    }
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const reserveLink = page.getByRole("link", { name: "予約する" }).first();
  await expect(reserveLink).toBeVisible({ timeout: 15_000 });
  await reserveLink.click();

  // 詳細ページ + Client Component のハイドレーション完了まで待つ。
  // React のイベントハンドラが wire up される前に submit してしまうと、
  // フォームがネイティブ GET 送信されてリロードが起きるため。
  await expect(
    page.getByRole("heading", { name: "予約のお申込み" }),
  ).toBeVisible();
  await page.waitForSelector("html[data-reservation-form-ready='true']");
  const submitButton = page.getByRole("button", { name: "内容を確認する" });
  await expect(submitButton).toBeEnabled();

  // fill → 値がちゃんと React state に入ったかを toHaveValue で担保する
  const cases: Array<[string, string]> = [
    ["#parentName", "テスト 太郎"],
    ["#parentKana", "てすと たろう"],
    ["#childName", "テスト 花子"],
    ["#childKana", "てすと はなこ"],
    ["#phone", "090-1234-5678"],
    // Resend 未検証ドメイン運用では、アカウント所有メール宛しか届かない
    ["#email", "kenta.kikuchi.0423@gmail.com"],
  ];
  for (const [selector, value] of cases) {
    const input = page.locator(selector);
    await input.fill(value);
    await expect(input).toHaveValue(value);
  }

  await submitButton.click();

  // プレビューステップ
  await expect(
    page.getByRole("button", { name: "予約を確定する" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "予約を確定する" }).click();

  // 完了ページへ遷移（失敗時は alert 文言を持って来てわかりやすく落とす）
  try {
    await page.waitForURL(/\/clubs\/[^/]+\/done\?/, { timeout: 30_000 });
  } catch {
    const alertText = await page
      .getByRole("alert")
      .textContent()
      .catch(() => null);
    const currentUrl = page.url();
    throw new Error(
      `did not reach /done (url=${currentUrl}, alert=${alertText ?? "none"})`,
    );
  }

  await expect(
    page.getByRole("heading", {
      name: /ご予約ありがとうございました|予約待ちリストに追加しました/,
    }),
  ).toBeVisible();

  // 予約番号が表示されていることを確認（`ozu_123456` 形式）
  const mainText = await page.locator("main").innerText();
  expect(mainText).toMatch(/(ozu|kita|toku)_\d{6}/);
});
