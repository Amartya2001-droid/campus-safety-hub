import { createHmac } from "node:crypto";
import type { RequestHandler } from "express";

interface Actor { id: number; role: string }

/** A short-lived server-to-server assertion; never sent to the browser. */
export function signActor(actor: Actor, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: String(actor.id), role: actor.role, iat: now, exp: now + 30,
    aud: "campus-map", iss: "acadia-dashboard",
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function campusBackend(
  findUser: (id: number) => Promise<Actor | null>,
): RequestHandler | null {
  const target = process.env.FASTAPI_URL;
  if (!target) return null;
  const secret = process.env.SECRET_KEY || "";
  if (secret.trim().length < 32 || secret !== secret.trim() || new Set(secret).size < 8 ||
      ["acadia-safe-secret-key-2024", "acadia-safe-dev-secret-change-in-prod"].includes(secret)) {
    throw new Error("SECRET_KEY must be a privately generated key of at least 32 characters");
  }
  const base = new URL(target);
  if ((base.protocol !== "https:" && !(base.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))) ||
      base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("FASTAPI_URL must be an HTTPS origin (or HTTP loopback for development)");
  }
  return async (req, res) => {
    const user = req.session.userId ? await findUser(req.session.userId) : null;
    if (!user) { res.status(401).json({ message: "Not authenticated" }); return; }
    try {
      const upstream = await fetch(new URL(req.path, base), {
        method: req.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${signActor(user, secret)}` },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      if (!upstream.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Unexpected backend response");
      }
      res.status(upstream.status).json(await upstream.json());
    } catch {
      // Never fall back to a second writer or expose keys/upstream error details.
      res.status(502).json({ message: "Campus map service unavailable" });
    }
  };
}
