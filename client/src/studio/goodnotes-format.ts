/**
 * Writer for native GoodNotes notebooks (.goodnotes).
 *
 * GoodNotes publishes no specification. The structure below follows the format as
 * decoded by Inkly (https://github.com/Benspiel/Inkly, MIT License, Copyright (c) 2026
 * Ben (Benspiel)), whose writer this is ported from:
 *
 * - A .goodnotes file is a ZIP archive with Protobuf index files (index.*.pb), one PDF
 *   attachment holding the paper of the page and one stroke file per page (notes/<ID>).
 * - GoodNotes rejects archives built from scratch, so each export starts from a real,
 *   empty notebook (goodnotes-shell.ts) and receives fresh IDs. IDs keep their length,
 *   so Protobuf length prefixes stay valid.
 * - notes/<ID> is a sequence of length-prefixed Protobuf records, a header and a body
 *   per stroke (ID, Lamport clock, author; colour as RGBA floats, point data).
 * - Point data is a "tpl" block with the schema vuA(v)A(S(uu))A(S(uuuu))vA(f), wrapped
 *   in Apple's LZ4 frame ("bv41" ... "bv4$").
 * - Coordinates: origin top left, 1 PDF point = 11/6 GoodNotes units (A4 = 1091.35 x 1543.5).
 *
 * Strokes written this way are real GoodNotes ink: they can be erased, lassoed, moved
 * and recoloured in GoodNotes.
 */
import JSZip from "jszip";
import { BLANK_NOTEBOOK_BASE64 } from "./goodnotes-shell";

/** GoodNotes units per PDF point. */
export const GN_PER_PT = 11 / 6;
/** The shell notebook's page size in PDF points (A4 portrait). */
export const GN_PAGE_PT = { width: 595.28, height: 841.89 } as const;

export interface GoodNotesStroke {
  /** Points in GoodNotes units, origin top left. */
  points: Array<[number, number]>;
  /** Pen width in GoodNotes units. */
  width: number;
  /** Colour as 0..1 floats. */
  rgba: [number, number, number, number];
}

const UUID_RE = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g;
// The same in every GoodNotes export; it must survive the ID renewal unchanged.
const KEEP_IDS = new Set(["5A53E89E-F4C2-4548-8DD3-E9DF9FB4592E"]);
const TPL_SCHEMA = "vuA(v)A(S(uu))A(S(uuuu))vA(f)";

export const latin1 = {
  decode(bytes: Uint8Array): string {
    let text = "";
    for (let index = 0; index < bytes.length; index += 0x8000)
      text += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return text;
  },
  encode(text: string): Uint8Array {
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1)
      bytes[index] = text.charCodeAt(index) & 0xff;
    return bytes;
  },
};

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Minimal Protobuf wire encoding and decoding. */
export const pb = {
  varint(value: number | bigint): Uint8Array {
    const out: number[] = [];
    if (typeof value === "bigint") {
      let rest = value;
      do {
        let byte = Number(rest & 0x7fn);
        rest >>= 7n;
        if (rest) byte |= 0x80;
        out.push(byte);
      } while (rest);
    } else {
      let rest = value;
      do {
        let byte = rest % 128;
        rest = Math.floor(rest / 128);
        if (rest) byte |= 0x80;
        out.push(byte);
      } while (rest);
    }
    return Uint8Array.from(out);
  },
  v: (field: number, value: number | bigint) =>
    concat([pb.varint(field * 8), pb.varint(value)]),
  bytes: (field: number, value: Uint8Array) =>
    concat([pb.varint(field * 8 + 2), pb.varint(value.length), value]),
  str: (field: number, value: string) =>
    pb.bytes(field, new TextEncoder().encode(value)),
  f32(field: number, value: number): Uint8Array {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setFloat32(0, value, true);
    return concat([pb.varint(field * 8 + 5), bytes]);
  },
  fields(bytes: Uint8Array) {
    const out: Array<{ f: number; wt: number; v: bigint | Uint8Array }> = [];
    let index = 0;
    const readVarint = () => {
      let result = 0n;
      let shift = 0n;
      let byte: number;
      do {
        byte = bytes[index++];
        result |= BigInt(byte & 0x7f) << shift;
        shift += 7n;
      } while (byte & 0x80);
      return result;
    };
    while (index < bytes.length) {
      const key = Number(readVarint());
      const f = key >> 3;
      const wt = key & 7;
      let v: bigint | Uint8Array;
      if (wt === 0) v = readVarint();
      else if (wt === 1) {
        v = bytes.subarray(index, index + 8);
        index += 8;
      } else if (wt === 5) {
        v = bytes.subarray(index, index + 4);
        index += 4;
      } else if (wt === 2) {
        const length = Number(readVarint());
        v = bytes.subarray(index, index + length);
        index += length;
      } else throw new Error(`wire type ${wt}`);
      if (!f || index > bytes.length) throw new Error("not protobuf");
      out.push({ f, wt, v });
    }
    return out;
  },
  /** A file of records, each with a varint length prefix. */
  records(bytes: Uint8Array): Uint8Array[] {
    const out: Uint8Array[] = [];
    let index = 0;
    while (index < bytes.length) {
      let length = 0;
      let scale = 1;
      let byte: number;
      do {
        byte = bytes[index++];
        length += (byte & 0x7f) * scale;
        scale *= 128;
      } while (byte & 0x80);
      out.push(bytes.subarray(index, index + length));
      index += length;
    }
    return out;
  },
};

