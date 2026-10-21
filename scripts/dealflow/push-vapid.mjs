import webpush from "web-push";

// Prints a VAPID key pair for the owner to paste into .env. It deliberately writes nothing:
// .env is only ever changed by scripts/dealflow/env-sync.mjs, which only appends missing keys.
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
