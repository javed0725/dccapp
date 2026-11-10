import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express, type Request } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { getPool } from "../db";
import { type User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

type PublicUser = Omit<SelectUser, "password">;

function logAuthError(event: string, error: unknown, req?: Request) {
  const err = error instanceof Error ? error : new Error(String(error));
  const details = error && typeof error === "object"
    ? error as { code?: unknown }
    : {};
  console.error(err);
  console.error(JSON.stringify({
    level: "error",
    component: "auth",
    event,
    requestId: req?.get("x-vercel-id") || req?.get("x-request-id") || null,
    error: {
      name: err.name,
      code: typeof details.code === "string" ? details.code : null,
      message: err.message,
      stack: err.stack,
    },
  }));
}

function toPublicUser(user: SelectUser): PublicUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  const PgStore = connectPgSimple(session);
  // Use SESSION_SECRET from env if available.
  // Fall back to a stable substring of DATABASE_URL so the app doesn't crash
  // when SESSION_SECRET hasn't been set in Vercel yet. Sessions will still
  // work; the only downside is they're less cryptographically random.
  // ACTION REQUIRED: set SESSION_SECRET in your Vercel project environment variables.
  const envSecret = process.env.SESSION_SECRET;
  const databaseUrl = process.env.CUSTOM_DATABASE_URL
    || process.env.EXTERNAL_DATABASE_URL
    || process.env.NEON_DATABASE_URL
    || process.env.DATABASE_URL
    || "";
  const fallbackSecret =
    databaseUrl.slice(-40) ||
    "dcc-fallback-please-set-SESSION-SECRET-in-vercel";

  if (!envSecret) {
    console.warn(JSON.stringify({
      level: "warn",
      component: "auth",
      event: "session_secret_missing",
      environmentKey: "SESSION_SECRET",
      message: "Set SESSION_SECRET in the Vercel project environment for stable, secure sessions.",
    }));
  }

  const sessionSecret = envSecret || fallbackSecret;

  // Build the session store — try PostgreSQL first, fall back to in-memory so
  // the server never crashes just because the DB is slow on cold start.
  let store: session.Store | undefined;
  try {
    store = new PgStore({
      pool: getPool(),
      tableName: "user_sessions",
      createTableIfMissing: true,
    });
    console.log("[Auth] PostgreSQL session store initialised.");
  } catch (storeErr) {
    console.error("[Auth] PostgreSQL session store initialization failed:", storeErr);
    logAuthError("session_store_initialization_failed", storeErr);
    if (process.env.VERCEL === "1") {
      throw storeErr;
    }
    store = undefined; // express-session uses MemoryStore when store is omitted
  }

  const sessionSettings: session.SessionOptions = {
    ...(store ? { store } : {}),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  (async () => {
    try {
      const admin = await storage.getUserByUsername("dynamic");
      if (!admin) {
        const hashedPassword = await bcrypt.hash("dcc2020", 10);
        await storage.createUser({
          username: "dynamic",
          password: hashedPassword,
          role: "admin",
        });
        console.log("[Auth] Default admin created");
      }
    } catch (err) {
      console.error("[Auth] Could not ensure default admin:", err);
    }
  })();

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        let user = await storage.getUserByUsername(username);

        if (!user) {
          // Try Student ID
          const allStudents = await storage.getStudents();
          const student = allStudents.find((s: any) => s.studentCustomId === username);
          if (student && student.userId) {
            user = await storage.getUser(student.userId);
          }

          // Try Teacher ID
          if (!user) {
            const allUsers = await storage.getUsers();
            user = allUsers.find((u: any) => u.teacherId === username);
          }

          if (!user) {
            return done(null, false, { message: "Invalid username or password" });
          }
        }

        const isMatch =
          password === user.password ||
          (await bcrypt.compare(password, user.password));

        if (!isMatch) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? null);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const { user, info } = await new Promise<{
        user: Express.User | false;
        info?: { message?: string };
      }>((resolve, reject) => {
        passport.authenticate(
          "local",
          (authErr: unknown, authenticatedUser: Express.User | false, authInfo?: { message?: string }) => {
            if (authErr) {
              reject(authErr);
              return;
            }
            resolve({ user: authenticatedUser || false, info: authInfo });
          },
        )(req, res, next);
      });

      if (!user) {
        return res.status(401).json({
          message: info?.message ?? "Invalid username or password",
        });
      }

      await new Promise<void>((resolve, reject) => {
        req.login(user, (loginErr) => loginErr ? reject(loginErr) : resolve());
      });
      return res.json(toPublicUser(user));
    } catch (error) {
      logAuthError("login_failed", error, req);
      if (res.headersSent) return next(error);
      return res.status(500).json({
        message: "A server error occurred. Please try again.",
      });
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const user = await storage.createUser({ ...req.body, password: hashedPassword });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login after registration failed" });
        res.status(201).json(toPublicUser(user));
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Registration failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(toPublicUser(req.user));
  });
}
