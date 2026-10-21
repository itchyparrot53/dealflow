import { FORM_FIELD_MAX_CHARS } from "./formsBooking";

// User-facing copy for Part 6 (PLAN-PART6 section 6.2). Kept out of the services so the same
// sentence reaches the route response, the inline form error and the UI.
export const FORM_COPY = {
  unavailable: "This form is not available.",
  invalidSubmission: "Please check the highlighted fields.",
  rateLimited: "Too many submissions. Try again in a minute.",
  thanks: "Thanks, we will be in touch.",
} as const;

export const BOOKING_COPY = {
  unavailable: "This booking page is not available.",
  slotTaken: "That time is no longer available. Please pick another.",
  rateLimited: "Too many requests. Try again in a minute.",
  cancelInvalid: "This booking was already cancelled or the link is invalid.",
} as const;

export const FIELD_ERRORS = {
  required: "This field is required.",
  tooLong: `Please use ${FORM_FIELD_MAX_CHARS} characters or fewer.`,
  email: "Enter a valid email address.",
  number: "Enter a number.",
  date: "Enter a date as YYYY-MM-DD.",
  option: "Choose one of the listed options.",
  unavailable: "This field is no longer available.",
} as const;
