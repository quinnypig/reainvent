/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  SITE_PASSWORD?: string;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const ACCESS_COOKIE = "reainvent_access";

async function authToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`reainvent:${password}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalTokens(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

function loginPage(next: string, failed = false): Response {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>re:AInvent — private preview</title><style>
:root{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#171320;background:#f3f0e8}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;grid-template-rows:68px 1fr}.bar{display:flex;align-items:center;padding:0 5vw;background:#171320;color:white;border-bottom:4px solid #f90;font-size:27px;letter-spacing:-.05em}.bar b{color:#f26fc7}.wrap{width:min(620px,90vw);margin:auto;padding:64px 0 12vh}p{font-size:18px;line-height:1.5;color:#625d55}h1{margin:0 0 20px;font-size:clamp(48px,8vw,78px);line-height:.94;letter-spacing:-.055em}form{margin-top:38px;display:grid;grid-template-columns:1fr auto;border:1px solid #171320;background:#fffefb}input{min-width:0;padding:17px;border:0;background:transparent;font:inherit;font-size:17px;outline:0}button{padding:0 22px;border:0;border-left:1px solid #171320;background:#171320;color:white;font:700 14px inherit;cursor:pointer}button:hover{background:#c92791}.error{color:#9f271c;font-weight:700}.note{margin-top:16px;font-size:12px}.note a{text-decoration:underline}@media(max-width:520px){form{grid-template-columns:1fr}button{min-height:52px;border:0;border-top:1px solid #171320}}
</style></head><body><div class="bar">AWS?&nbsp; re:<b>AI</b>nvent</div><main class="wrap"><h1>The catalog has entered witness protection.</h1><p>This preview is temporarily private. Enter the password to inspect the evidence.</p>${failed ? '<p class="error">That was not the password. A bold guess, though.</p>' : ""}<form method="post" action="/__login?next=${encodeURIComponent(safeNext)}"><input name="password" type="password" autocomplete="current-password" aria-label="Password" placeholder="Password" autofocus required><button type="submit">Enter</button></form><p class="note">Unofficial catalog audit. Still not endorsed by AWS. Somehow.</p></main></body></html>`;
  return new Response(html, { status: failed ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow" } });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const secureCookie = url.protocol === "https:" ? "; Secure" : "";

    if (!env.SITE_PASSWORD) return new Response("Private preview is not configured.", { status: 503 });

    if (url.pathname === "/__logout") {
      return new Response(null, { status: 303, headers: { location: "/__login", "set-cookie": `${ACCESS_COOKIE}=; Path=/; Max-Age=0${secureCookie}; HttpOnly; SameSite=Lax` } });
    }

    if (url.pathname === "/__login") {
      const next = url.searchParams.get("next") || "/";
      if (request.method !== "POST") return loginPage(next);
      const form = await request.formData();
      const supplied = String(form.get("password") || "");
      const [actual, expected] = await Promise.all([authToken(supplied), authToken(env.SITE_PASSWORD)]);
      if (!equalTokens(actual, expected)) return loginPage(next, true);
      const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return new Response(null, { status: 303, headers: { location: destination, "set-cookie": `${ACCESS_COOKIE}=${expected}; Path=/; Max-Age=2592000${secureCookie}; HttpOnly; SameSite=Lax` } });
    }

    const expected = await authToken(env.SITE_PASSWORD);
    if (!equalTokens(cookieValue(request, ACCESS_COOKIE), expected)) {
      const next = `${url.pathname}${url.search}`;
      return new Response(null, { status: 302, headers: { location: `/__login?next=${encodeURIComponent(next)}`, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      const headers = new Headers(assetResponse.headers);
      headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("x-robots-tag", "noindex, nofollow");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

export default worker;
