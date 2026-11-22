import { calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";

// Prints a new ES256 private key as one line of JSON (a JWK), ready for
// JWT_PRIVATE_KEY. Run with `pnpm exec tsx scripts/generate-signing-key.ts`.

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = await exportJWK(privateKey);

// The key id: a hash of the public part (RFC 7638), the same on every machine.
const kid = await calculateJwkThumbprint(jwk);

console.log(JSON.stringify({ ...jwk, kid, alg: "ES256", use: "sig" }));
