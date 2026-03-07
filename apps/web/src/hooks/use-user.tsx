"use client";

import { createContext, useContext } from "react";

type UserContextValue = {
  email?: string;
  displayName?: string;
};

export const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: UserContextValue | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  const user = useContext(UserContext);
  return {
    email: user?.email,
    displayName: user?.displayName ?? user?.email?.split("@")[0] ?? "there",
  };
}
