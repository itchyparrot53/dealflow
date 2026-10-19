import { Client } from "pg";
import { env } from "@/config/env";
import { db } from "@/db/client";
import { createRelay } from "@/server/ws/relay";
import { startWsServer } from "@/server/ws/server";

// Bundled entrypoint for the compose `ws` service (esbuild -> dist/ws.js, run with plain
// node). The relay's pg Client is dedicated to LISTEN and is separate from the app pool.
//
// main() rather than top-level await: the e2e harness runs this file through tsx, and tsx treats a
// .ts file in a CommonJS package as CJS, where top-level await does not compile.
async function main(): Promise<void> {
  const listenClient = new Client({ connectionString: env.DATABASE_URL });
  await listenClient.connect();
  startWsServer(env.WS_PORT, { db, relay: createRelay(listenClient) });
  console.warn(`ws server listening on :${env.WS_PORT}`);
}

void main();
