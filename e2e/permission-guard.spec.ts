import { expect, test } from "@playwright/test";

// 認可が掛かるべき画面/API が、未ログイン / 認証トークン無しで正しく弾かれる
// ことを確認する smoke。実際の DB データには書き込まない。default set で常時回す。

test.describe("unauthenticated access to /admin is redirected to login", () => {
  // `/admin` は middleware で `/admin/clubs` にリライトされるので、
  // 未ログイン時の最終 next は `/admin/clubs` になる（ログイン後の初期画面）。
  const guardedPaths: ReadonlyArray<{ visit: string; expectedNext: string }> = [
    { visit: "/admin", expectedNext: "/admin/clubs" },
    { visit: "/admin/clubs", expectedNext: "/admin/clubs" },
    { visit: "/admin/clubs/new", expectedNext: "/admin/clubs/new" },
    { visit: "/admin/password", expectedNext: "/admin/password" },
    { visit: "/admin/accounts", expectedNext: "/admin/accounts" },
  ];

  for (const { visit, expectedNext } of guardedPaths) {
    test(`${visit} → /admin/login?next=${expectedNext}`, async ({ page }) => {
      await page.goto(visit);
      // リダイレクト後 URL を自前で解釈（searchParams.get は URL-decode してくれる）
      await page.waitForURL(/\/admin\/login\?/);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/admin/login");
      expect(url.searchParams.get("next")).toBe(expectedNext);
      await expect(
        page.getByRole("heading", { name: "管理者ログイン" }),
      ).toBeVisible();
    });
  }
});

test("/admin/login itself is reachable without auth", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "管理者ログイン" }),
  ).toBeVisible();
});

test("/api/cron/retention-cleanup rejects missing / wrong bearer", async ({
  request,
}) => {
  const noHeader = await request.get("/api/cron/retention-cleanup");
  // CRON_SECRET 未設定なら 503、設定済みなら 401 のどちらか。401 系 (401/503) を受容。
  expect([401, 503]).toContain(noHeader.status());

  const wrongBearer = await request.get("/api/cron/retention-cleanup", {
    headers: { authorization: "Bearer wrong-token" },
  });
  expect([401, 503]).toContain(wrongBearer.status());
});

test("home page responds 200 and carries the security headers", async ({
  request,
}) => {
  const res = await request.get("/");
  expect(res.ok()).toBe(true);
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(res.headers()["strict-transport-security"]).toMatch(/max-age=/);
});

test("home page sets a nonce-based CSP in production", async ({ request }) => {
  const res = await request.get("/");
  const csp = res.headers()["content-security-policy"];
  expect(csp, "CSP header should be present").toBeTruthy();
  expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+\/=_-]+'/);
  expect(csp).toMatch(/frame-ancestors 'none'/);
  expect(csp).toMatch(/object-src 'none'/);
});

test("skip-to-content link is in the DOM on the home page", async ({
  page,
}) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", {
    name: "メインコンテンツへスキップ",
  });
  await expect(skipLink).toHaveAttribute("href", "#main-content");
  // #main-content が存在し、tabIndex=-1 でプログラム的にフォーカス可能
  await expect(page.locator("#main-content")).toBeAttached();
});

// 非 super_admin が super_admin 専用画面にアクセスした際、amber 警告だけが
// 見えて機能は触れないことを確認する opt-in テスト。
// 前提:
//   - `.env.local` に ADMIN_SINGLE_FACILITY_EMAIL / _PASSWORD が設定されている
//     （1 館のみ権限を持つテスト admin。operations.md の手順で事前に作成）
//   - `.env.local` に ADMIN_BOOTSTRAP_EMAIL / _PASSWORD（super_admin）も併存
//   - `RUN_PERMISSION_E2E=1` で明示的に起動する
test.describe("non-super admin sees amber warning on super-only pages", () => {
  test.describe.configure({ mode: "serial" });

  const superOnlyPaths = [
    { path: "/admin/facilities", heading: "館の管理" },
    { path: "/admin/accounts", heading: "アカウント追加・削除" },
  ] as const;

  for (const { path } of superOnlyPaths) {
    test(`${path} shows amber warning for non-super admin`, async ({
      page,
    }) => {
      test.skip(
        !process.env.RUN_PERMISSION_E2E,
        "RUN_PERMISSION_E2E=1 で opt-in（2 人目の admin が必要）",
      );
      const email = process.env.ADMIN_SINGLE_FACILITY_EMAIL;
      const password = process.env.ADMIN_SINGLE_FACILITY_PASSWORD;
      if (!email || !password) {
        throw new Error(
          ".env.local に ADMIN_SINGLE_FACILITY_EMAIL / _PASSWORD を設定してください",
        );
      }

      await page.goto("/admin/login");
      await page.waitForSelector("html[data-admin-login-ready='true']");
      await page.locator("#admin-login-email").fill(email);
      await page.locator("#admin-login-password").fill(password);
      await page
        .getByRole("button", { name: "ログインする" })
        .click({ force: true });
      await page.waitForURL("**/admin/clubs", { timeout: 15_000 });

      await page.goto(path);
      await expect(
        page.getByText("このページは全館管理者のみ利用できます。"),
      ).toBeVisible({ timeout: 10_000 });
      // 機能リンクが無いことを確認（新規登録・編集・削除・一覧が出ない）
      await expect(page.getByRole("link", { name: "新規登録" })).toHaveCount(0);
    });
  }
});
