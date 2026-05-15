import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { pool } from "../db";
import { type User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

type PublicUser = Omit<SelectUser, "password">;

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
  const fallbackSecret =
    (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "").slice(-40) ||
    "dcc-fallback-please-set-SESSION-SECRET-in-vercel";

  if (!envSecret) {
    console.warn(
      "[Auth] SESSION_SECRET is not set. Using a fallback derived from DATABASE_URL. " +
      "Please add SESSION_SECRET to your Vercel environment variables for production security."
    );
  }

  const sessionSecret = envSecret || fallbackSecret;

  // Build the session store — try PostgreSQL first, fall back to in-memory so
  // the server never crashes just because the DB is slow on cold start.
  let store: session.Store | undefined;
  try {
    store = new PgStore({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    });
    console.log("[Auth] PostgreSQL session store initialised.");
  } catch (storeErr) {
    console.error("[Auth] PgStore init failed — falling back to MemoryStore:", storeErr);
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

  app.post("/api/login", (req, res, next) => {
    passport.authenticate(
      "local",
      (err: any, user: Express.User | false, info: { message: string } | undefined) => {
        if (err) {
          console.error("[Auth] Login error:", err);
          return res
            .status(500)
            .json({ message: "A server error occurred. Please try again." });
        }
        if (!user) {
          return res
            .status(401)
            .json({ message: info?.message ?? "Invalid username or password" });
        }
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error("[Auth] Session save error:", loginErr);
            return res
              .status(500)
              .json({ message: "Login succeeded but session could not be saved." });
          }
          return res.json(toPublicUser(user));
        });
      }
    )(req, res, next);
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
