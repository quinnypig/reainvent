import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import worker from "../dist/server/index.js";
const ctx = { waitUntil() {}, passThroughOnException() {} };
const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

test("serves the public marketplace without login or audit metadata", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env,
    ctx,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const html = await response.text();
  assert.match(html, /re:AInvent/);
  assert.match(html, /re:Invent session reservations/);
  assert.match(html, /THE CONFERENCE SEAT EXCHANGE/);
  assert.match(html, /Trading is not open/);
  assert.doesNotMatch(
    html,
    /Pangram|AI-writing signal|catalog audit|og-reainvent|\/data\.json/i,
  );
});

test("blocks audit data and images even if stale assets still exist", async () => {
  const staleEnv = {
    ASSETS: { fetch: async () => new Response("PRIVATE AUDIT") },
  };
  for (const path of [
    "/data.json",
    "/%64ata.json",
    "/og-reainvent-v3.png",
    "/og-reainvent.png",
    "/favicon.png",
    "/archive/catalog-private.json",
    "/state/missing.json",
    "/audit",
    "/tracker",
    "/_vinext/image?url=/data.json",
  ]) {
    const response = await worker.fetch(
      new Request(`http://localhost${path}`),
      staleEnv,
      ctx,
    );
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /PRIVATE AUDIT/);
  }
});

test("marketplace has no transaction endpoint", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/", { method: "POST", body: "bid=420" }),
    env,
    ctx,
  );
  assert.equal(response.status, 405);
});

test("public assets and client bundle contain no retired audit payload", async () => {
  for (const root of [
    new URL("../public/", import.meta.url),
    new URL("../dist/client/", import.meta.url),
  ]) {
    const files = await readdir(root, { recursive: true, withFileTypes: true });
    for (const file of files.filter((file) => file.isFile())) {
      assert.doesNotMatch(file.name, /data\.json|og-reainvent|catalog-private/);
      if (/\.(js|json|html|svg|css)$/.test(file.name)) {
        const content = await readFile(
          `${file.parentPath}/${file.name}`,
          "utf8",
        );
        assert.doesNotMatch(
          content,
          /Pangram|AI-writing signal|pangram\.ai/i,
          file.name,
        );
      }
    }
  }
});
