import type { NextFunction, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";

export interface AuthTokenPayload {
  /** User row id (cuid) */
  sub: string;
  role: Role;
  email: string;
}

export interface AuthedRequest extends Request {
  /** Set by `requireAuth` after the middleware runs. */
  auth?: AuthTokenPayload;
}

const DEFAULT_EXPIRY: SignOptions["expiresIn"] = "30d";

function getSecret(): string {
  return process.env.JWT_SECRET ?? "dev-secret-change-me";
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(
    { sub: payload.sub, role: payload.role, email: payload.email },
    getSecret(),
    { expiresIn: DEFAULT_EXPIRY },
  );
}

function isRole(value: unknown): value is Role {
  return value === Role.client || value === Role.master || value === Role.admin;
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getSecret());
  if (typeof decoded === "string" || decoded === null) {
    throw new Error("Invalid token payload");
  }
  const { sub, role, email } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || !sub) {
    throw new Error("Token missing `sub` claim");
  }
  if (typeof email !== "string") {
    throw new Error("Token missing `email` claim");
  }
  return { sub, email, role: isRole(role) ? role : Role.client };
}

/** Requires a valid `Authorization: Bearer <token>` header; sets `req.auth`. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Empty bearer token" });
    return;
  }
  try {
    req.auth = verifyAuthToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Must be used after `requireAuth`. Restricts access to one or more roles. */
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
