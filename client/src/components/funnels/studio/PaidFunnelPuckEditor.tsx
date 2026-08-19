import { puckConfig } from "@/puck-poc/puckConfig";
import { toPuckData } from "@/puck-poc/jsonIo";
import "@/puck-poc/blocks.css";
import { Puck, type Data } from "@measured/puck";
import "@measured/puck/puck.css";
import {
  applyPuckPageData,
  type StudioState,
} from "@shared/paidFunnel/store";
import { puckDataFromGraph } from "@shared/paidFunnel/puckAdapter";
import type { Dispatch, SetStateAction } from "react";
import { useMemo } from "react";

const VIEWPORTS = [
  { width: 1280, height: "auto" as const, label: "Desktop", icon: "Monitor" as const },
  { width: 768, height: "auto" as const, label: "Tablet", icon: "Tablet" as const },
  { width: 360, height: "auto" as const, label: "Mobile", icon: "Smartphone" as const },
];

export function PaidFunnelPuckEditor({
  state,
  onChange,
}: {
  state: StudioState;
  onChange: Dispatch<SetStateAction<StudioState | null>>;
}) {
  const remountKey = [
    state.stepKey,
    state.history.past.length,
    state.history.future.length,
    state.document.graph.steps.map(step => step.key).join(","),
  ].join(":");
  const data = useMemo(
    () => puckDataFromGraph(state.document.graph, state.stepKey),
    // Intentionally remount-only; live puck edits update the graph without resetting the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [remountKey],
  );

  return (
    <div className="paid-funnel-puck-editor min-h-[640px] flex-1 bg-slate-100">
      <Puck
        key={remountKey}
        config={puckConfig}
        data={data as Data}
        headerTitle={state.document.graph.steps.find(step => step.key === state.stepKey)?.title ?? "Page"}
        headerPath="Saved as PaidFunnelGraph"
        viewports={VIEWPORTS}
        iframe={{ waitForStyles: false }}
        onChange={next => {
          const parsed = toPuckData(next);
          onChange(current => (current ? applyPuckPageData(current, parsed) : current));
        }}
        onPublish={next => {
          const parsed = toPuckData(next);
          onChange(current => (current ? applyPuckPageData(current, parsed) : current));
        }}
      />
    </div>
  );
}