/** An LZ4 block made only of literals (valid per the LZ4 spec) in Apple's "bv41" frame. */
export function bv41(raw: Uint8Array): Uint8Array {
  const length = raw.length;
  const head = [Math.min(length, 15) << 4];
  if (length >= 15) {
    let rest = length - 15;
    while (rest >= 255) {
      head.push(255);
      rest -= 255;
    }
    head.push(rest);
  }
  const block = concat([Uint8Array.from(head), raw]);
  const header = new Uint8Array(12);
  header.set(latin1.encode("bv41"));
  new DataView(header.buffer).setUint32(4, length, true);
  new DataView(header.buffer).setUint32(8, block.length, true);
  return concat([header, block, latin1.encode("bv4$")]);
}

/** Point list (GoodNotes units) as a "tpl" block of straight quadratic segments. */
export function strokeBlob(
  input: Array<[number, number]>,
  width: number
): Uint8Array {
  const points = input.length === 1 ? [input[0], input[0]] : input;
  const segments = points.length - 1;
  const count = segments + 1;
  const schema = latin1.encode(`${TPL_SCHEMA}\0`);
  const dataLength = 2 + 4 + 4 + 2 * count + 4 + 8 + 4 + 16 * segments + 2 + 4;
  const total = 8 + schema.length + dataLength;
  const buffer = new Uint8Array(total);
  const view = new DataView(buffer.buffer);
  buffer.set(latin1.encode("tpl\0"));
  view.setUint32(4, total, true);
  buffer.set(schema, 8);
  let offset = 8 + schema.length;
  view.setUint16(offset, 2, true);
  offset += 2;
  view.setFloat32(offset, width, true);
  offset += 4;
  view.setUint32(offset, count, true);
  offset += 4;
  for (let index = 0; index < count; index += 1) {
    view.setUint16(offset, index === 0 ? 0 : 1, true);
    offset += 2;
  }
  view.setUint32(offset, 1, true);
  offset += 4;
  view.setFloat32(offset, points[0][0], true);
  view.setFloat32(offset + 4, points[0][1], true);
  offset += 8;
  view.setUint32(offset, segments, true);
  offset += 4;
  for (let index = 1; index < points.length; index += 1) {
    const [ax, ay] = points[index - 1];
    const [bx, by] = points[index];
    view.setFloat32(offset, (ax + bx) / 2, true);
    view.setFloat32(offset + 4, (ay + by) / 2, true);
    view.setFloat32(offset + 8, bx, true);
    view.setFloat32(offset + 12, by, true);
    offset += 16;
  }
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, 0, true);
  return buffer;
}

function newUuid(): string {
  return crypto.randomUUID().toUpperCase();
}

const random32 = () => crypto.getRandomValues(new Uint32Array(1))[0];

