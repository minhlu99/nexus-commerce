import { auth, type UserRole } from "@nexus/auth";
import { createMiddleware } from "hono/factory";

export type AuthVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

/**
 * Global Session Middleware:
 * Inspects incoming cookies or Authorization headers via Better Auth.
 * Non-blocking: Attaches user & session to context if valid, null otherwise.
 */
export const sessionMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});

/**
 * Strict Authentication Guard:
 * Rejects unauthenticated requests with HTTP 401.
 * Enforces a live Valkey 9.1 lookup (disableCookieCache: true) so revoked sessions are blocked immediately.
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized: Active session required" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

/**
 * Role-Based Access Control (RBAC) Guard:
 * Checks user role against required list (e.g. ['admin', 'merchant']).
 * Bypasses local cookie cache to guarantee real-time role changes and demotions.
 */
export const requireRole = (allowedRoles: UserRole[]) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableCookieCache: true },
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized: Active session required" }, 401);
    }

    c.set("user", session.user);
    c.set("session", session.session);

    const user = session.user as typeof auth.$Infer.Session.user & { role?: UserRole };
    const currentRole = user.role || "customer";
    if (!allowedRoles.includes(currentRole as UserRole)) {
      return c.json(
        {
          error: `Forbidden: Requires [${allowedRoles.join(" | ")}] permission. Current role: ${currentRole}`,
        },
        403,
      );
    }

    await next();
  });
