import { authenticationMiddleware } from "@/lib/middlewares/authentication"
import { getAllUsers, getUser } from "./user.actions"

export default function userRoutes(fastify) {
  fastify.get(
    "/me",
    {
      preHandler: [authenticationMiddleware],
    },
    getUser
  )
  fastify.get(
    "/",
    { preHandler: [authenticationMiddleware /* isAdmin */] },
    getAllUsers
  )
}
