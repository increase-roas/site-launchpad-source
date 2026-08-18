import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputArgument = process.argv[2];
if (!outputArgument) {
  throw new Error(
    "Usage: node scripts/verify-vercel-output-routing.mjs <vercel-output-directory>",
  );
}

const outputDirectory = path.resolve(outputArgument);
const requestPath = "/api/trpc/system.health";
const requestQuery = `input=${encodeURIComponent(
  JSON.stringify({ json: { timestamp: 0 } }),
)}`;
const requestUrl = `${requestPath}?${requestQuery}`;
const outputConfig = JSON.parse(
  await readFile(path.join(outputDirectory, "config.json"), "utf8"),
);

const matchingRoute = outputConfig.routes.find(route => {
  if (typeof route.src !== "string") {
    return false;
  }
  return new RegExp(route.src).test(requestPath);
});

if (!matchingRoute?.dest) {
  throw new Error(
    `Actual Vercel output does not route ${requestPath} to a function ` +
      `(matched status: ${matchingRoute?.status ?? "none"})`,
  );
}

const destinationPath = matchingRoute.dest.split("?", 1)[0];
const functionDirectory = path.join(
  outputDirectory,
  "functions",
  `${destinationPath.slice(1)}.func`,
);
const functionConfigPath = path.join(functionDirectory, ".vc-config.json");
await access(functionConfigPath);

const functionConfig = JSON.parse(await readFile(functionConfigPath, "utf8"));
const handlerPath = path.join(functionDirectory, functionConfig.handler);
await access(handlerPath);

const { default: handler } = await import(pathToFileURL(handlerPath).href);
let observedRequestUrl;
const server = createServer((request, response) => {
  observedRequestUrl = request.url;
  Promise.resolve(handler(request, response)).catch(error => {
    console.error(error);
    response.destroy(error);
  });
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected generated function probe to use a TCP address");
  }

  const response = await fetch(
    `http://127.0.0.1:${address.port}${requestUrl}`,
  );
  const body = await response.text();
  const parsedBody = JSON.parse(body);

  if (observedRequestUrl !== requestUrl) {
    throw new Error(
      `Generated function changed the original request URL: ${observedRequestUrl}`,
    );
  }
  if (
    response.status !== 200 ||
    parsedBody?.result?.data?.json?.ok !== true
  ) {
    throw new Error(
      `Generated nested tRPC function returned ${response.status}: ${body}`,
    );
  }

  console.log(`ROUTE_SRC=${matchingRoute.src}`);
  console.log(`ROUTE_DEST=${matchingRoute.dest}`);
  console.log(
    `FUNCTION=${path.relative(outputDirectory, functionDirectory)}`,
  );
  console.log(`HANDLER=${functionConfig.handler}`);
  console.log(`ORIGINAL_URL_PRESERVED=${observedRequestUrl === requestUrl}`);
  console.log(`HEALTH_HTTP=${response.status}`);
  console.log("VERCEL_OUTPUT_ROUTING=PASS");
} finally {
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}
