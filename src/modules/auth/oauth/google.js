import fastifyOauth2 from "@fastify/oauth2"

export function registerGoogleOAuth(app) {
  app.register(fastifyOauth2, {
    name: "googleOAuth2",
    scope: ["email", "profile"],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID,
        secret: process.env.GOOGLE_CLIENT_SECRET,
      },
      auth: fastifyOauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: "/google",
    callbackUri: `${process.env.API_URL}/api/auth/google/callback`,
  })
}
