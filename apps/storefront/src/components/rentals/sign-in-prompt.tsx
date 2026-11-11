import { Button } from "@async-rent/ui/components/button";
import { SignInButton, useClerk } from "@clerk/tanstack-react-start";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { ReturnMessage } from "../checkout/payment-return";

interface SignInPromptProps {
  title: string;
  children: string;
}

/**
 * A page that needs an account, seen while signed out. Opens Clerk's sign-in
 * once on arrival and keeps a button for when it is closed. Signing in, or
 * signing up, lands back on this very page.
 */
export function SignInPrompt({ title, children }: SignInPromptProps) {
  const clerk = useClerk();
  const href = useRouterState({ select: (state) => state.location.href });
  const opened = useRef(false);

  useEffect(() => {
    if (!clerk.loaded || opened.current) return;
    opened.current = true;
    clerk.openSignIn({ forceRedirectUrl: href, signUpForceRedirectUrl: href });
  }, [clerk, clerk.loaded, href]);

  return (
    <ReturnMessage
      title={title}
      actions={
        <SignInButton mode="modal" forceRedirectUrl={href} signUpForceRedirectUrl={href}>
          <Button>Sign in</Button>
        </SignInButton>
      }
    >
      {children}
    </ReturnMessage>
  );
}
