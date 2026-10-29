import { openDB, type IDBPDatabase } from "idb";
import { z } from "zod";
import type { StudioData } from "./types";

let database: Promise<IDBPDatabase> | undefined;
function db() {
  if (!database)
    database = openDB("scriptly-studio", 1, {
      upgrade(database) {
        database.createObjectStore("workspace");
      },
    }).catch(error => {
      database = undefined;
      throw error;
    });
  return database;
}
export async function readWorkspace(): Promise<StudioData | undefined> {
  return (await db()).get("workspace", "data");
}
export async function writeWorkspace(data: StudioData): Promise<void> {
  await (await db()).put("workspace", data, "data");
}
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const finite = z.number().finite();
const paper = z.object({
  type: z.enum([
    "blank",
    "lined",
    "grid",
    "dotted",
    "cornell",
    "todo",
    "weekly",
    "daily",
    "study",
    "journal",
    "custom",
  ]),
  format: z.enum(["A4", "A5", "Letter", "custom"]),
  width: finite.min(50).max(600),
  height: finite.min(50).max(600),
  orientation: z.enum(["portrait", "landscape"]),
  color,
  lineColor: color,
  spacing: finite.min(2).max(40),
  lineWidth: finite.min(0.05).max(2),
  margin: finite.min(0).max(80),
  header: z.string().max(200),
  footer: z.string().max(200),
  border: z.boolean(),
  texture: z.boolean(),
  pageNumbers: z.boolean(),
});
const element = z.object({
  id: z.string().max(100),
  type: z.enum([
    "text",
    "image",
    "rectangle",
    "ellipse",
    "line",
    "arrow",
    "checkbox",
    "highlight",
  ]),
  x: finite.min(-3000).max(3000),
  y: finite.min(-3000).max(3000),
  width: finite.min(1).max(3000),
  height: finite.min(1).max(5000),
  rotation: finite.min(-360).max(360),
  text: z.string().max(100000),
  fontId: z.string().max(100),
  fontSize: finite.min(1).max(300),
  color,
  bold: z.boolean(),
  italic: z.boolean(),
  align: z.enum(["left", "center", "right"]),
  lineHeight: finite.min(0.5).max(5),
  letterSpacing: finite.min(-10).max(50),
  paragraphSpacing: finite.min(0).max(100),
  src: z
    .string()
    .max(8000000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  checked: z.boolean().optional(),
});
const stamp = finite.min(0);
const fontSettings = z.object({
  spacing: finite.min(-200).max(500),
  wordSpacing: finite.min(0).max(1000),
  width: finite.min(30).max(200),
  slant: finite.min(-45).max(45),
  baseline: finite.min(200).max(360),
  smoothness: finite.min(0).max(100),
  variation: finite.min(0).max(100),
  size: finite.min(30).max(200),
});
const stroke = z.object({
  width: finite.min(0.5).max(40),
  points: z
    .array(
      z.object({
        x: finite.min(-100).max(500),
        y: finite.min(-100).max(500),
        pressure: finite.min(0).max(1).optional(),
      })
    )
    .max(20000),
});
const schema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(100),
        pages: z
          .array(
            z.object({
              id: z.string(),
              paper,
              elements: z.array(element).max(1000),
            })
          )
          .min(1)
          .max(200),
        createdAt: stamp,
        updatedAt: stamp,
        favorite: z.boolean(),
      })
    )
    .max(1000),
  fonts: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100),
        glyphs: z.record(
          z.string().min(1).max(2),
          z.object({ variants: z.array(z.array(stroke).max(500)).max(3) })
        ),
        settings: fontSettings,
        createdAt: stamp,
        updatedAt: stamp,
      })
    )
    .max(100),
  templates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100),
        paper,
        favorite: z.boolean(),
        builtIn: z.boolean().optional(),
      })
    )
    .max(1000),
});
export function validateBackup(value: unknown): StudioData {
  const envelope = z
    .object({
      version: z.literal(1),
      application: z.literal("Scriptly Studio"),
      data: schema,
    })
    .parse(value);
  return envelope.data as StudioData;
}
export function backupJson(data: StudioData): string {
  return JSON.stringify(
    { version: 1, application: "Scriptly Studio", data },
    null,
    2
  );
}
