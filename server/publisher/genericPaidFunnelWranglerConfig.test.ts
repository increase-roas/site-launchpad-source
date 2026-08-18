import { describe, expect, it } from "vitest";
import {
  renderGenericPaidFunnelDeployWorkflow,
  renderGenericPaidFunnelWranglerToml,
} from "./genericPaidFunnelWranglerConfig";

describe("generic paid funnel deployment source", () => {
  it("renders only public vars and the exact provisioned D1 binding", () => {
    const rendered = renderGenericPaidFunnelWranglerToml({
      workerName: "funnel-client-7",
      runtimeVars: { META_PIXEL_ID: "123456789012345", META_GRAPH_API_VERSION: "v26.0" },
      resources: {
        d1: [{ binding: "FUNNEL_DB", name: "funnel-client-7-1", id: "database-id" }],
      },
    });
    expect(rendered).toContain('name = "funnel-client-7"');
    expect(rendered).toContain('binding = "FUNNEL_DB"');
    expect(rendered).toContain('database_id = "database-id"');
    expect(rendered).toContain('META_PIXEL_ID = "123456789012345"');
    expect(rendered).not.toContain("META_CAPI_ACCESS_TOKEN");
  });

  it("pins dispatch correlation to the persisted job and source SHA", () => {
    const workflow = renderGenericPaidFunnelDeployWorkflow();
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("publish_job_id:");
    expect(workflow).toContain("source_sha:");
    expect(workflow).toContain("run-name: Deploy ${{ inputs.publish_job_id }} ${{ inputs.source_sha }}");
    expect(workflow).toContain('ref: ${{ inputs.source_sha }}');
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$SOURCE_SHA"');
    expect(workflow).toContain("wrangler d1 migrations apply FUNNEL_DB --remote");
  });
});
