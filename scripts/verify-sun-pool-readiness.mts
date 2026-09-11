import { summarizeAstroConfigReadiness } from "../shared/astroConfigReadiness.ts";

const API = "http://127.0.0.1:3000";

async function trpc(procedure: string, input: unknown) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const response = await fetch(`${API}/api/trpc/${procedure}?input=${encoded}`);
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${procedure} failed: ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result.data.json;
}

const view = await trpc("astroConfig.get", { clientId: 13 });
const readiness = summarizeAstroConfigReadiness(view.input, view.assets, view.secretStatus);
console.log(JSON.stringify({
  ready: readiness.ready,
  requiredFilled: readiness.requiredFilled,
  requiredTotal: readiness.requiredTotal,
  tabs: Object.fromEntries(
    Object.entries(readiness.tabs).map(([id, tab]) => [
      id,
      `${tab.state} ${tab.requiredFilled}/${tab.requiredTotal}`,
    ]),
  ),
  incompleteFields: [...readiness.fields.entries()].map(([path, issue]) => ({ path, ...issue })),
}, null, 2));
