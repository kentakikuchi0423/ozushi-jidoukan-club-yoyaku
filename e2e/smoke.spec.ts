import { expect, test } from "@playwright/test";

test("home page renders the club listing shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "クラブを探して予約する" }),
  ).toBeVisible();

  // 現状はクラブ未登録なので空状態メッセージが出るが、クラブが登録されると
  // 空状態メッセージは消え、"予約する" ボタンが少なくとも 1 つ現れる。
  // どちらのケースでもこの smoke test は通るようにする。
  const hasEmptyState = await page.getByRole("status").isVisible();
  if (hasEmptyState) {
    await expect(page.getByRole("status")).toContainText(
      "予約できるクラブはありません",
    );
  } else {
    const reserveLinks = page.getByRole("link", { name: "予約する" });
    await expect(reserveLinks.first()).toBeVisible();
  }
});

test("home page links to the admin login placeholder", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "管理者の方はこちら" });
  await expect(link).toHaveAttribute("href", "/admin/login");
});

test("html lang is set to ja", async ({ page }) => {
  await page.goto("/");
  const lang = await page.locator("html").getAttribute("lang");
  expect(lang).toBe("ja");
});
