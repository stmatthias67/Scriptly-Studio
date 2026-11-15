import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildGoodnotesNotebook,
  bv41,
  latin1,
  pb,
  strokeBlob,
} from "./goodnotes-format";
import { BLANK_NOTEBOOK_BASE64 } from "./goodnotes-shell";

const stroke = {
  points: [
    [100, 200],
    [150, 260],
    [200, 200],
  ] as Array<[number, number]>,
  width: 3,
  rgba: [0.2, 0.3, 0.25, 1] as [number, number, number, number],
};

async function shellNames() {
  const zip = await JSZip.loadAsync(latin1.encode(atob(BLANK_NOTEBOOK_BASE64)));
  return Object.keys(zip.files).filter(name => !zip.files[name].dir);
}

describe("native GoodNotes notebooks", () => {
  it("frames point data as an LZ4 literal block in Apple's bv41 frame", () => {
    const raw = strokeBlob(stroke.points, stroke.width);
    expect(latin1.decode(raw.subarray(0, 4))).toBe("tpl\0");
    expect(new DataView(raw.buffer).getUint32(4, true)).toBe(raw.length);
    const framed = bv41(raw);
    expect(latin1.decode(framed.subarray(0, 4))).toBe("bv41");
    expect(latin1.decode(framed.subarray(framed.length - 4))).toBe("bv4$");
    expect(new DataView(framed.buffer).getUint32(4, true)).toBe(raw.length);
  });

  it("writes a .goodnotes archive with renewed IDs, the strokes and the paper", async () => {
    const paperPdf = latin1.encode("%PDF-1.3\n% test paper\n");
    const bytes = await buildGoodnotesNotebook({
      strokes: [stroke, { ...stroke, points: [[300, 300]] }],
      paperPdf,
    });
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
    const original = await shellNames();
    expect(names).toHaveLength(original.length);
    expect(names).toContain("index.notes.pb");
    // Every page and attachment gets a fresh ID, so each export is its own notebook.
    const originalIds = original.filter(name => name.includes("/"));
    for (const name of originalIds) expect(names).not.toContain(name);

    const notePath = names.find(name => name.startsWith("notes/"))!;
    const records = pb.records(await zip.file(notePath)!.async("uint8array"));
    expect(records).toHaveLength(4); // header + body per stroke
    const body = pb.fields(records[1]).find(field => field.f === 7)!
      .v as Uint8Array;
    const blob = pb.fields(body).find(field => field.f === 2)!.v as Uint8Array;
    expect(latin1.decode(blob.subarray(0, 4))).toBe("bv41");

    // The notes index must point at the renamed stroke file.
    const index = latin1.decode(
      await zip.file("index.notes.pb")!.async("uint8array")
    );
    expect(index).toContain(notePath.slice("notes/".length));

    const attachment = names.find(name => name.startsWith("attachments/"))!;
    expect(await zip.file(attachment)!.async("uint8array")).toEqual(paperPdf);
  });
});
