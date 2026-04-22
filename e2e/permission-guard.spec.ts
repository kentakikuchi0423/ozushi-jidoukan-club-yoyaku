import { expect, test } from "@playwright/test";

// 認可が掛かるべき画面/API が、未ログイン / 認証トークン無しで正しく弾かれる
// ことを確認する smoke。実際の DB データには書き込まない。default set で常時回す。

test.describe("unauthenticated access to /admin is redirected to login", () => {
  const guardedPaths = [
    "/admin",
    "/admin/clubs",
    "/admin/clubs/new",
    "/admin/password",
    "/admin/accounts",
  ];

  for (const path of guardedPaths) {
    test(`${path} → /admin/login?next=${path}`, async ({ page }) => {
      await page.goto(path);
      // リダイレクト後 URL を自前で解釈（searchParams.get は URL-decode してくれる）
      await page.waitForURL(/\/admin\/login\?/);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/admin/login");
      expect(url.searchParams.get("next")).toBe(path);
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
