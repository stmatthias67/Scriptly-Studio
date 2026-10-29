import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const server = spawn(
  "pnpm",
  [
    "exec",
    "vite",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ],
  { stdio: "ignore", detached: true }
);
let browser;
try {
  const origin = "http://127.0.0.1:5173";
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      ready = (await fetch(origin)).ok;
      if (ready) break;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  if (!ready) throw new Error("Produktions-Testserver nicht bereit.");
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(origin);
  await expect(
    page.getByText("Ein leeres Blatt voller Möglichkeiten.", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Neues Dokument", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByLabel("Inhalt", { exact: true })
    .fill(
      "Das gebaute Produktionsbundle exportiert deutsche Texte: Äpfel, Öl und Grüße."
    );
  await page.getByRole("button", { name: "Exportieren", exact: true }).click();
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export starten", exact: true })
    .click();
  const file = await wait;
  await file.saveAs("artifacts/production.pdf");
  await page.goto(origin + "/einstellungen");
  await page.locator(".color-palette input").fill("#ffffff");
  await page.waitForTimeout(50);
  expect(
    await page
      .locator(".btn.primary")
      .first()
      .evaluate(el => getComputedStyle(el).color)
  ).toBe("rgb(33, 53, 41)");
  await page.goto(origin + "/gibt-es-nicht");
  await page.waitForURL("**/404");
  await expect(
    page.getByRole("heading", {
      name: "Diese Seite gibt es nicht.",
      exact: true,
    })
  ).toBeVisible();
  expect(errors).toEqual([]);
  await fs.writeFile(
    "artifacts/production-test-results.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "Gebautes Produktionsbundle und Leerdaten-Start",
          "Textbearbeitung und verzögert geladener echter PDF-Export",
          "Kontrast bei weißer Akzentfarbe",
          "Deutsche Fehlerseite und unbekannte Route",
        ],
        errors,
      },
      null,
      2
    )
  );
  console.log(
    "Produktionsbundle, dynamischer PDF-Export, freie Akzentfarbe und Fehlerseite bestanden."
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
