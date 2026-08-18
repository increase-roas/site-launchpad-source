import type { GenericPaidFunnelProvisionedResources } from "../../shared/genericPaidFunnelPublish";

function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function renderGenericPaidFunnelWranglerToml(input: {
  workerName: string;
  runtimeVars: Record<string, string>;
  resources: GenericPaidFunnelProvisionedResources;
}): string {
  const vars = Object.entries(input.runtimeVars)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => {
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
        throw new Error(`Invalid Worker variable name: ${name}`);
      }
      return `${name} = ${tomlString(value)}`;
    })
    .join("\n");
  const d1 = input.resources.d1
    .map(resource => `[[d1_databases]]
binding = ${tomlString(resource.binding)}
database_name = ${tomlString(resource.name)}
database_id = ${tomlString(resource.id)}
migrations_dir = "migrations"`)
    .join("\n\n");
  return `name = ${tomlString(input.workerName)}
compatibility_date = "2026-08-01"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[vars]
${vars}

${d1}
`;
}

export function renderGenericPaidFunnelDeployWorkflow(): string {
  return `name: Deploy

on:
  workflow_dispatch:
    inputs:
      publish_job_id:
        description: Persisted dashboard publish job ID
        required: true
        type: string
      source_sha:
        description: Persisted source commit SHA
        required: true
        type: string

run-name: Deploy \${{ inputs.publish_job_id }} \${{ inputs.source_sha }}

permissions:
  contents: read

concurrency:
  group: deploy-\${{ github.repository }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - name: Validate source SHA
        env:
          SOURCE_SHA: \${{ inputs.source_sha }}
        shell: bash
        run: |
          if [[ ! "$SOURCE_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
            echo "source_sha must be a full 40-character hexadecimal commit SHA." >&2
            exit 1
          fi
      - name: Checkout exact source
        uses: actions/checkout@v4
        with:
          ref: \${{ inputs.source_sha }}
      - name: Verify checked-out source
        env:
          SOURCE_SHA: \${{ inputs.source_sha }}
        run: test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install dependencies
        run: npm install --no-audit --no-fund
      - name: Build
        run: npm run build
      - name: Apply D1 migrations
        run: npx wrangler d1 migrations apply FUNNEL_DB --remote
      - name: Deploy exact source
        run: npx wrangler deploy
`;
}
