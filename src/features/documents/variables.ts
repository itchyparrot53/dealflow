// Template variables are flat "group.key" strings. Rendering happens in two
// passes: creation substitutes everything except document.* (whose values can
// still change until issue), and the display pass fills document.* in.

export type VarContext = Record<string, string>;

const VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;
// The products marker is a block in markdownLite, never a variable.
const PRODUCTS_KEY = "products";

export function renderVariables(
  src: string,
  ctx: VarContext,
  opts: { keepPrefix?: string } = {},
): string {
  return src.replace(VARIABLE, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (key === PRODUCTS_KEY) return match;
    if (opts.keepPrefix !== undefined && key.startsWith(opts.keepPrefix)) return match;
    return ctx[key] ?? "";
  });
}
