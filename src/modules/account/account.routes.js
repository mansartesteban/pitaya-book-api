import { authenticationMiddleware } from "@lib/middlewares/authentication"
import {
  getProfile,
  updateProfile,
  hasPassword,
  updatePassword,
} from "./account.actions"
import {
  updatePasswordValidator,
  updateProfileValidator,
} from "./account.validators"

export default function accountRoutes(fastify) {
  fastify.get(
    "/profile",
    {
      preHandler: [authenticationMiddleware],
    },
    getProfile
  )

  fastify.post(
    "/profile",
    {
      preHandler: [authenticationMiddleware, updateProfileValidator],
    },
    updateProfile
  )

  fastify.get(
    "/has-password",
    {
      preHandler: [authenticationMiddleware],
    },
    hasPassword
  )

  fastify.post(
    "/change-password",
    {
      preHandler: [authenticationMiddleware, updatePasswordValidator],
    },
    updatePassword
  )
}
