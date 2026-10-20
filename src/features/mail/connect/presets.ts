import { MAIL_PRESETS, type MailPreset } from "@/constants/mail";

// Presets live in src/constants/mail.ts so the settings UI and the connect service share one
// definition; this module is the lookup the service uses.
export { MAIL_PRESETS };
export type MailPresetName = keyof typeof MAIL_PRESETS;

export function presetFor(name: MailPresetName): MailPreset {
  return MAIL_PRESETS[name];
}
