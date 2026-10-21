import { activitiesRouter } from "@/features/activities/router";
import { aiRouter } from "@/features/ai/router";
import { automationsRouter } from "@/features/automations/router";
import { collaborationRouter } from "@/features/collaboration/router";
import { contactsRouter } from "@/features/contacts/router";
import { currencyRouter } from "@/features/currency/router";
import { customFieldsRouter } from "@/features/custom-fields/router";
import { dealRouter } from "@/features/deals/dealRouter";
import { documentsRouter } from "@/features/documents/router";
import { mailLabelsRouter } from "@/features/email/mailLabelsRouter";
import { emailRouter } from "@/features/email/router";
import { enrichmentRouter } from "@/features/enrichment/router";
import { filesRouter } from "@/features/files/router";
import { forecastRouter } from "@/features/forecast/router";
import { formsRouter } from "@/features/forms/router";
import { goalsRouter } from "@/features/goals/router";
import { importRouter } from "@/features/import/router";
import { insightsRouter } from "@/features/insights/router";
import { labelsRouter } from "@/features/labels/router";
import { leadRouter } from "@/features/leads/leadRouter";
import { notificationsRouter } from "@/features/notifications/router";
import { oauthRouter } from "@/features/oauth/router";
import { pipelineRouter } from "@/features/pipelines/pipelineRouter";
import { productsRouter } from "@/features/products/router";
import { versionRouter } from "@/features/release/router";
import { savedFiltersRouter } from "@/features/saved-filters/router";
import { schedulingRouter } from "@/features/scheduling/router";
import { searchRouter } from "@/features/search/router";
import { statsRouter } from "@/features/stats/router";
import { webhooksRouter } from "@/features/webhooks/router";
import { identityRouter } from "./routers/identity";
import { realtimeRouter } from "./routers/realtime";
import { router } from "./trpc";

export const appRouter = router({
  identity: identityRouter,
  ai: aiRouter,
  realtime: realtimeRouter,
  pipeline: pipelineRouter,
  products: productsRouter,
  deal: dealRouter,
  contacts: contactsRouter,
  currency: currencyRouter,
  documents: documentsRouter,
  automations: automationsRouter,
  forms: formsRouter,
  insights: insightsRouter,
  scheduling: schedulingRouter,
  webhooks: webhooksRouter,
  customFields: customFieldsRouter,
  collaboration: collaborationRouter,
  activities: activitiesRouter,
  import: importRouter,
  labels: labelsRouter,
  mailLabels: mailLabelsRouter,
  lead: leadRouter,
  email: emailRouter,
  enrichment: enrichmentRouter,
  files: filesRouter,
  forecast: forecastRouter,
  goals: goalsRouter,
  notifications: notificationsRouter,
  oauth: oauthRouter,
  savedFilters: savedFiltersRouter,
  search: searchRouter,
  stats: statsRouter,
  version: versionRouter,
});

export type AppRouter = typeof appRouter;

// Server-side caller factory: pass a fully-formed AppContext to call procedures
// without going through the HTTP layer. Used by server components for SSR prefetch.
export const createCaller = appRouter.createCaller;
