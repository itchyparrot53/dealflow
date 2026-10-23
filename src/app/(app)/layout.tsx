import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ActionErrorProvider } from "@/components/shell/ActionErrorProvider";
import { CsrfRefresher } from "@/components/shell/CsrfRefresher";
import { LeftNav } from "@/components/shell/LeftNav";
import { PageTitleProvider } from "@/components/shell/pageTitle";
import { ReconnectBanner } from "@/components/shell/ReconnectBanner";
import { normalizeRailState, RAIL_COOKIE } from "@/components/shell/railState";
import { TopBar } from "@/components/shell/TopBar";
import { Toaster } from "@/components/ui/toaster";
import { env } from "@/config/env";
import { db } from "@/db/client";
import { FollowUpPromptProvider } from "@/features/activities/followUpAfterDone";
import { CSRF_COOKIE } from "@/features/auth/csrf";
import { CreateDialogProvider } from "@/features/create/CreateDialogProvider";
import { InterfacePrefsProvider } from "@/features/identity/InterfacePrefsProvider";
import { interfacePrefsFromUi } from "@/features/identity/interfacePrefs";
import { getPreferencesForActor } from "@/features/identity/preferencesForActor";
import { BottomNav } from "@/features/navigation/mobile/BottomNav";
import { IdentifyUser } from "@/features/observability/IdentifyUser";
import { OfflineBanner } from "@/features/pwa/OfflineBanner";
import { OfflineUserSync } from "@/features/pwa/offline/remember";
import { ServiceWorkerRegistration } from "@/features/pwa/register";
import { VersionBanner } from "@/features/release/ui/VersionBanner";
import { CommandPalette } from "@/features/search/ui/CommandPalette";
import { GlobalShortcuts } from "@/features/shortcuts/GlobalShortcuts";
import { appearanceSeedScript, parseAppearance } from "@/features/theme/appearance";
import { createContext } from "@/server/trpc/context";

export default async function AppLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const ctx = await createContext();
  if (ctx.actor === null) redirect("/login");
  const jar = await cookies();
  const hasCsrf = jar.get(CSRF_COOKIE) !== undefined;
  // The avatar name + photo now ride along on the hydrated actor (createContext already read the
  // user row), so the shell no longer re-reads that row per authenticated page. Only the per-user
  // interface preferences remain; default comfortable when no row exists (DealCard/Board read the
  // density via the data-density attribute).
  const prefs = await getPreferencesForActor(db, ctx.actor.id);
  // 6.4: read on the server so the rail's width is right on the first paint (no layout shift).
  const rail = normalizeRailState(jar.get(RAIL_COOKIE)?.value);
  return (
    <ActionErrorProvider>
      <IdentifyUser
        user={{
          id: ctx.actor.id,
          name: ctx.actor.name,
          email: ctx.actor.email,
          role: ctx.actor.type,
        }}
      />
      {/* Reconciles this device's theme cookie with the account's stored choice, inline and ahead
          of the shell, so a cold browser never paints a frame of the wrong theme. */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: three known literals; must be inline to beat first paint
        dangerouslySetInnerHTML={{
          __html: appearanceSeedScript(parseAppearance(prefs.ui.appearance)),
        }}
      />
      <InterfacePrefsProvider value={interfacePrefsFromUi(prefs.ui)}>
        <FollowUpPromptProvider>
          <PageTitleProvider>
            <CreateDialogProvider>
              <div data-density={prefs.density} className="flex h-dvh flex-col">
                {/* First tab stop, so a keyboard user can jump the rail and top bar instead of
                    tabbing through every destination on each page. */}
                <a
                  href="#main"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Skip to content
                </a>
                <CsrfRefresher hasCsrf={hasCsrf} />
                {ctx.actor.type === "admin" && <VersionBanner />}
                <ReconnectBanner />
                <OfflineBanner />
                <div className="flex min-h-0 flex-1">
                  {/* The rail runs the full viewport height, beside the top bar (Pipedrive). Below md
                      it is replaced by the bottom navigation (BottomNav). */}
                  <div className="hidden h-full md:block">
                    <LeftNav initialRail={rail} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <TopBar
                      userId={ctx.actor.id}
                      userName={ctx.actor.name}
                      avatarUrl={ctx.actor.avatarUrl}
                      appearance={parseAppearance(prefs.ui.appearance)}
                    />
                    <main
                      id="main"
                      tabIndex={-1}
                      className="min-w-0 flex-1 overflow-auto scroll-pb-24 bg-background p-4 pb-24 md:scroll-pb-0 md:pb-4"
                    >
                      {children}
                    </main>
                  </div>
                </div>
                <BottomNav />
                <CommandPalette actor={{ type: ctx.actor.type, flags: ctx.actor.flags }} />
                <OfflineUserSync userId={ctx.actor.id} />
                <GlobalShortcuts />
                <ServiceWorkerRegistration production={env.NODE_ENV === "production"} />
                <Toaster />
              </div>
            </CreateDialogProvider>
          </PageTitleProvider>
        </FollowUpPromptProvider>
      </InterfacePrefsProvider>
    </ActionErrorProvider>
  );
}
