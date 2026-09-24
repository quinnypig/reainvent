import { createClerkClient } from "@clerk/backend";
const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
export async function accountRequest(
  request,
  env = {},
  createClient = createClerkClient,
) {
  const path = new URL(request.url).pathname;
  if (request.method !== "GET")
    return json(
      {
        error:
          "Use the managed account menu to sign up, sign in, or manage your account.",
      },
      410,
    );
  const configured =
    /^pk_(live|test)_/.test(env.CLERK_PUBLISHABLE_KEY || "") &&
    Boolean(env.CLERK_SECRET_KEY);
  if (path === "/api/auth/config")
    return configured
      ? json({ publishableKey: env.CLERK_PUBLISHABLE_KEY })
      : json(
          { error: "Sign-in is being configured. Please check back shortly." },
          503,
        );
  if (path !== "/api/account") return json({ error: "Not found." }, 404);
  if (!configured)
    return json(
      { error: "Sign-in is being configured. Please check back shortly." },
      503,
    );
  const client = createClient({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });
  const state = await client.authenticateRequest(request, {
    authorizedParties: [
      "https://reainvent.com",
      ...(env.AUTH_DEV_ORIGIN ? [env.AUTH_DEV_ORIGIN] : []),
    ],
    acceptsToken: "session_token",
  });
  if (!state.isAuthenticated) return json({ user: null });
  const { userId } = state.toAuth();
  return json({ user: { id: userId } });
}
