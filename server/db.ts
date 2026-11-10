import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrlEnvironmentKeys = [
  "CUSTOM_DATABASE_URL",
  "EXTERNAL_DATABASE_URL",
  "NEON_DATABASE_URL",
  "DATABASE_URL",
] as const;

export const databaseUrlEnvironmentKey = databaseUrlEnvironmentKeys.find(
  (key) => Boolean(process.env[key]),
) ?? null;

const rawConnectionString = databaseUrlEnvironmentKey
  ? process.env[databaseUrlEnvironmentKey]
  : undefined;
export const hasDatabaseUrl = Boolean(rawConnectionString);

if (!rawConnectionString) {
  console.warn(JSON.stringify({
    level: "warn",
    component: "database",
    event: "connection_url_missing",
    acceptedEnvironmentKeys: databaseUrlEnvironmentKeys,
  }));
}

// Strip parameters unsupported by node-postgres (e.g. channel_binding)
// so the driver doesn't reject the connection string.
function sanitizeConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return url;
  }
}

const connectionString = rawConnectionString
  ? sanitizeConnectionString(rawConnectionString)
  : undefined;

type GlobalWithDatabasePool = typeof globalThis & {
  __dynamicCoachingPgPool?: pg.Pool;
};
const globalWithPool = globalThis as GlobalWithDatabasePool;
const isServerless = process.env.VERCEL === "1"
  || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

function getPool(): pg.Pool {
  if (!globalWithPool.__dynamicCoachingPgPool) {
    const pool = new Pool({
      connectionString: connectionString ?? "",
      ssl: { rejectUnauthorized: false },
      // Reuse one client per warm serverless instance; use a larger pool for
      // the long-running Replit server.
      max: isServerless ? 1 : 5,
      allowExitOnIdle: isServerless,
      connectionTimeoutMillis: isServerless ? 10_000 : 15_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 20_000,        // kill runaway queries after 20 s
      // TCP keep-alive: prevents silent connection drops on long-idle ISP links
      // (Robi/Teletalk NAT tables can silently discard idle TCP flows after ~60 s).
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });

    pool.on("error", (err) => {
      const databaseError = err as Error & { code?: string };
      console.error(JSON.stringify({
        level: "error",
        component: "database",
        event: "idle_client_error",
        code: databaseError.code ?? null,
        message: databaseError.message,
      }));
    });
    globalWithPool.__dynamicCoachingPgPool = pool;
  }
  return globalWithPool.__dynamicCoachingPgPool;
}

export const pool = getPool();
export const db = drizzle(pool, { schema });
