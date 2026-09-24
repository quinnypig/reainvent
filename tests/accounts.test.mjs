import assert from "node:assert/strict";
import test from "node:test";
import { accountRequest } from "../worker/accounts.mjs";
const env = {
  CLERK_PUBLISHABLE_KEY: "pk_test_example",
  CLERK_SECRET_KEY: "secret-never-expose",
};
const req = (path) => new Request(`https://reainvent.com${path}`);
test("public auth configuration exposes only publishable key, and fails closed without secrets", async () => {
  const response = await accountRequest(req("/api/auth/config"), env);
  assert.deepEqual(await response.json(), {
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await accountRequest(req("/api/auth/config"), {})).status, 503);
  assert.equal((await accountRequest(req("/api/account"), {})).status, 503);
});
test("legacy password endpoints are retired", async () => {
  for (const action of ["signup", "login", "delete", "logout", "reset"]) {
    const response = await accountRequest(
      new Request(`https://reainvent.com/api/account/${action}`, {
        method: "POST",
      }),
      env,
    );
    assert.equal(response.status, 410);
  }
});
test("account reads require Clerk session verification with the expected origin", async () => {
  let called = false;
  const createClient = (options) => {
    assert.equal(options.secretKey, env.CLERK_SECRET_KEY);
    return {
      authenticateRequest: async (request, opts) => {
        called = true;
        assert.equal(request.url, "https://reainvent.com/api/account");
        assert.deepEqual(opts.authorizedParties, ["https://reainvent.com"]);
        assert.equal(opts.acceptsToken, "session_token");
        return {
          isAuthenticated: true,
          toAuth: () => ({ userId: "user_123" }),
        };
      },
    };
  };
  const response = await accountRequest(req("/api/account"), env, createClient);
  assert.equal(called, true);
  assert.deepEqual(await response.json(), { user: { id: "user_123" } });
  const signedOut = await accountRequest(req("/api/account"), env, () => ({
    authenticateRequest: async () => ({ isAuthenticated: false }),
  }));
  assert.deepEqual(await signedOut.json(), { user: null });
});
