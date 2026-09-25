"use client";

import { signIn as nextSignIn, signOut as nextSignOut, useSession } from "next-auth/react";

export function signIn(...args: Parameters<typeof nextSignIn>) {
  return nextSignIn(...args);
}

export function signOut(...args: Parameters<typeof nextSignOut>) {
  return nextSignOut(...args);
}

export { useSession };