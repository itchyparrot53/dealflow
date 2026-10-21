"use client";

import type React from "react";
import { API_DOC_PROSE, type ApiDocSection } from "../docSections";

// The Documentation tab. It renders the same serializable sections `pnpm api:docs` writes to
// docs/API.md, so the in-app copy and the repository file always match.

export function ApiDocs({ sections }: { sections: ApiDocSection[] }): React.ReactNode {
  return (
    <div data-testid="api-docs" className="space-y-6 text-sm">
      <p className="text-muted-foreground">{API_DOC_PROSE.intro}</p>

      <section className="space-y-1">
        <h2 className="text-base font-medium">Authentication</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {API_DOC_PROSE.auth.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="text-base font-medium">Scopes</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {API_DOC_PROSE.scopes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="text-base font-medium">Pagination</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {API_DOC_PROSE.pagination.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="text-base font-medium">Rate limits</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {API_DOC_PROSE.rateLimits.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-1">
        <h2 className="text-base font-medium">Errors</h2>
        {API_DOC_PROSE.errors.map((line) => (
          <p key={line} className="text-muted-foreground">
            {line}
          </p>
        ))}
      </section>

      {sections.map((section) => (
        <section key={section.resource} className="space-y-3">
          <h2 className="text-base font-medium">{section.title}</h2>
          {section.routes.map((route) => (
            <article
              key={`${route.method} ${route.path}`}
              className="space-y-2 rounded-lg border p-3"
            >
              <h3 className="font-mono text-sm">
                <span className="font-semibold">{route.method}</span> {route.path}
              </h3>
              <p className="text-muted-foreground">{route.summary}</p>
              <p className="text-xs text-muted-foreground">
                Scope: <code>{route.scope}</code>
              </p>
              {route.queryFields.length > 0 && (
                <p className="text-xs">
                  <span className="font-medium">Query:</span>{" "}
                  {route.queryFields.map((field) => (
                    <code key={field} className="mr-1 rounded bg-muted px-1 py-0.5">
                      {field}
                    </code>
                  ))}
                </p>
              )}
              {route.bodyFields.length > 0 && (
                <p className="text-xs">
                  <span className="font-medium">Body:</span>{" "}
                  {route.bodyFields.map((field) => (
                    <code key={field} className="mr-1 rounded bg-muted px-1 py-0.5">
                      {field}
                    </code>
                  ))}
                </p>
              )}
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(route.example, null, 2)}
              </pre>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                <code>{route.curl}</code>
              </pre>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
