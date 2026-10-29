import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const backup = JSON.parse(
  await fs.readFile("artifacts/workspace-backup.json", "utf8")
);
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on("dialog", d => d.accept());
const results = [];
const log = s => {
  results.push(s);
  console.log(s);
};
async function getData() {
  return page.evaluate(async () => {
    let r = indexedDB.open("scriptly-studio", 1);
    let db = await new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    let q = db.transaction("workspace").objectStore("workspace").get("data");
    return new Promise((res, rej) => {
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  });
}
async function putData(data) {
  await page.evaluate(async data => {
    let r = indexedDB.open("scriptly-studio", 1);
    let db = await new Promise((res, rej) => {
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    let tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(data, "data");
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }, data);
}
async function saved() {
  await expect(page.locator(".topbar .save-status")).toContainText(
    "Alle Änderungen gespeichert"
  );
}
try {
  await page.goto("http://localhost:3000");
  await expect(page.locator(".dashboard")).toBeVisible();
  await putData(backup.data);
  await page.reload();
  const font = backup.data.fonts[0];
  const doc = backup.data.documents[0];
  await page.goto(`http://localhost:3000/schriften/${font.id}`);
  await expect(page.locator(".font-canvas path.font-stroke")).toHaveCount(2);
  await page.getByRole("button", { name: "Radierer", exact: true }).click();
  const canvas = page.locator(".font-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(
    box.x + (85 * box.width) / 400,
    box.y + (300 * box.height) / 400
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + (200 * box.width) / 400,
    box.y + (225 * box.height) / 400,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(page.locator(".font-canvas path.font-stroke")).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".font-canvas path.font-stroke")).toHaveCount(2);
  await saved();
  log("Radierer als Ziehgeste und ein vollständiger Undo-Schritt geprüft.");
  await page
    .getByLabel("Name der Schrift", { exact: true })
    .fill("Schrift ohne Fokusverlust");
  await saved();
  expect((await getData()).fonts[0].name).toBe("Schrift ohne Fokusverlust");
  await page.reload();
  await expect(
    page.getByLabel("Name der Schrift", { exact: true })
  ).toHaveValue("Schrift ohne Fokusverlust");
  await page.goto(`http://localhost:3000/dokumente/${doc.id}`);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByLabel("Inhalt", { exact: true })
    .fill("Automatisch gespeichert, obwohl das Feld noch Fokus hat.");
  await saved();
  expect(
    (await getData()).documents[0].pages[0].elements.at(-1).text
  ).toContain("noch Fokus");
  await page.reload();
  await expect(page.locator(".canvas-element")).toHaveCount(2);
  log("Autosave für fokussierte Schriftname- und Texteingaben geprüft.");
  const wrapping = await page.evaluate(async () => {
    const { renderPage } = await import("/src/studio/render.ts");
    const d = await new Promise(res => {
      const r = indexedDB.open("scriptly-studio");
      r.onsuccess = () => {
        const q = r.result
          .transaction("workspace")
          .objectStore("workspace")
          .get("data");
        q.onsuccess = () => res(q.result);
      };
    });
    const p = structuredClone(d.documents[0].pages[0]);
    p.paper.type = "blank";
    p.paper.header = "";
    p.paper.footer = "";
    p.paper.pageNumbers = false;
    const e = structuredClone(p.elements[0]);
    e.text = "eins zwei drei vier fünf sechs sieben acht neun zehn";
    e.width = 100;
    e.height = 800;
    e.fontSize = 20;
    e.fontId = "manrope";
    e.bold = false;
    p.elements = [e];
    const seen = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      seen.push(text);
      return original.call(this, text, ...args);
    };
    try {
      await renderPage(p, []);
      return seen.join(" ");
    } finally {
      CanvasRenderingContext2D.prototype.fillText = original;
    }
  });
  expect(wrapping).toBe("eins zwei drei vier fünf sechs sieben acht neun zehn");
  log("Canvas-Textumbruch ohne wiederholte oder verlorene Wörter geprüft.");
  await page.goto("http://localhost:3000/papierstudio");
  await page
    .getByLabel("Name der Vorlage", { exact: true })
    .fill("Meine Lernvorlage");
  await page.getByLabel("Seitenformat", { exact: true }).selectOption("custom");
  await page.locator(".paper-custom-dimensions input").nth(0).fill("160");
  await page.locator(".paper-custom-dimensions input").nth(1).fill("240");
  await page
    .getByRole("button", { name: "Vorlage speichern", exact: true })
    .click();
  await saved();
  let data = await getData();
  let template = data.templates.find(t => t.name === "Meine Lernvorlage");
  expect(template.paper.width).toBe(160);
  expect(template.paper.height).toBe(240);
  await page
    .locator(".paper-type-choice")
    .filter({ hasText: "Cornell" })
    .click();
  await page
    .getByRole("button", { name: "Änderungen speichern", exact: true })
    .click();
  await saved();
  expect(
    (await getData()).templates.find(t => t.id === template.id).paper.type
  ).toBe("cornell");
  await page.goto("http://localhost:3000/vorlagen");
  let card = page
    .locator(".paper-template-card")
    .filter({ hasText: "Meine Lernvorlage" });
  await card
    .getByRole("button", { name: "Zu Favoriten hinzufügen", exact: true })
    .click();
  await saved();
  expect(
    (await getData()).templates.find(t => t.id === template.id).favorite
  ).toBe(true);
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Duplizieren", exact: true }).click();
  await saved();
  expect(
    (await getData()).templates.filter(t =>
      t.name.startsWith("Meine Lernvorlage")
    )
  ).toHaveLength(2);
  card = page
    .locator(".paper-template-card")
    .filter({ hasText: "Meine Lernvorlage – Kopie" });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Löschen", exact: true }).click();
  await page
    .getByRole("button", { name: "Endgültig löschen", exact: true })
    .click();
  await saved();
  expect(
    (await getData()).templates.filter(t =>
      t.name.startsWith("Meine Lernvorlage")
    )
  ).toHaveLength(1);
  log(
    "Eigene Millimetermaße sowie Vorlagen erstellen, bearbeiten, favorisieren, duplizieren und löschen geprüft."
  );
  await page.goto("http://localhost:3000/dokumente");
  await page
    .getByRole("button", { name: `Aktionen für ${doc.title}`, exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Duplizieren", exact: true })
    .click();
  await saved();
  expect((await getData()).documents).toHaveLength(2);
  await page.getByLabel("Dokumente suchen", { exact: true }).fill("Gedanken");
  await expect(page.locator(".document-card")).toHaveCount(2);
  await page
    .locator(".document-card")
    .last()
    .getByRole("button", { name: /Aktionen für/ })
    .click();
  await page.getByRole("menuitem", { name: "Löschen", exact: true }).click();
  await saved();
  expect((await getData()).documents).toHaveLength(1);
  log("Dokumentsuche, Duplizieren und bestätigtes Löschen geprüft.");
  await page.goto("http://localhost:3000/einstellungen");
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/workspace-backup.json");
  await expect(
    page.getByText("Deine Sicherung wurde wiederhergestellt.", { exact: true })
  ).toBeVisible();
  expect((await getData()).templates).toHaveLength(6);
  log("Validierte Sicherung tatsächlich wiederhergestellt.");
  const mixed = structuredClone(backup.data);
  mixed.documents[0].pages[0].paper = {
    ...mixed.documents[0].pages[0].paper,
    format: "A5",
    orientation: "landscape",
  };
  mixed.documents[0].pages[1].paper = {
    ...mixed.documents[0].pages[1].paper,
    format: "custom",
    width: 160,
    height: 240,
    orientation: "portrait",
  };
  await putData(mixed);
  await page.goto(`http://localhost:3000/dokumente/${doc.id}`);
  await page.getByRole("button", { name: "Exportieren", exact: true }).click();
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export starten", exact: true })
    .click();
  const dl = await wait;
  await dl.saveAs("artifacts/mixed-formats.pdf");
  log("PDF mit gemischten Originalformaten (A5 quer / 160 × 240 mm) erzeugt.");
  const broken = structuredClone(mixed);
  broken.documents[0].pages[0].elements.push({
    ...broken.documents[0].pages[0].elements[0],
    id: "broken-image",
    type: "image",
    src: "data:image/png;base64,YWJj",
    text: "",
  });
  await putData(broken);
  await page.reload();
  await page.getByRole("button", { name: "Exportieren", exact: true }).click();
  await page
    .getByRole("button", { name: "Export starten", exact: true })
    .click();
  await expect(page.locator(".export-error")).toContainText(
    "eingebettetes Bild"
  );
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  log(
    "Ungültiges eingebettetes Bild verhindert einen stillschweigend unvollständigen Export."
  );
  const failureContext = await browser.newContext();
  await failureContext.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Speicher voll", "QuotaExceededError");
    };
  });
  const failurePage = await failureContext.newPage();
  await failurePage.goto("http://localhost:3000");
  await failurePage
    .getByRole("button", { name: "Neues Dokument", exact: true })
    .first()
    .click();
  await expect(failurePage.locator(".topbar .save-status")).toContainText(
    "Speichern fehlgeschlagen"
  );
  await expect(
    failurePage.getByText(
      "Deine Änderungen konnten nicht gespeichert werden. Bitte erstelle eine Sicherung und prüfe den Browserspeicher.",
      { exact: true }
    )
  ).toBeVisible();
  await failureContext.close();
  log(
    "Simulierter IndexedDB-Speicherfehler mit sichtbarem Fehlerstatus geprüft."
  );
  await fs.writeFile(
    "artifacts/edge-test-results.json",
    JSON.stringify({ passed: true, checks: results }, null, 2)
  );
} catch (error) {
  console.error(error);
  await page.screenshot({ path: "artifacts/edge-failure.png", fullPage: true });
  await fs.writeFile(
    "artifacts/edge-test-results.json",
    JSON.stringify(
      { passed: false, checks: results, failure: String(error) },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
