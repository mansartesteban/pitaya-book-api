import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"
import {
  getProfile,
  updateProfile,
  hasPassword,
  updatePassword,
} from "./account.actions.js"
import {
  updatePasswordValidator,
  updateProfileValidator,
} from "./account.validators.js"

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
