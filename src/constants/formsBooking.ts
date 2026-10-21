// Part 6 public forms and booking pages. Values are contract constants (PLAN-PART6 section 6.1),
// so a tuning change is a deliberate edit here rather than a literal at a call site.
export const FORM_MIN_FILL_MS = 2000;
export const FORM_TOKEN_MAX_AGE_MS = 86_400_000;

export const FORM_SUBMIT_PER_MINUTE = 10;
export const BOOKING_SLOTS_PER_MINUTE = 60;
export const BOOKING_BOOK_PER_MINUTE = 10;

export const FORM_MAX_FIELDS = 15;
export const FORM_FIELD_MAX_CHARS = 2000;
export const FORM_BODY_MAX_BYTES = 65_536;

export const SLOT_RANGE_MAX_DAYS = 14;
export const BOOKING_DEFAULT_DURATION = 30;
