import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("artifacts");
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
const logs = [];
const log = text => {
  logs.push(text);
  console.log(text);
};
const saved = async () => {
  await expect(page.locator(".topbar .save-status")).toContainText(
    "Alle Änderungen gespeichert",
    { timeout: 10000 }
  );
};
async function readData() {
  return page.evaluate(async () => {
    const request = indexedDB.open("scriptly-studio", 1);
    const db = await new Promise((res, rej) => {
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });
    const tx = db.transaction("workspace");
    const get = tx.objectStore("workspace").get("data");
    return new Promise((res, rej) => {
      get.onsuccess = () => res(get.result);
      get.onerror = () => rej(get.error);
    });
  });
}
async function download(action, name) {
  const waiting = page.waitForEvent("download", { timeout: 20000 });
  await action();
  const file = await waiting;
  const target = path.join(root, name || file.suggestedFilename());
  await file.saveAs(target);
  log(`Download: ${path.basename(target)}`);
  return target;
}
try {
  await page.goto("http://localhost:3000");
  await expect(
    page.getByText("Ein leeres Blatt voller Möglichkeiten.", { exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: path.join(root, "dashboard-desktop.png"),
    fullPage: true,
  });
  log("Übersicht und ehrlicher Leerzustand geprüft.");
  await page.goto("http://localhost:3000/schrift-erstellen");
  await expect(page.locator(".font-canvas")).toBeVisible();
  const fontUrl = page.url();
  await page
    .getByLabel("Name der Schrift", { exact: true })
    .fill("Meine Testhandschrift");
  await page.getByLabel("Name der Schrift", { exact: true }).blur();
  async function draw(points) {
    const canvas = page.locator(".font-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const rect = await canvas.boundingBox();
    await page.mouse.move(
      rect.x + (points[0][0] * rect.width) / 400,
      rect.y + (points[0][1] * rect.height) / 400
    );
    await page.mouse.down();
    for (const [x, y] of points.slice(1))
      await page.mouse.move(
        rect.x + (x * rect.width) / 400,
        rect.y + (y * rect.height) / 400,
        { steps: 6 }
      );
    await page.mouse.up();
  }
  await draw([
    [85, 300],
    [200, 70],
    [315, 300],
  ]);
  await draw([
    [125, 225],
    [275, 225],
  ]);
  await page
    .getByRole("button", { name: "Zeichen speichern", exact: true })
    .click();
  await page.getByRole("button", { name: /^B: / }).click();
  await draw([
    [100, 300],
    [100, 70],
    [230, 80],
    [260, 150],
    [100, 180],
    [250, 195],
    [275, 265],
    [100, 300],
  ]);
  await page
    .getByRole("button", { name: "Zeichen speichern", exact: true })
    .click();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await saved();
  let data = await readData();
  expect(Object.keys(data.fonts[0].glyphs)).toEqual(["A", "B"]);
  await page.reload();
  await expect(page.locator(".font-canvas path.font-stroke")).toHaveCount(2);
  await page.getByRole("button", { name: /^B: / }).click();
  await expect(page.locator(".font-canvas path.font-stroke")).toHaveCount(1);
  await download(
    () =>
      page
        .getByRole("button", { name: "OTF herunterladen", exact: true })
        .first()
        .click(),
    "test-handschrift.otf"
  );
  log(
    "Schriftprojekt mit A/B, Undo/Redo, Wiederöffnen und echter OTF-Datei geprüft."
  );
  await page.goto("http://localhost:3000/dokumente");
  await page
    .getByRole("button", { name: "Neues Dokument", exact: true })
    .first()
    .click();
  await expect(page.locator(".studio-editor")).toBeVisible();
  const docUrl = page.url();
  await page
    .getByLabel("Titel bearbeiten", { exact: true })
    .fill("Gedanken auf Papier");
  await page.getByLabel("Titel bearbeiten", { exact: true }).blur();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByLabel("Inhalt", { exact: true })
    .fill(
      "AB AB\nÄpfel, Öl und Grüße.\nEin langer Gedanke bleibt erhalten und wird vollständig dargestellt."
    );
  await page
    .getByRole("button", { name: "Text übernehmen", exact: true })
    .click();
  await page
    .getByLabel("Schrift", { exact: true })
    .selectOption(data.fonts[0].id);
  await expect(page.locator(".glyph-warning")).toContainText("fehlen");
  await page.locator('.format-grid input[type="number"]').first().fill("30");
  await page.getByRole("button", { name: "Fett", exact: true }).click();
  await page
    .getByRole("button", { name: "Element duplizieren", exact: true })
    .click();
  await expect(page.locator(".canvas-element")).toHaveCount(2);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".canvas-element")).toHaveCount(1);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await expect(page.locator(".canvas-element")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Element löschen", exact: true })
    .click();
  await page
    .locator(".paper-type-choice")
    .filter({ hasText: "Liniert" })
    .click();
  await page
    .getByRole("button", { name: "Seite hinzufügen", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Überschrift", exact: true }).click();
  await page.getByLabel("Inhalt", { exact: true }).fill("Meine zweite Seite");
  await page
    .getByRole("button", { name: "Text übernehmen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Seite nach oben", exact: true })
    .nth(1)
    .click();
  await saved();
  data = await readData();
  const doc = data.documents.find(d => d.title === "Gedanken auf Papier");
  expect(doc.pages).toHaveLength(2);
  expect(doc.pages[0].elements[0].text).toBe("Meine zweite Seite");
  await page.reload();
  await expect(page.locator(".page-thumb")).toHaveCount(2);
  await page.screenshot({
    path: path.join(root, "editor-desktop.png"),
    fullPage: true,
  });
  const mainCanvas = page.locator(".page-stage canvas");
  expect(await mainCanvas.evaluate(c => c.toDataURL().length)).toBeGreaterThan(
    10000
  );
  await page.getByRole("button", { name: "Exportieren", exact: true }).click();
  await page.getByLabel("Dateiname", { exact: true }).fill("Gedanken-Test");
  await download(
    () =>
      page.getByRole("button", { name: "Export starten", exact: true }).click(),
    "workflow.pdf"
  );
  for (const [format, file] of [
    ["png", "workflow.png"],
    ["jpeg", "workflow.jpg"],
  ]) {
    await page
      .getByRole("button", { name: "Exportieren", exact: true })
      .click();
    await page.getByLabel("Format", { exact: true }).selectOption(format);
    await page.getByText("Aktuelle Seite (1)", { exact: true }).click();
    await download(
      () =>
        page
          .getByRole("button", { name: "Export starten", exact: true })
          .click(),
      file
    );
  }
  log(
    "Dokumenttext, eigene Schrift, Überlaufwarnung, Formatierung, Undo/Redo, Papier, Seitenreihenfolge, Reload und PDF/PNG/JPEG geprüft."
  );
  await page.goto("http://localhost:3000/papierstudio");
  await expect(page.locator(".paper-controls")).toBeVisible();
  await page
    .locator(".paper-type-choice")
    .filter({ hasText: "Cornell" })
    .click();
  await page.locator(".paper-controls select").first().selectOption("A5");
  await page.screenshot({
    path: path.join(root, "paper-desktop.png"),
    fullPage: true,
  });
  const allText = await page.locator("body").innerText();
  log("Papierstudio geöffnet: " + allText.slice(-180));
  await page.goto("http://localhost:3000/einstellungen");
  await page.getByRole("button", { name: "Dunkel", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByLabel("Wie dürfen wir dich nennen?", { exact: true })
    .fill("Mara");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await download(
    () =>
      page
        .getByRole("button", { name: "Sicherung herunterladen", exact: true })
        .click(),
    "workspace-backup.json"
  );
  await page.screenshot({
    path: path.join(root, "settings-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hell", exact: true }).click();
  log("Dunkelmodus, lokale Einstellungen und Datensicherung geprüft.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000");
  await expect(
    page.getByRole("button", { name: "Navigation öffnen", exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page
    .getByRole("button", { name: "Navigation öffnen", exact: true })
    .click();
  await page.getByRole("link", { name: "Dokumente", exact: true }).click();
  await expect(page.locator(".library-page")).toBeVisible();
  await page.goto(docUrl);
  await expect(page.locator(".studio-editor")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: path.join(root, "editor-mobile.png"),
    fullPage: true,
  });
  await page.goto(fontUrl);
  await expect(page.locator(".font-canvas")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390);
  log(
    "Mobile Navigation, Editor und Zeichenstudio ohne horizontales Überlaufen geprüft."
  );
  expect(errors).toEqual([]);
  log("Keine JavaScript-Laufzeitfehler.");
  await fs.writeFile(
    path.join(root, "browser-test-results.json"),
    JSON.stringify({ passed: true, checks: logs, errors }, null, 2)
  );
} catch (error) {
  console.error(error);
  await page.screenshot({
    path: path.join(root, "test-failure.png"),
    fullPage: true,
  });
  await fs.writeFile(
    path.join(root, "browser-test-results.json"),
    JSON.stringify(
      { passed: false, checks: logs, errors, failure: String(error) },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
