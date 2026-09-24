"use client";
import { ClerkProvider, useClerk, useUser } from "@clerk/react";
import { createContext, useContext, useEffect, useState } from "react";
type Account = {
  user: { username: string } | null;
  ready: boolean;
  error: string;
  openAccount: () => void;
};
const AccountContext = createContext<Account>({
  user: null,
  ready: false,
  error: "",
  openAccount: () => {},
});
export const useAccount = () => useContext(AccountContext);
function ClerkAccount({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();
  return (
    <AccountContext.Provider
      value={{
        user: user
          ? {
              username:
                user.username ||
                user.firstName ||
                user.primaryEmailAddress?.emailAddress ||
                "Account",
            }
          : null,
        ready: isLoaded,
        error: "",
        openAccount: () => {
          if (user) clerk.openUserProfile();
          else clerk.openSignIn();
        },
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export default function ManagedAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/auth/config", { signal: abort.signal })
      .then(async (response) => {
        const config = await response.json();
        if (!response.ok)
          throw new Error(
            config.error || "Sign-in is temporarily unavailable.",
          );
        setKey(config.publishableKey);
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(error.message);
      });
    return () => abort.abort();
  }, []);
  if (!key)
    return (
      <AccountContext.Provider
        value={{ user: null, ready: false, error, openAccount: () => {} }}
      >
        {children}
      </AccountContext.Provider>
    );
  return (
    <ClerkProvider
      publishableKey={key}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        variables: { colorPrimary: "#203429", borderRadius: "8px" },
      }}
    >
      <ClerkAccount>{children}</ClerkAccount>
    </ClerkProvider>
  );
}
