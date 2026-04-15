import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Prefer NEON_DATABASE_URL (shared across Replit + Vercel) over the
// runtime-managed Replit DATABASE_URL so both deployments hit the same DB.
const rawConnectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!rawConnectionString) {
  console.warn(
    "[DB] WARNING: No database URL found. " +
      "Set NEON_DATABASE_URL in your environment variables."
  );
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

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: connectionString ?? "",
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    _pool.on("error", (err) => {
      console.error("[DB] Pool error:", err.message);
    });
  }
  return _pool;
}

export const pool = getPool();
export const db = drizzle(pool, { schema });
