import { describe, expect, it } from "vitest";
import { toPuckData } from "./jsonIo";
import { SAMPLE_PUCK_DATA } from "./sampleData";

describe("puck json io", () => {
  it("accepts editor-shaped data and keeps nested slots", () => {
    const restored = toPuckData(SAMPLE_PUCK_DATA);
    expect(restored.content[0]?.type).toBe("Section");
    expect(toPuckData({ content: "bad" } as never)).toEqual({
      content: [],
      root: { props: { title: "Puck PoC" } },
    });
  });
});