function strokeRecords(
  stroke: GoodNotesStroke,
  author: bigint,
  sequence: number,
  order: number
): Uint8Array {
  const id = newUuid();
  const clock = concat([pb.v(1, 1), pb.v(2, random32())]);
  const header = concat([
    pb.str(1, id),
    pb.bytes(2, clock),
    pb.v(8, author),
    pb.v(9, sequence),
    pb.v(14, 5381),
    pb.v(16, 24),
  ]);
  const color = concat(
    stroke.rgba.map((channel, index) =>
      channel ? pb.f32(index + 1, channel) : new Uint8Array(0)
    )
  );
  const empty = new Uint8Array(0);
  const sortKey = concat([order ? pb.v(1, order) : empty, pb.v(2, random32())]);
  const body = concat([
    pb.str(1, id),
    pb.bytes(2, bv41(strokeBlob(stroke.points, stroke.width))),
    pb.bytes(4, color),
    pb.bytes(6, empty),
    pb.bytes(7, pb.bytes(1, sortKey)),
    pb.bytes(9, empty),
    pb.bytes(15, clock),
    pb.bytes(20, empty),
    pb.v(21, 24),
  ]);
  const record = pb.bytes(7, body);
  return concat([
    pb.varint(header.length),
    header,
    pb.varint(record.length),
    record,
  ]);
}

/** Device/author ID from the shell's event log (field 13 of an event). */
function authorOf(events: Uint8Array): bigint {
  for (const record of pb.records(events)) {
    for (const top of pb.fields(record)) {
      if (top.wt !== 2 || top.f < 10) continue;
      try {
        const hit = pb
          .fields(top.v as Uint8Array)
          .find(field => field.f === 13 && field.wt === 0);
        if (hit) return hit.v as bigint;
      } catch {
        // not a nested message
      }
    }
  }
  throw new Error("Autorenkennung in der GoodNotes-Hülle nicht gefunden.");
}

/**
 * Renews IDs consistently. GoodNotes derives some IDs from each other (same start,
 * only the last characters differ), so only the front part is replaced.
 */
function makeRemapper() {
  const stems = new Map<string, string>();
  return (text: string) =>
    text.replace(UUID_RE, id => {
      if (KEEP_IDS.has(id)) return id;
      const stem = id.slice(0, -4);
      if (!stems.has(stem)) stems.set(stem, newUuid().slice(0, -4));
      return stems.get(stem) + id.slice(-4);
    });
}

function base64ToBytes(base64: string): Uint8Array {
  return latin1.encode(atob(base64));
}

const startsWithPdf = (bytes: Uint8Array) =>
  bytes.length > 5 && latin1.decode(bytes.subarray(0, 5)) === "%PDF-";

export interface NotebookPage {
  strokes: GoodNotesStroke[];
  /** One A4 page (595.28 x 841.89 pt) used as the paper; omitted keeps the blank paper. */
  paperPdf?: Uint8Array;
  thumbnailJpeg?: Uint8Array;
}

/** Builds one native .goodnotes notebook with a single page. */
export async function buildGoodnotesNotebook(
  page: NotebookPage
): Promise<Uint8Array> {
  const shell = await JSZip.loadAsync(base64ToBytes(BLANK_NOTEBOOK_BASE64));
  const names = Object.keys(shell.files).filter(name => !shell.files[name].dir);
  const notePath = names.find(name => name.startsWith("notes/"));
  let paperPath: string | undefined;
  for (const name of names.filter(entry => entry.startsWith("attachments/")))
    if (startsWithPdf(await shell.file(name)!.async("uint8array")))
      paperPath = name;
  if (!notePath || !paperPath)
    throw new Error("Die GoodNotes-Hülle ist unvollständig.");

  const author = authorOf(
    await shell.file("index.events.pb")!.async("uint8array")
  );
  const existing = await shell.file(notePath)!.async("uint8array");
  const notes = concat([
    existing,
    ...page.strokes.map((stroke, index) =>
      strokeRecords(stroke, author, 1000 + index, index)
    ),
  ]);
  const remap = makeRemapper();
  const out = new JSZip();
  for (const name of names) {
    let data: Uint8Array;
    if (name === notePath) data = notes;
    else if (name === paperPath && page.paperPdf) data = page.paperPdf;
    else if (name === "thumbnail.jpg" && page.thumbnailJpeg)
      data = page.thumbnailJpeg;
    else data = await shell.file(name)!.async("uint8array");
    if (
      name.endsWith(".pb") ||
      name.startsWith("notes/") ||
      name.startsWith("search/")
    )
      data = latin1.encode(remap(latin1.decode(data)));
    out.file(remap(name), data, {
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      date: new Date(),
      createFolders: false,
    });
  }
  return out.generateAsync({ type: "uint8array" });
}
