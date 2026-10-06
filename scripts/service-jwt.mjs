// Prints an HS256 JWT with role=service_role, the shape of a Supabase service role key.
import { createHmac } from "node:crypto";

const secret = process.argv[2];
if (!secret) throw new Error("usage: node scripts/service-jwt.mjs <jwt-secret>");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({ role: "service_role", iss: "qa-joo-local", iat: Math.floor(Date.now() / 1000) });
const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
console.log(`${header}.${payload}.${signature}`);
