import type { Data } from "@measured/puck";
import {
  createBlankPuckData,
  parsePuckData,
  serializePuckData,
  type PuckData,
} from "./puckData";

export function toPuckData(data: Data | PuckData): PuckData {
  try {
    return parsePuckData(JSON.stringify(data));
  } catch {
    return createBlankPuckData();
  }
}

export function downloadPuckJson(data: PuckData, filename = "puck-poc.json"): void {
  const blob = new Blob([serializePuckData(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readPuckJsonFile(file: File): Promise<PuckData> {
  return parsePuckData(await file.text());
}
