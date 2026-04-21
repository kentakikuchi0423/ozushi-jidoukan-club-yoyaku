import { expect, test } from "@playwright/test";

test("home page renders and lists all three facility chips", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /クラブを予約できるようになるまで/,
    }),
  ).toBeVisible();

  const chips = page.getByRole("listitem");
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toHaveText("大洲児童館");
  await expect(chips.nth(1)).toHaveText("喜多児童館");
  await expect(chips.nth(2)).toHaveText("徳森児童センター");
});

test("html lang is set to ja", async ({ page }) => {
  await page.goto("/");
  const lang = await page.locator("html").getAttribute("lang");
  expect(lang).toBe("ja");
});
