// Copy for the documents feature. The error strings are the exact wording from
// Plan section 6.2; the screens and the public page both read them from here.

export const DOCUMENTS_STRINGS = {
  title: "Documents",
  intro:
    "Quote and invoice numbering, company details, payment instructions and the templates new documents start from.",
  adminOnly: "Only administrators can change document settings.",
  sessionExpired: "Your session expired. Sign in again.",
  save: "Save",
  saving: "Saving...",
  saved: "Saved",
  saveFailed: "Could not save the document settings.",
  invalid: "Check the fields and try again.",
  daysInvalid: "Enter a whole number between 1 and 365.",
  prefixInvalid: "Use 1 to 8 capital letters or digits.",

  numbering: "Numbering",
  numberingDescription:
    "Numbers are {prefix}-{year}-{sequence} and are assigned when a document is issued.",
  quotePrefix: "Quote prefix",
  invoicePrefix: "Invoice prefix",
  quoteValidDays: "Quote valid days",
  invoiceDueDays: "Invoice due days",

  company: "Company details",
  companyDescription: "Shown on every quote and invoice.",
  companyName: "Company name",
  companyAddress: "Address",
  companyTaxId: "Tax ID",

  payment: "Payment",
  paymentInstructions: "Payment instructions",
  paymentDescription: "Printed on invoices below the totals.",
  footer: "Footer",

  templates: "Templates",
  templatesDescription: "Templates are rendered when a draft is created.",
  quotes: "Quote templates",
  invoices: "Invoice templates",
  newTemplate: "New template",
  editTemplate: "Edit template",
  templateName: "Name",
  templateBody: "Body",
  templateTerms: "Terms",
  includeProducts: "Include products",
  defaultBadge: "Default",
  setDefault: "Set default",
  edit: "Edit",
  delete: "Delete",
  deleteTitle: "Delete this template?",
  deleteDescription: "Each kind keeps at least one template.",
  deleteConfirm: "Delete",
  cancel: "Cancel",
  preview: "Preview",
  variables: "Variables",
  variablesHelp: "Type a variable in double braces, for example {{deal.title}}.",
  templateNotFound: "That template no longer exists.",
  lastTemplate: "Each kind needs at least one template.",
  templatesEmpty: "No templates yet.",

  // The exact 6.2 user copy, keyed by cause.
  errors: {
    notFound: "That document no longer exists.",
    immutable: "Issued documents can't be edited. Duplicate it to make changes.",
    transition: (status: string) => `This action isn't available for a ${status} document.`,
    expired: "This quote has expired.",
    noCustomerEmail: "Add an email address for the customer first.",
    noMailbox: "Connect your mailbox in Settings → Email sync, or copy the link and mark it sent.",
    overpayment: "That payment is more than the amount still due.",
    invoiceDelete: "Issued invoices can't be deleted. Void it instead.",
    templateNotFound: "That template no longer exists.",
    rateLimited: "Too many requests. Try again in a minute.",
    invalid: "Check the fields and try again.",
    lastTemplate: "Each kind needs at least one template.",
  },
} as const;

// Variables the templates may use (Plan section 6.5). The dialog lists these so
// an author does not have to remember the exact spelling.
export const DOCUMENT_VARIABLE_KEYS = [
  "deal.title",
  "deal.value",
  "person.name",
  "person.first_name",
  "organization.name",
  "owner.name",
  "owner.email",
  "company.name",
  "document.title",
  "document.number",
  "document.total",
  "document.valid_until",
  "document.due_date",
  "document.issue_date",
] as const;
