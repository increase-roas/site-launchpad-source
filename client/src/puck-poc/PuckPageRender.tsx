import React from "react";
import type { PuckData } from "./puckData";
import { PuckBlock } from "./blocks";

export function PuckPageRender({ data }: { data: PuckData }) {
  return (
    <div className="puck-poc-root">
      {data.content.map((node, index) => (
        <PuckBlock
          key={typeof node.props.id === "string" ? node.props.id : String(index)}
          node={node}
        />
      ))}
    </div>
  );
}
