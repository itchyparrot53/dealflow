"use client";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface PageTitleValue {
  title: string;
  info?: string;
}

interface PageTitleContextValue extends PageTitleValue {
  setTitle: (next: PageTitleValue) => void;
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

// Pipedrive puts the page title in the top bar, not the content. A page publishes its title here
// and the shell renders it; the provider sits once in the app layout.
export function PageTitleProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [value, setValue] = useState<PageTitleValue>({ title: "" });
  const setTitle = useCallback((next: PageTitleValue) => setValue(next), []);
  const contextValue = useMemo(() => ({ ...value, setTitle }), [value, setTitle]);
  return <PageTitleContext.Provider value={contextValue}>{children}</PageTitleContext.Provider>;
}

// The top bar's read. Public routes render outside the provider, where there is no app title.
export function usePageTitleValue(): PageTitleValue {
  const context = useContext(PageTitleContext);
  return context ?? { title: "" };
}

// Called by an app page's client root (or by <PageTitle> below for a server page).
export function usePageTitle(title: string, opts?: { info?: string }): void {
  const context = useContext(PageTitleContext);
  const setTitle = context?.setTitle;
  const info = opts?.info;
  useEffect(() => {
    if (setTitle === undefined) return;
    setTitle(info === undefined ? { title } : { title, info });
  }, [setTitle, title, info]);
}

// Server pages cannot call the hook, so they render this client marker instead.
export function PageTitle({ title, info }: { title: string; info?: string }): null {
  usePageTitle(title, info === undefined ? undefined : { info });
  return null;
}
