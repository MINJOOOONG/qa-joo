// Minimal stand-in for Supabase's API gateway: serves PostgREST under /rest/v1 so that
// @supabase/supabase-js can talk to a plain local PostgREST. Used by the repository contract
// tests (scripts/supabase-contract.sh) and CI; not part of the application.
import http from "node:http";

const upstream = new URL(process.env.POSTGREST_URL ?? "http://127.0.0.1:3001");
const port = Number(process.env.GATEWAY_PORT ?? 54321);

http
  .createServer((request, response) => {
    if (!request.url?.startsWith("/rest/v1")) {
      response.writeHead(404).end();
      return;
    }
    const proxied = http.request(
      {
        host: upstream.hostname,
        port: upstream.port,
        method: request.method,
        path: request.url.slice("/rest/v1".length) || "/",
        headers: { ...request.headers, host: upstream.host },
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      },
    );
    proxied.on("error", (error) => response.writeHead(502).end(String(error)));
    request.pipe(proxied);
  })
  .listen(port, () => console.log(`[gateway] /rest/v1 -> ${upstream.origin} on :${port}`));
