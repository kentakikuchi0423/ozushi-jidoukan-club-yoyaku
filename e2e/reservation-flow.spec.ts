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
  // Chromium 側の stability 判定がタイムアウトすることがあったので、href の
  // 値を抜き出して直接 goto する。href があるリンクなので UI 挙動は同じ。
  const href = await reserveLink.getAttribute("href");
  if (!href) throw new Error("予約する リンクに href がありません");
  await page.goto(href);

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
  // 保護者は任意入力になったので fill しない。お子さまだけで先に進めて OK 判定。
  const cases: Array<[string, string]> = [
    ["#children-0-name", "テスト 花子"],
    ["#children-0-kana", "てすと はなこ"],
    ["#phone", "090-1234-5678"],
    // Resend 未検証ドメイン運用では、アカウント所有メール宛しか届かない
    ["#email", "kenta.kikuchi.0423@gmail.com"],
  ];
  for (const [selector, value] of cases) {
    const input = page.locator(selector);
    await input.fill(value);
    await expect(input).toHaveValue(value);
  }

  await submitButton.click({ force: true });

  // プレビューステップ
  await expect(
    page.getByRole("button", { name: "予約を確定する" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "予約を確定する" })
    .click({ force: true });

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
      name: /ご予約ありがとうございました|キャンセル待ちリストに追加しました/,
    }),
  ).toBeVisible();

  // 予約番号が表示されていることを確認（`ozu_123456` 形式）
  const mainText = await page.locator("main").innerText();
  expect(mainText).toMatch(/(ozu|kita|toku)_\d{6}/);

  // ここからキャンセルフローを続ける。done ページの URL に r と t が入っている
  // ので、そのまま /reservations?r=...&t=... に遷移してキャンセルする。
  const doneUrl = new URL(page.url());
  const reservationNumber = doneUrl.searchParams.get("r");
  const secureToken = doneUrl.searchParams.get("t");
  expect(reservationNumber).toBeTruthy();
  expect(secureToken).toBeTruthy();

  await page.goto(`/reservations?r=${reservationNumber}&t=${secureToken}`);
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { name: "予約内容の確認" }),
  ).toBeVisible();
  // 作成直後は confirmed か waitlisted のどちらか
  await expect(
    page.getByText(/ご予約は確定しています|現在はキャンセル待ちです/),
  ).toBeVisible();

  // CancelForm のハイドレーション完了を待つ
  await page.waitForSelector("html[data-cancel-form-ready='true']");

  await page
    .getByRole("button", { name: "この予約をキャンセルする" })
    .click({ force: true });
  await page
    .getByRole("button", { name: "キャンセルを確定する" })
    .click({ force: true });

  // router.refresh() 経由で Server Component が再描画され、status が canceled
  // になってキャンセル済み copy が表示される
  await expect(page.getByText("この予約はキャンセル済みです")).toBeVisible({
    timeout: 15_000,
  });
  // キャンセルボタン自体が消えていること
  await expect(
    page.getByRole("button", { name: "この予約をキャンセルする" }),
  ).toHaveCount(0);
});

// 定員 1 名のクラブで: 利用者 A → confirmed、利用者 B → waitlisted、
// A がキャンセル → B が confirmed に繰り上がる、というフローを検証する。
//
// 実 DB を変更するため opt-in（`RUN_WAITLIST_E2E=1`）。事前に:
//   - capacity=1 の公開クラブを用意し、その id を `E2E_WAITLIST_CLUB_ID` で渡す
//     （operations.md §5 のクリーンアップ SQL を事前に回しておくと吉）。
//
// 実メール配信は Resend のサンドボックスで別アドレス宛に対して失敗するが、
// `notifyReservationCreated` / `notifyReservationPromoted` はエラーを投げず
// 握りつぶすので、予約そのものは成功する（UX 優先の方針、ADR-0014）。
test("waitlisted reservation is promoted when the confirmed one is canceled", async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.RUN_WAITLIST_E2E,
    "RUN_WAITLIST_E2E=1 で opt-in（capacity=1 のクラブと E2E_WAITLIST_CLUB_ID が必要）",
  );
  const clubId = process.env.E2E_WAITLIST_CLUB_ID;
  if (!clubId) {
    throw new Error(
      ".env.local に E2E_WAITLIST_CLUB_ID（capacity=1 の公開クラブ id）を設定してください",
    );
  }

  page.on("pageerror", (err) =>
    console.error("[browser:pageerror]", err.message),
  );

  async function reserveAs(
    onPage: typeof page,
    personName: string,
    personKana: string,
    email: string,
  ): Promise<{ url: string; r: string; t: string }> {
    await onPage.goto(`/clubs/${clubId}`);
    await onPage.waitForSelector("html[data-reservation-form-ready='true']");
    await onPage.locator("#children-0-name").fill(personName);
    await onPage.locator("#children-0-kana").fill(personKana);
    await onPage.locator("#phone").fill("090-0000-0000");
    await onPage.locator("#email").fill(email);
    await onPage
      .getByRole("button", { name: "内容を確認する" })
      .click({ force: true });
    await onPage
      .getByRole("button", { name: "予約を確定する" })
      .click({ force: true });
    await onPage.waitForURL(/\/clubs\/[^/]+\/done\?/, { timeout: 30_000 });
    const doneUrl = new URL(onPage.url());
    const r = doneUrl.searchParams.get("r");
    const t = doneUrl.searchParams.get("t");
    if (!r || !t) throw new Error(`done URL に r/t が無い: ${onPage.url()}`);
    return { url: onPage.url(), r, t };
  }

  // 利用者 A: 同じブラウザタブを使う
  const a = await reserveAs(
    page,
    "テスト 一郎",
    "てすと いちろう",
    "kenta.kikuchi.0423+a@gmail.com",
  );

  // 利用者 A の done ページから「キャンセル待ち」or「ご予約ありがとうございました」を読む
  // capacity=1 なら A が必ず confirmed のはず
  await page.goto(`/reservations?r=${a.r}&t=${a.t}`);
  await expect(page.getByText(/ご予約は確定しています/)).toBeVisible();

  // 利用者 B: 独立したブラウザコンテキストで予約する（cookie 分離）
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const b = await reserveAs(
    pageB,
    "テスト 次郎",
    "てすと じろう",
    "kenta.kikuchi.0423+b@gmail.com",
  );

  // 利用者 B はキャンセル待ちで入る
  await pageB.goto(`/reservations?r=${b.r}&t=${b.t}`);
  await expect(pageB.getByText(/現在はキャンセル待ちです/)).toBeVisible();

  // 利用者 A が自分の予約をキャンセル
  await page.goto(`/reservations?r=${a.r}&t=${a.t}`);
  await page.waitForSelector("html[data-cancel-form-ready='true']");
  await page
    .getByRole("button", { name: "この予約をキャンセルする" })
    .click({ force: true });
  await page
    .getByRole("button", { name: "キャンセルを確定する" })
    .click({ force: true });
  await expect(page.getByText("この予約はキャンセル済みです")).toBeVisible({
    timeout: 15_000,
  });

  // 繰り上げ後、利用者 B の確認画面が「ご予約は確定しています」に変わる
  // Server Action の revalidate は即時なので、reload すれば反映されているはず
  await pageB.reload();
  await expect(pageB.getByText(/ご予約は確定しています/)).toBeVisible({
    timeout: 15_000,
  });

  await contextB.close();
});
