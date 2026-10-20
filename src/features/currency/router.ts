import { db } from "@/db/client";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { listRates } from "./rates";
import { supportedCurrencyCodes } from "./schemas";

// Reads for the settings screens and every converted total. Any signed-in user
// may read rates (the board needs them); only permissions.manage may write.

const SIG = (): AbortSignal => AbortSignal.timeout(15_000);

export const currencyRouter = router({
  rates: protectedProcedure.query(async () => listRates(db, SIG())),
  // The full ISO list from Intl, so the client never ships a hardcoded catalog.
  codes: protectedProcedure.query(() => supportedCurrencyCodes()),
});
