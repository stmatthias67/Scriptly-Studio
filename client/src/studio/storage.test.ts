import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  backupJson,
  validateBackup,
  readWorkspace,
  writeWorkspace,
} from "./storage";
import {
  builtInTemplates,
  createPage,
  defaultFontSettings,
  type StudioData,
} from "./types";
const workspace = (): StudioData => ({
  documents: [
    {
      id: "document-1",
      title: "Meine Notizen",
      createdAt: 1,
      updatedAt: 2,
      favorite: false,
      pages: [createPage()],
    },
  ],
  fonts: [
    {
      id: "font-1",
      name: "Meine Handschrift",
      createdAt: 1,
      updatedAt: 2,
      settings: defaultFontSettings,
      glyphs: {
        A: {
          variants: [
            [
              {
                width: 4,
                points: [
                  { x: 100, y: 300 },
                  { x: 200, y: 100 },
                  { x: 300, y: 300 },
                ],
              },
            ],
          ],
        },
      },
    },
  ],
  templates: structuredClone(builtInTemplates),
});
describe("local workspace and backup", () => {
  it("preserves documents, paper, glyphs and favorites in a validated backup", () => {
    const data = workspace();
    expect(validateBackup(JSON.parse(backupJson(data)))).toEqual(data);
  });
  it("rejects an incompatible backup", () => {
    expect(() => validateBackup({ version: 2, data: workspace() })).toThrow();
  });
  it("rejects invalid paper dimensions and unsafe imported image data", () => {
    const data = workspace();
    data.documents[0].pages[0].paper.width = -2;
    expect(() => validateBackup(JSON.parse(backupJson(data)))).toThrow();
  });
  it("persists the complete workspace in IndexedDB across reads", async () => {
    const data = workspace();
    await writeWorkspace(data);
    expect(await readWorkspace()).toEqual(data);
    const changed = structuredClone(data);
    changed.documents[0].title = "Wieder geöffnet";
    await writeWorkspace(changed);
    expect((await readWorkspace())?.documents[0].title).toBe("Wieder geöffnet");
  });
  it("handles an empty workspace with valid starter templates", () => {
    const data = { documents: [], fonts: [], templates: builtInTemplates };
    expect(validateBackup(JSON.parse(backupJson(data)))).toEqual(data);
  });
});
