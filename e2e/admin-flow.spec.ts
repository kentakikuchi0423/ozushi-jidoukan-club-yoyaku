import { expect, test } from "@playwright/test";

// 管理者 E2E: ログイン → クラブ・事業を新規登録 → そのマスターを選択してクラブ新規登録
// → 一覧に出る → 編集（capacity 変更） → 編集が反映される → 削除 → 一覧から消える
// → クラブ・事業のマスターを削除 → ログアウト
//
// 本物の Supabase / DB に対して動くため、opt-in にしている。
//   RUN_ADMIN_FLOW_E2E=1 PORT=3100 pnpm test:e2e e2e/admin-flow.spec.ts
//
// 実行前提:
//   - .env.local に ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD があること
//   - 3 館すべての権限を持つ全館管理者であること（docs/operations.md §3）

const runId = Date.now();
const programLabel = `E2E テスト事業 ${runId}`;
const targetAgeLabel = `${runId} 歳対象`;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function futureJstLocalString(offsetDays: number, hour: number): string {
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

  // 1. /admin は未ログインだと /admin/login?next=/admin/clubs にリダイレクト
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login/);
  await page.waitForSelector("html[data-admin-login-ready='true']");

  await page.locator("#admin-login-email").fill(email);
  await page.locator("#admin-login-password").fill(password);
  await page
    .getByRole("button", { name: "ログインする" })
    .click({ force: true });

  // 2. クラブ一覧（ログイン後の初期画面）に到達
  await page.waitForURL("**/admin/clubs", { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: "クラブ一覧" }),
  ).toBeVisible();

  // 3. まずクラブ・事業マスターを作る
  await page
    .getByRole("link", { name: "クラブ・事業の編集" })
    .click({ force: true });
  await page.waitForURL("**/admin/programs");
  await page
    .getByRole("link", { name: "新規登録" })
    .click({ force: true });
  await page.waitForURL("**/admin/programs/new");
  await page.waitForSelector("html[data-program-form-ready='true']");

  await page.locator("#program-name").fill(programLabel);
  await page.locator("#program-target-age").fill(targetAgeLabel);
  await page
    .locator("#program-summary")
    .fill(`${runId} 番目のテスト事業の概要文です。`);
  await page.getByRole("button", { name: "登録する" }).click({ force: true });
  await page.waitForURL("**/admin/programs");
  await expect(page.getByText(programLabel)).toBeVisible({ timeout: 15_000 });

  // 4. クラブ一覧に戻ってクラブ新規登録
  await page
    .getByRole("link", { name: "← クラブ一覧に戻る" })
    .click({ force: true });
  await page.waitForURL("**/admin/clubs");
  await page
    .getByRole("link", { name: "クラブを新規登録" })
    .click({ force: true });
  await page.waitForURL("**/admin/clubs/new");
  await page.waitForSelector("html[data-club-form-ready='true']");

  // 作った program を select から選ぶ
  await page.selectOption("#programId", { label: programLabel });

  const startAt = futureJstLocalString(45, 10);
  const endAt = futureJstLocalString(45, 12);
  await page.locator("#startAt").fill(startAt);
  await page.locator("#endAt").fill(endAt);
  await page.locator("#capacity").fill("5");
  await page
    .locator("#description")
    .fill("E2E テストで投入しました。末尾に削除されます。");

  await page.getByRole("button", { name: "登録する" }).click({ force: true });

  // 5. 新規登録後はクラブ一覧に戻り、新クラブが表示される
  await page.waitForURL("**/admin/clubs");
  await expect(page.getByText(programLabel)).toBeVisible({ timeout: 15_000 });

  // 6. 編集に進む
  const newRow = page.getByRole("article").filter({ hasText: programLabel });
  await newRow.getByRole("link", { name: "編集" }).click({ force: true });
  await page.waitForURL(/\/admin\/clubs\/[^/]+\/edit$/);
  await page.waitForSelector("html[data-club-form-ready='true']");

  // capacity を 5 → 8 に変更
  const capacityInput = page.locator("#capacity");
  await expect(capacityInput).toHaveValue("5");
  await capacityInput.fill("8");
  await page
    .getByRole("button", { name: "変更を保存する" })
    .click({ force: true });

  // 7. 一覧に戻り、capacity=8 の行になっていることを確認
  await page.waitForURL("**/admin/clubs");
  const updatedRow = page.getByRole("article").filter({ hasText: programLabel });
  await expect(updatedRow).toContainText("定員 8名");

  // 8. 削除フロー
  await updatedRow.getByRole("link", { name: "編集" }).click({ force: true });
  await page.waitForURL(/\/admin\/clubs\/[^/]+\/edit$/);
  await page.waitForSelector("html[data-club-form-ready='true']");

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "このクラブを削除する" })
    .click({ force: true });

  // 9. 一覧から消えていることを確認
  await page.waitForURL("**/admin/clubs");
  await expect(page.getByText(programLabel)).toHaveCount(0);

  // 10. クラブ・事業マスターも削除（ソフト削除）
  await page
    .getByRole("link", { name: "クラブ・事業の編集" })
    .click({ force: true });
  await page.waitForURL("**/admin/programs");
  const programArticle = page
    .getByRole("article")
    .filter({ hasText: programLabel });
  page.once("dialog", (dialog) => dialog.accept());
  await programArticle
    .getByRole("button", { name: "削除" })
    .click({ force: true });
  await expect(programArticle).toContainText("削除済み", { timeout: 15_000 });

  // 11. ログアウト（クラブ一覧の上部バーから）
  await page.goto("/admin/clubs");
  await page.getByRole("button", { name: "ログアウト" }).click({ force: true });
  await page.waitForURL("**/admin/login");
  await expect(
    page.getByRole("heading", { name: "管理者ログイン" }),
  ).toBeVisible();
});
