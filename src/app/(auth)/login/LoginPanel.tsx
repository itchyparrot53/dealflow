"use client";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { PILL_TAB, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AUTH_STRINGS } from "@/constants/authStrings";
import type { AuthMethods } from "@/features/auth/authMethods";
import { cn } from "@/lib/utils";

interface LoginPanelProps {
  methods: AuthMethods;
  error: string | null;
  sent: boolean;
  method: string | null;
  next: string;
}

type TabValue = "password" | "link";

// The sign-in card's interactive half. Server-rendered pages pass the enabled methods and the
// query-string state; this component only picks the initial tab and renders the plain HTML forms.
export function LoginPanel({
  methods,
  error,
  sent,
  method,
  next,
}: LoginPanelProps): React.ReactNode {
  const enabled: TabValue[] = [];
  if (methods.password) enabled.push("password");
  if (methods.magicLink) enabled.push("link");
  const initial: TabValue =
    method === "link" && methods.magicLink
      ? "link"
      : method === "password" && methods.password
        ? "password"
        : (enabled[0] ?? "password");
  const [tab, setTab] = useState<TabValue>(initial);

  const errorText = error === null ? undefined : AUTH_STRINGS.errors[error];

  return (
    <div className="mt-6 space-y-4">
      {errorText !== undefined && (
        <p data-testid="login-error" className="text-sm text-destructive">
          {errorText}
        </p>
      )}
      {sent && (
        <p data-testid="login-sent" className="text-sm text-muted-foreground">
          {AUTH_STRINGS.sentNotice}
        </p>
      )}

      {enabled.length > 0 && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
          <TabsList className="w-full justify-start gap-1 rounded-md bg-muted/50 p-1">
            {methods.password && (
              <TabsTrigger value="password" className={PILL_TAB}>
                {AUTH_STRINGS.tabPassword}
              </TabsTrigger>
            )}
            {methods.magicLink && (
              <TabsTrigger value="link" className={PILL_TAB}>
                {AUTH_STRINGS.tabLink}
              </TabsTrigger>
            )}
          </TabsList>

          {methods.password && (
            <TabsContent value="password">
              <form method="post" action="/auth/password" className="space-y-3">
                <input type="hidden" name="next" value={next} />
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">{AUTH_STRINGS.emailLabel}</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">{AUTH_STRINGS.passwordLabel}</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {AUTH_STRINGS.signIn}
                </Button>
              </form>
            </TabsContent>
          )}

          {methods.magicLink && (
            <TabsContent value="link">
              <form method="post" action="/auth/magic-link" className="space-y-3">
                <input type="hidden" name="next" value={next} />
                <div className="space-y-1.5">
                  <Label htmlFor="link-email">{AUTH_STRINGS.emailLabel}</Label>
                  <Input id="link-email" name="email" type="email" autoComplete="email" required />
                </div>
                <Button type="submit" className="w-full">
                  {AUTH_STRINGS.emailMeLink}
                </Button>
              </form>
            </TabsContent>
          )}
        </Tabs>
      )}

      {methods.google && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {AUTH_STRINGS.orDivider}
            <span className="h-px flex-1 bg-border" />
          </div>
          <a
            href={`/auth/start?next=${encodeURIComponent(next)}`}
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            {AUTH_STRINGS.google}
          </a>
        </div>
      )}
    </div>
  );
}
