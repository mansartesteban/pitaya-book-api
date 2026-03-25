import {
  googleCallback,
  signIn,
  signUp,
  verifyEmail,
  forgotPassword,
  resetPassword,
  signOut,
} from "./auth.actions"
import {
  signInFormValidator,
  signUpFormValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "./auth.validators"
import { registerGoogleOAuth } from "./oauth/google"
import { authenticationMiddleware } from "@/lib/middlewares/authentication"

export default function authRoutes(fastify) {
  fastify.post(
    "/sign-in",
    {
      preHandler: signInFormValidator,
    },
    signIn
  )
  fastify.post(
    "/sign-up",
    {
      preHandler: signUpFormValidator,
    },
    signUp
  )
  fastify.post(
    "/sign-out",
    {
      preHandler: [authenticationMiddleware],
    },
    signOut
  )
  fastify.post(
    "/forgot-password",
    { preHandler: forgotPasswordValidator },
    forgotPassword
  )
  fastify.post(
    "/reset-password",
    {
      preHandler: resetPasswordValidator,
    },
    resetPassword
  )
  fastify.post("/verify-email", verifyEmail)

  registerGoogleOAuth(fastify)
  fastify.get("/google/callback", googleCallback)
}
