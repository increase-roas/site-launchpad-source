export const PUCK_POC_STORAGE_KEY = "site-launchpad:puck-poc:data";

export const PUCK_POC_BLOCK_TYPES = [
  "Section",
  "Columns",
  "Heading",
  "Text",
  "Image",
  "Button",
  "Form",
] as const;

export type PuckPocBlockType = (typeof PUCK_POC_BLOCK_TYPES)[number];

export type PuckComponentData = {
  type: PuckPocBlockType;
  props: Record<string, unknown>;
};

export type PuckData = {
  content: PuckComponentData[];
  root: { props?: Record<string, unknown> };
  zones?: Record<string, PuckComponentData[]>;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

const BLOCK_TYPE_SET = new Set<string>(PUCK_POC_BLOCK_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseComponent(raw: unknown): PuckComponentData {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    throw new Error("Invalid Puck data.");
  }
  if (!BLOCK_TYPE_SET.has(raw.type)) {
    throw new Error(`Unknown Puck block "${raw.type}".`);
  }
  const props = isRecord(raw.props) ? { ...raw.props } : {};
  if (raw.type === "Section") {
    props.content = Array.isArray(props.content)
      ? props.content.map(parseComponent)
      : [];
  }
  if (raw.type === "Columns") {
    props.columns = Array.isArray(props.columns)
      ? props.columns.map(parseComponent)
      : [];
  }
  return { type: raw.type as PuckPocBlockType, props };
}

export function createBlankPuckData(): PuckData {
  return {
    content: [],
    root: { props: { title: "Puck PoC" } },
  };
}

export function parsePuckData(json: string): PuckData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid Puck JSON.");
  }
  if (!isRecord(parsed)) {
    throw new Error("Invalid Puck data.");
  }
  if (!Array.isArray(parsed.content)) {
    throw new Error("Invalid Puck data.");
  }
  const root = isRecord(parsed.root) ? parsed.root : {};
  const zones = isRecord(parsed.zones)
    ? Object.fromEntries(
        Object.entries(parsed.zones).map(([key, value]) => {
          if (!Array.isArray(value)) {
            throw new Error("Invalid Puck data.");
          }
          return [key, value.map(parseComponent)];
        }),
      )
    : undefined;
  return {
    content: parsed.content.map(parseComponent),
    root: {
      props: isRecord(root.props) ? root.props : isRecord(root) ? root : {},
    },
    ...(zones ? { zones } : {}),
  };
}

export function serializePuckData(data: PuckData): string {
  return JSON.stringify(data, null, 2);
}

export function savePuckData(data: PuckData, storage: StorageLike): void {
  storage.setItem(PUCK_POC_STORAGE_KEY, serializePuckData(data));
}

export function loadPuckData(storage: StorageLike): PuckData | null {
  const raw = storage.getItem(PUCK_POC_STORAGE_KEY);
  if (!raw) return null;
  return parsePuckData(raw);
}
