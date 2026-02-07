import { error } from "@/lib/responses"
import jwt from "@fastify/jwt"

export const authenticationMiddleware = async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    return error(reply, "Invalid token", 401)
  }
}

export function requireRole(role) {
  return async (request, reply) => {
    // request.userRole déjà défini par authenticationMiddleware
    if (request.userRole !== role) {
      return error(reply, "Insufficient permissions", 403)
    }
  }
}
