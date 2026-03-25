import { error } from "@/lib/responses"

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

export function requireRole(role) {
  return async (request, reply) => {
    // request.userRole déjà défini par authenticationMiddleware
    if (request.userRole !== role) {
      return error(reply, "Insufficient permissions", 403)
    }
  }
}
