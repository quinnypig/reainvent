import { trendsRequest } from "./trends.mjs";
import { accountRequest } from "./accounts.mjs";
import handler from "vinext/server/app-router-entry";
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  TREND_DB?: unknown;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  AUTH_DEV_ORIGIN?: string;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Block retired audit URLs before asset lookup, including stale deployed assets.
function retiredPath(path: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path).toLowerCase();
  } catch {
    return true;
  }
  return (
    decoded === "/data.json" ||
    decoded === "/favicon.png" ||
    decoded.startsWith("/og-reainvent") ||
    /^\/(archive|state|audit|tracker)(\/|$)/.test(decoded) ||
    decoded === "/_vinext/image"
  );
}
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/trends") {
      try {
        return await trendsRequest(request, env.TREND_DB);
      } catch {
        return Response.json(
          { error: "Session interest is temporarily unavailable." },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
    }
    if (
      url.pathname.startsWith("/api/account") ||
      url.pathname.startsWith("/api/auth/")
    ) {
      try {
        return await accountRequest(request, env);
      } catch {
        return Response.json(
          { error: "Account service temporarily unavailable." },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
    }
    if (retiredPath(url.pathname))
      return new Response("Not found", {
        status: 404,
        headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
      });
    if (url.pathname === "/__login" || url.pathname === "/__logout")
      return new Response(null, {
        status: 303,
        headers: { location: "/", "cache-control": "no-store" },
      });
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    const asset = await env.ASSETS.fetch(request);
    const response =
      asset.status === 404 ? await handler.fetch(request, env, ctx) : asset;
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    if (headers.get("content-type")?.includes("text/html"))
      headers.set("cache-control", "no-store");
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
