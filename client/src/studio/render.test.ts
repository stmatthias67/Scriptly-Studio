import { describe, expect, it } from "vitest";
import {
  estimateTextLayout,
  pagePixelDimensions,
  splitTextForHeight,
} from "./render";
import { parsePageSelection, sanitizeFilename } from "./ExportDialog";
import { basePaper } from "./types";

describe("Dokumentlayout", () => {
  it("rechnet A4 verlässlich in die 96-DPI-Basis um", () => {
    const size = pagePixelDimensions(basePaper);
    expect(size.width).toBe(794);
    expect(size.height).toBe(1123);
  });

  it("meldet Textüberlauf für einen zu niedrigen Block", () => {
    const layout = estimateTextLayout(
      "Ein längerer Text mit mehreren Wörtern, der umbrochen wird.",
      110,
      20,
      1.4,
      0,
      30
    );
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.overflow).toBe(true);
  });

  it("teilt überlaufenden Text für die Fortsetzungsseite", () => {
    const split = splitTextForHeight({
      text: "eins zwei drei vier fünf sechs sieben acht neun zehn",
      width: 90,
      height: 45,
      fontSize: 18,
      lineHeight: 1.3,
      paragraphSpacing: 0,
    });
    expect(split.visible).not.toBe("");
    expect(split.overflow).not.toBe("");
  });
});

describe("Export-Seitenauswahl", () => {
  it("akzeptiert einzelne Seiten und Bereiche ohne Duplikate", () => {
    expect(parsePageSelection("1, 3-5, 4", 6)).toEqual([0, 2, 3, 4]);
  });

  it("lehnt ungültige Bereiche sicher ab", () => {
    expect(parsePageSelection("0, 2-x, 9", 4)).toEqual([]);
  });

  it("bereinigt Dateinamen ohne leeren Namen zu erzeugen", () => {
    expect(sanitizeFilename("  Mein: Dokument / 2026  ")).toBe(
      "Mein-Dokument-2026"
    );
    expect(sanitizeFilename("...")).toBe("scriptly-dokument");
  });
});

describe("Absatzabstände und Fortsetzung", () => {
  it("meldet Überlauf, wenn Absatzabstände den nächsten Absatz verdrängen", () => {
    const text = "Ein Gedanke\nNoch ein Gedanke";
    const split = splitTextForHeight({
      text,
      width: 500,
      height: 50,
      fontSize: 20,
      lineHeight: 1,
      paragraphSpacing: 30,
    });
    expect(split.visible).toBe("Ein Gedanke");
    expect(split.overflow).toBe("Noch ein Gedanke");
  });
});
