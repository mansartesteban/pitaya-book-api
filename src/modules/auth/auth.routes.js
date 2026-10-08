import {
  googleCallback,
  startMobileGoogleSignIn,
  exchangeMobileGoogleCode,
  signIn,
  signUp,
  verifyEmail,
  forgotPassword,
  resetPassword,
  signOut,
  resendVerification,
  getGuestInteractionSession,
  clearGuestInteractionSession,
} from "./auth.actions.js"
import {
  signInFormValidator,
  signUpFormValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "./auth.validators.js"
import { registerGoogleOAuth } from "./oauth/google.js"
import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"

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
  fastify.get("/guest-session", getGuestInteractionSession)
  fastify.delete("/guest-session", clearGuestInteractionSession)
  fastify.post("/resend-verification", { preHandler: [authenticationMiddleware] }, resendVerification)

  registerGoogleOAuth(fastify)
  fastify.get("/google/mobile/start", startMobileGoogleSignIn)
  fastify.post("/google/mobile/exchange", exchangeMobileGoogleCode)
  fastify.get("/google/callback", googleCallback)
}
