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

type GlobalWithDatabasePool = typeof globalThis & {
  __dynamicCoachingPgPool?: pg.Pool;
  __dynamicCoachingDrizzle?: ReturnType<typeof drizzle>;
};
const globalWithPool = globalThis as GlobalWithDatabasePool;
const isServerless = process.env.VERCEL === "1"
  || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

export function getPool(): pg.Pool {
  if (!globalWithPool.__dynamicCoachingPgPool) {
    try {
      if (!rawConnectionString) {
        throw new Error(
          `No database URL configured. Set one of: ${databaseUrlEnvironmentKeys.join(", ")}`,
        );
      }
      const connectionString = rawConnectionString
        ? sanitizeConnectionString(rawConnectionString)
        : undefined;
      const pool = new Pool({
        connectionString: connectionString ?? "",
        ssl: { rejectUnauthorized: false },
        // Reuse one client per warm serverless instance; use a larger pool for
        // the long-running Replit server.
        max: isServerless ? 1 : 5,
        allowExitOnIdle: isServerless,
        connectionTimeoutMillis: isServerless ? 10_000 : 15_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 20_000,
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
        console.error(err);
      });
      globalWithPool.__dynamicCoachingPgPool = pool;
    } catch (error) {
      console.error("[DB] Pool initialization failed:", error);
      throw error;
    }
  }
  return globalWithPool.__dynamicCoachingPgPool;
}

// connect-pg-simple stores this object in its constructor without querying it.
// Resolve the real Pool only when a session operation actually needs a query.
export const lazyPool = new Proxy({} as pg.Pool, {
  get(_target, property) {
    const pool = getPool();
    const value = Reflect.get(pool, property, pool);
    return typeof value === "function" ? value.bind(pool) : value;
  },
});

function getDatabase(): ReturnType<typeof drizzle> {
  if (!globalWithPool.__dynamicCoachingDrizzle) {
    globalWithPool.__dynamicCoachingDrizzle = drizzle(getPool(), { schema });
  }
  return globalWithPool.__dynamicCoachingDrizzle;
}

// Export a Drizzle-shaped lazy facade so importing route modules doesn't create
// a Pool or Drizzle client during Vercel's module-loading phase.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    const database = getDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
