import { Puck, type Data } from "@measured/puck";
import React, { useMemo, useRef, useState, type ChangeEvent } from "react";
import { downloadPuckJson, readPuckJsonFile, toPuckData } from "./jsonIo";
import {
  createBlankPuckData,
  loadPuckData,
  savePuckData,
  type PuckData,
} from "./puckData";
import { puckConfig } from "./puckConfig";
import { SAMPLE_PUCK_DATA } from "./sampleData";

const VIEWPORTS = [
  { width: 1280, height: "auto" as const, label: "Desktop", icon: "Monitor" as const },
  { width: 768, height: "auto" as const, label: "Tablet", icon: "Tablet" as const },
  { width: 360, height: "auto" as const, label: "Mobile", icon: "Smartphone" as const },
];

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function initialData(): PuckData {
  const params = new URLSearchParams(window.location.search);
  if (params.get("sample") === "1") return SAMPLE_PUCK_DATA;
  const storage = browserStorage();
  if (!storage) return createBlankPuckData();
  try {
    return loadPuckData(storage) ?? createBlankPuckData();
  } catch {
    return createBlankPuckData();
  }
}

export function PuckPocEditor() {
  const [data, setData] = useState<PuckData>(initialData);
  const [editorKey, setEditorKey] = useState(0);
  const latest = useRef(data);
  latest.current = data;

  const persist = (next: PuckData, remount = false) => {
    latest.current = next;
    setData(next);
    const storage = browserStorage();
    if (storage) savePuckData(next, storage);
    if (remount) setEditorKey((key) => key + 1);
  };

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    persist(await readPuckJsonFile(file), true);
  };

  const overrides = useMemo(
    () => ({
      headerActions: ({ children }: { children: React.ReactNode }) => (
        <div className="puck-poc-header-actions">
          <button type="button" onClick={() => persist(createBlankPuckData(), true)}>
            Blank canvas
          </button>
          <button type="button" onClick={() => persist(SAMPLE_PUCK_DATA, true)}>
            Load sample
          </button>
          <button type="button" onClick={() => downloadPuckJson(latest.current)}>
            Download JSON
          </button>
          <label>
            Upload JSON
            <input type="file" accept="application/json,.json" onChange={onUpload} />
          </label>
          <button type="button" onClick={() => persist(toPuckData(latest.current))}>
            Save
          </button>
          {children}
        </div>
      ),
    }),
    [],
  );

  return (
    <Puck
      key={editorKey}
      config={puckConfig}
      data={data as Data}
      headerTitle="Puck PoC"
      headerPath="Publish = local JSON · not paid_funnels"
      viewports={VIEWPORTS}
      iframe={{ waitForStyles: false }}
      onChange={(next) => {
        const parsed = toPuckData(next);
        latest.current = parsed;
        const storage = browserStorage();
        if (storage) savePuckData(parsed, storage);
      }}
      onPublish={(next) => {
        persist(toPuckData(next));
      }}
      overrides={overrides}
    />
  );
}
