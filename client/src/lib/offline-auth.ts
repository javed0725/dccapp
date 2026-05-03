import bcrypt from "bcryptjs";
import { getAuthDB } from "./offline-db";
import type { User } from "./schemas";

export interface OfflineSession {
  username: string;
  passwordHash: string;
  user: User;
  savedAt: number;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function saveOfflineSession(
  username: string,
  password: string,
  user: User,
): Promise<void> {
  try {
    const db = await getAuthDB();
    // Cost 8 is fast enough for mobile while still being secure for local storage
    const passwordHash = await bcrypt.hash(password, 8);
    const session: OfflineSession = {
      username: username.toLowerCase().trim(),
      passwordHash,
      user,
      savedAt: Date.now(),
    };
    await db.put("session", session);
    // Remember who last logged in for auto-login
    localStorage.setItem("offline_last_user", username.toLowerCase().trim());
  } catch (err) {
    console.warn("[OfflineAuth] Could not save session:", err);
  }
}

export async function verifyOfflineCredentials(
  username: string,
  password: string,
): Promise<User | null> {
  try {
    const db = await getAuthDB();
    const session = await db.get("session", username.toLowerCase().trim());
    if (!session) return null;
    if (Date.now() - session.savedAt > SESSION_TTL_MS) return null;
    const match = await bcrypt.compare(password, session.passwordHash);
    if (!match) return null;
    return session.user;
  } catch (err) {
    console.warn("[OfflineAuth] Could not verify credentials:", err);
    return null;
  }
}

export async function getAutoLoginSession(): Promise<User | null> {
  try {
    const lastUser = localStorage.getItem("offline_last_user");
    if (!lastUser) return null;
    const db = await getAuthDB();
    const session = await db.get("session", lastUser);
    if (!session) return null;
    if (Date.now() - session.savedAt > SESSION_TTL_MS) return null;
    return session.user;
  } catch (err) {
    console.warn("[OfflineAuth] Could not get auto-login session:", err);
    return null;
  }
}

export async function clearOfflineSession(username: string): Promise<void> {
  try {
    const db = await getAuthDB();
    await db.delete("session", username.toLowerCase().trim());
    localStorage.removeItem("offline_last_user");
  } catch (err) {
    console.warn("[OfflineAuth] Could not clear session:", err);
  }
}

export function hasRecentOfflineSession(): boolean {
  return !!localStorage.getItem("offline_last_user");
}
