import { expect, test } from "@playwright/test";

// 管理者 E2E: ログイン → クラブ新規登録 → 一覧に出る → 編集（capacity 変更）
// → 編集が反映される → 削除 → 一覧から消える → ログアウト
//
// 本物の Supabase / DB に対して動くため、opt-in にしている。
//   RUN_ADMIN_FLOW_E2E=1 PORT=3100 pnpm test:e2e e2e/admin-flow.spec.ts
//
// 実行前提:
//   - .env.local に ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD があること
//     （playwright.config.ts が読み込んで process.env に流す）
//   - 対応する auth.users + admins + admin_facilities が存在し、
//     3 館すべての権限を持つ super_admin であること（docs/operations.md §3）

const clubNamePrefix = "E2E テスト用";
const uniqueLabel = `${clubNamePrefix} ${Date.now()}`;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function futureJstLocalString(offsetDays: number, hour: number): string {
  // JST で「offsetDays 日後の hour 時」を datetime-local 形式で返す。
  // 現在が JST の何時かに依存しないよう、UTC now + 9h で JST カレンダーに合わせる。
  const nowUtc = new Date();
  const jstMs = nowUtc.getTime() + 9 * 60 * 60 * 1000;
  const d = new Date(jstMs);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )}T${pad(hour)}:00`;
}

test("super_admin can create, edit, and delete a club end-to-end", async ({
  page,
}) => {
  test.skip(
    !process.env.RUN_ADMIN_FLOW_E2E,
    "RUN_ADMIN_FLOW_E2E=1 で明示的に実行する（実 DB に対してクラブ作成→削除を行う）",
  );

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error(
      ".env.local に ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD を設定してください",
    );
  }

  page.on("pageerror", (err) =>
    console.error("[browser:pageerror]", err.message),
  );
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("[browser:console.error]", msg.text());
    }
  });

  // 1. /admin は未ログインだと /admin/login?next=/admin にリダイレクト
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login/);
  await page.waitForSelector("html[data-admin-login-ready='true']");

  await page.locator("#admin-login-email").fill(email);
  await page.locator("#admin-login-password").fill(password);
  await page.getByRole("button", { name: "ログインする" }).click();

  // 2. ダッシュボード到達
  await page.waitForURL("**/admin", { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /さん、お疲れさまです$/ }),
  ).toBeVisible();

  // 3. クラブを新規登録
  await page.getByRole("link", { name: "クラブを新規登録" }).click();
  await page.waitForURL("**/admin/clubs/new");
  await page.waitForSelector("html[data-club-form-ready='true']");

  const startAt = futureJstLocalString(45, 10);
  const endAt = futureJstLocalString(45, 12);

  await page.locator("#name").fill(uniqueLabel);
  await page.locator("#startAt").fill(startAt);
  await page.locator("#endAt").fill(endAt);
  await page.locator("#capacity").fill("5");
  await page.locator("#targetAgeMin").fill("3");
  await page.locator("#targetAgeMax").fill("6");
  await page
    .locator("#description")
    .fill("E2E テストで投入しました。末尾に削除されます。");

  await page.getByRole("button", { name: "登録する" }).click();

  // 4. 一覧に追加された新クラブを確認
  await page.waitForURL("**/admin/clubs");
  await expect(page.getByText(uniqueLabel)).toBeVisible({ timeout: 15_000 });

  // 5. 編集に進む（我々が作った行の「編集」リンクをクリック）
  const newRow = page
    .getByRole("article")
    .filter({ hasText: uniqueLabel });
  await newRow.getByRole("link", { name: "編集" }).click();
  await page.waitForURL(/\/admin\/clubs\/[^/]+\/edit$/);
  await page.waitForSelector("html[data-club-form-ready='true']");

  // capacity を 5 → 8 に変更
  const capacityInput = page.locator("#capacity");
  await expect(capacityInput).toHaveValue("5");
  await capacityInput.fill("8");
  await page.getByRole("button", { name: "変更を保存する" }).click();

  // 6. 一覧に戻り、capacity=8 の行になっていることを確認
  await page.waitForURL("**/admin/clubs");
  const updatedRow = page
    .getByRole("article")
    .filter({ hasText: uniqueLabel });
  await expect(updatedRow).toContainText("定員 8名");

  // 7. 削除フロー
  await updatedRow.getByRole("link", { name: "編集" }).click();
  await page.waitForURL(/\/admin\/clubs\/[^/]+\/edit$/);
  await page.waitForSelector("html[data-club-form-ready='true']");

  // window.confirm を自動で OK にする
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "このクラブを削除する" })
    .click();

  // 8. 一覧から消えていることを確認
  await page.waitForURL("**/admin/clubs");
  await expect(page.getByText(uniqueLabel)).toHaveCount(0);

  // 9. ログアウト（ダッシュボードへ戻って実施）
  await page.goto("/admin");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL("**/admin/login");
  await expect(
    page.getByRole("heading", { name: "管理者ログイン" }),
  ).toBeVisible();
});
