import {
  googleCallback,
  signIn,
  signUp,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "./auth.actions"
import {
  signInFormValidator,
  signUpFormValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "./auth.validators"
import { registerGoogleOAuth } from "./oauth/google"

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
