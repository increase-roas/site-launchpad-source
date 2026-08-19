import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PUCK_POC_STORAGE_KEY,
  createBlankPuckData,
  loadPuckData,
  parsePuckData,
  savePuckData,
  serializePuckData,
} from "./puckData";
import { PuckPageRender } from "./PuckPageRender";
import { SAMPLE_PUCK_DATA } from "./sampleData";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

function toComparableMarkup(html: string): string {
  return html.replace(/<link rel="preload"[^>]*>/g, "").trim();
}

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
}

describe("puck poc data", () => {
  it("starts from a truly blank canvas", () => {
    const blank = createBlankPuckData();
    expect(blank.content).toEqual([]);
    expect(blank.root).toEqual({ props: { title: "Puck PoC" } });
  });

  it("roundtrips nested slot JSON without paid_funnels persistence", () => {
    const json = serializePuckData(SAMPLE_PUCK_DATA);
    const restored = parsePuckData(json);
    expect(restored).toEqual(SAMPLE_PUCK_DATA);

    const section = restored.content[0];
    expect(section?.type).toBe("Section");
    const nested = (section?.props as { content: unknown[] }).content;
    expect(Array.isArray(nested)).toBe(true);
    expect(nested[0]).toMatchObject({ type: "Columns" });
  });

  it("rejects invalid puck JSON", () => {
    expect(() => parsePuckData("{")).toThrow(/invalid puck json/i);
    expect(() => parsePuckData(JSON.stringify({ content: "nope" }))).toThrow(
      /invalid puck data/i,
    );
    expect(() =>
      parsePuckData(
        JSON.stringify({
          content: [{ type: "UnknownBlock", props: { id: "x" } }],
          root: { props: {} },
        }),
      ),
    ).toThrow(/unknown puck block/i);
  });

  it("saves and reloads from isolated localStorage", () => {
    const storage = memoryStorage();
    savePuckData(SAMPLE_PUCK_DATA, storage);
    expect(storage.getItem(PUCK_POC_STORAGE_KEY)).toBe(
      serializePuckData(SAMPLE_PUCK_DATA),
    );
    expect(loadPuckData(storage)).toEqual(SAMPLE_PUCK_DATA);
  });

  it("renders the same HTML fixture Astro uses", () => {
    const markup = renderToStaticMarkup(
      createElement(PuckPageRender, { data: SAMPLE_PUCK_DATA }),
    );
    const fixture = readFileSync(
      join(fixtureDir, "fixtures", "sample-render.html"),
      "utf8",
    ).trim();
    expect(toComparableMarkup(markup)).toBe(fixture);
  });
});
