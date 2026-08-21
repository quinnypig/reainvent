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
:root{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:white;background:#130525}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;grid-template-rows:82px 1fr;overflow-x:hidden;overflow-y:auto;background:radial-gradient(circle at 4% 108%,#ffc43f,transparent 23%),radial-gradient(circle at 96% 105%,#34cef1,transparent 28%),linear-gradient(122deg,#a70a70 0%,#dc087f 34%,#712bd0 67%,#17105d 100%)}body:before{content:"";position:absolute;width:680px;height:680px;right:-190px;top:-260px;border:2px solid rgba(255,255,255,.55);border-radius:50%;box-shadow:0 0 0 84px rgba(255,219,103,.14),0 0 0 168px rgba(255,255,255,.1)}.bar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;background:#130525;color:white;border-bottom:1px solid rgba(255,255,255,.32);font-size:31px;font-weight:300;letter-spacing:-.055em}.bar b{color:#ff54cf;font-weight:690}.bar span{font:10px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.wrap{position:relative;z-index:2;width:min(680px,90vw);margin:auto;padding:54px 0 12vh}p{max-width:580px;font-size:18px;line-height:1.5;color:#f0e8f7}h1{max-width:660px;margin:0 0 22px;color:white;font-size:clamp(48px,8vw,82px);font-weight:430;line-height:.92;letter-spacing:-.06em}form{margin-top:38px;display:grid;grid-template-columns:1fr auto;border:1px solid white;background:white;box-shadow:8px 8px 0 rgba(19,5,37,.38)}input{min-width:0;padding:18px;border:0;background:transparent;color:#160d28;font:inherit;font-size:17px;outline:0}input:focus-visible{outline:3px solid #ff9900;outline-offset:-3px}button{padding:0 24px;border:0;border-left:1px solid #160d28;background:#160d28;color:white;font:700 14px inherit;cursor:pointer}button:hover{background:#7a2dde}button:focus-visible{outline:3px solid #ff9900;outline-offset:3px}.error{width:fit-content;padding:8px 10px;background:#ffe06b;color:#5b162a;font-weight:700}.note{margin-top:19px;color:#e2d4ed;font:11px ui-monospace,monospace}.note a{text-decoration:underline}@media(max-width:520px){body{grid-template-rows:72px 1fr}.bar{padding:0 20px;font-size:26px}.bar span{max-width:110px;text-align:right;font-size:8px;line-height:1.4}.wrap{padding-top:30px}form{grid-template-columns:1fr}button{min-height:52px;border:0;border-top:1px solid #160d28}}
</style></head><body><div class="bar"><div>AWS?&nbsp; re:<b>AI</b>nvent</div><span>Nov 30—Dec 4 · Las Vegas</span></div><main class="wrap"><h1>The catalog has entered witness protection.</h1><p>This preview is temporarily private. Enter the password to inspect the evidence.</p>${failed ? '<p class="error">That was not the password. A bold guess, though.</p>' : ""}<form method="post" action="/__login?next=${encodeURIComponent(safeNext)}"><input name="password" type="password" autocomplete="current-password" aria-label="Password" placeholder="Password" autofocus required><button type="submit">Enter</button></form><p class="note">Unofficial catalog audit. Still not endorsed by AWS. Somehow.</p></main></body></html>`;
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
      if (url.pathname === "/" || url.pathname === "/data.json" || url.pathname.endsWith(".html")) headers.set("cache-control", "no-store");
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
    if (headers.get("content-type")?.includes("text/html")) headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

export default worker;
