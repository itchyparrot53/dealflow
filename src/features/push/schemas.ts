import { z } from "zod";
import { NOTIFICATION_TYPES } from "@/constants/notificationTypes";

// Input shapes only. Protocol checks (https, non-empty keys) live in the service so a bad
// subscription returns E_PUSH_002 while malformed JSON returns E_PUSH_004.
export const pushSubscribeInput = z.object({
  endpoint: z.string().max(2048),
  keys: z.object({
    p256dh: z.string().max(512),
    auth: z.string().max(512),
  }),
  userAgent: z.string().max(300).nullish(),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeInput>;

export const pushPrefInput = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  enabled: z.boolean(),
});

export type PushPrefInput = z.infer<typeof pushPrefInput>;

export const pushUnsubscribeInput = z.object({
  endpoint: z.string().min(1).max(2048),
});
