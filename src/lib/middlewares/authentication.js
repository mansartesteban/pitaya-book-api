import { eq } from "drizzle-orm"
import { db } from "../../database/index.js"
import { users } from "../../database/schema.js"

export const authenticationMiddleware = async (request, reply) => {
  const token = request.cookies.access_token
  if (!token) {
    return reply.code(401).send({ error: "Not authenticated" })
  }

  try {
    request.user = await request.jwtVerify(token)
  } catch (err) {
    return reply.code(401).send({ error: "Invalid token" })
  }
}

export const adminMiddleware = async (request, reply) => {
  if (!request.user?.id) return reply.code(401).send({ error: "Not authenticated" })
  const [account] = await db.select({ role: users.role, email: users.email, isActive: users.isActive })
    .from(users).where(eq(users.id, request.user.id))
  if (!account?.isActive || !(account.email === "esteban.mansart@gmail.com" || ["ADMIN", "SUPERADMIN"].includes(account.role))) {
    return reply.code(403).send({ error: "Accès réservé à l'administration" })
  }
}

export function requireRole(role) {
  return async (request, reply) => {
    // request.userRole déjà défini par authenticationMiddleware
    if (request.userRole !== role) {
      return reply
        .code(403)
        .send({ success: false, message: "Insufficient permissions" })
    }
  }
}
