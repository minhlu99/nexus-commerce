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
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized: Active session required" }, 401);
  }
  await next();
});

/**
 * Role-Based Access Control (RBAC) Guard:
 * Checks user role against required list (e.g. ['admin', 'merchant']).
 */
export const requireRole = (allowedRoles: UserRole[]) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const user = c.get("user") as (typeof auth.$Infer.Session.user & { role?: UserRole }) | null;
    if (!user) {
      return c.json({ error: "Unauthorized: Active session required" }, 401);
    }

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
