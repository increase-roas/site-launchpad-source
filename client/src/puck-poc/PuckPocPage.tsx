import React from "react";
import { PuckPocEditor } from "./PuckPocEditor";
import { isPuckPocEnabled } from "./puckPocFlag";

export function PuckPocPage() {
  const enabled = isPuckPocEnabled(
    typeof window === "undefined" ? "" : window.location.search,
    import.meta.env.VITE_PUCK_POC,
  );

  if (!enabled) {
    return (
      <div className="puck-poc-shell">
        <div className="puck-poc-disabled">
          <h1>Puck PoC is off</h1>
          <p>
            Feature-flagged dead end. Set <code>VITE_PUCK_POC=1</code> or open with{" "}
            <code>?puck=1</code>. Does not replace Paid Ads / PaidFunnelGraph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="puck-poc-shell">
      <div className="puck-poc-shell__banner">
        <strong>Puck proof</strong>
        <span>
          Isolated editor · localStorage JSON only · Paid Ads workspace untouched
        </span>
      </div>
      <div className="puck-poc-shell__editor">
        <PuckPocEditor />
      </div>
    </div>
  );
}
