import { createClient } from "@libsql/client";

const url = (import.meta.env.VITE_TURSO_URL as string || "").trim();
const authToken = (import.meta.env.VITE_TURSO_AUTH_TOKEN as string || "").trim();

// In development, error if missing but allow app to load for config setup
if (!url || !authToken) {
    console.warn("Turso credentials missing. Please set VITE_TURSO_URL and VITE_TURSO_AUTH_TOKEN in .env");
}

export const turso = createClient({
    url: url,
    authToken: authToken,
});
