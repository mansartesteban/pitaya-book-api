import { z } from "zod"
import bcrypt from "bcrypt"
import fastifyOauth2 from "@fastify/oauth2"
import { Resend } from "resend"
import { users } from "../database/schemas/index.js"
import { db } from "../database/index.js"
import { eq } from "drizzle-orm"

const authRoutes = async (app) => {
  app.post("/forgot-password", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
    })

    try {
      const data = bodySchema.parse(req.body)

      const [user] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, data.email))

      if (user) {
        // Génère un token de réinitialisation
        const resetToken = app.jwt.sign(
          {
            id: user.id,
            email: user.email,
          },
          {
            expiresIn: "1h", // Durée de validité du token})
          }
        )

        const resend = new Resend("re_D4myqfEs_Ff4pPXNSUFhnWDTUqQc4QkhL")

        const res = await resend.emails.send({
          from: "PITAYA INC <onboarding@resend.dev>",
          replyTo: "esteban.mansart@gmail.com",
          to: user.email,
          subject: "Réinitialisation de votre mot de passe",
          html: `Cliquez sur ce lien pour réinitialiser votre mot de passe : <br><a href="http://localhost:5173/authentication/reset-password?token=${resetToken}">Réinitialiser le mot de passe</a>`,
        })
      }

      return reply.send({ message: "Reset token sent to your email" })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: err.errors, // tableau détaillé des erreurs
        })
      }

      // autre erreur (ex: DB, bcrypt, etc.)
      console.error(err)
      return reply.code(500).send({ error: "Internal server error" })
    }
  })

  app.post("/reset-password", async (req, reply) => {
    const bodySchema = z.object({
      token: z.string(),
      password: z.string().min(6),
    })

    try {
      const data = bodySchema.parse(req.body)

      // Vérifie le token JWT
      const decoded = app.jwt.verify(data.token)
      if (!decoded || typeof decoded !== "object" || !("id" in decoded)) {
        return reply.code(400).send({ error: "Invalid or expired token" })
      }

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, decoded.id))

      if (!user) {
        return reply.code(404).send({ error: "User not found" })
      }

      // Hash le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(data.password, 10)

      const [updated] = await db
        .update({ password: users.password })
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id))

      return reply.send({ message: "Password reset successfully" })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          issues: err.errors, // tableau détaillé des erreurs
        })
      }

      console.error(err)
      return reply.code(500).send({ error: "Internal server error" })
    }
  })

  // Register
  app.post("/register", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      firstname: z.string().min(1),
      lastname: z.string().min(1),
    })

    try {
      const data = bodySchema.parse(req.body)

      const hashed = await bcrypt.hash(data.password, 10)

      const userFound = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, req.body.email))

      if (userFound.length > 0) {
        return reply
          .code(409)
          .send({ errors: { email: "Cet email est déjà pris" } })
      }

      const fields = {
        firstname: users.firstname,
        lastname: users.lastname,
        email: users.email,
        password: users.password,
      }

      const [insertedUser] = await db
        .insert(users)
        .values({
          email: data.email,
          password: hashed,
          firstname: data.firstname,
          lastname: data.lastname,
        })
        .returning()

      return reply
        .code(201)
        .send({ id: insertedUser.id, email: insertedUser.email })
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors = {}
        for (const issue of err.errors) {
          const field = issue.path[0]
          if (typeof field === "string") {
            // ne remplace que si la clé est pas encore définie (pour éviter d'écraser la 1re erreur)
            if (!fieldErrors[field]) {
              fieldErrors[field] = issue.message
            }
          }
        }

        return reply.code(400).send({
          error: "Validation failed",
          errors: fieldErrors,
        })
      }

      // autre erreur (ex: DB, bcrypt, etc.)
      console.error(err)
      return reply.code(500).send({ error: "Internal server error" })
    }
  })

  // Login
  app.post("/login", async (req, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string(),
    })
    const data = bodySchema.parse(req.body)

    const [userFound] = await db
      .select({ password: users.password, id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, data.email))

    if (!userFound) {
      return reply.code(401).send({ error: "Invalid credentials" })
    }

    const match = await bcrypt.compare(data.password, userFound.password)
    if (!match) return reply.code(401).send({ error: "Invalid credentials" })

    const token = app.jwt.sign({
      id: userFound.id,
      email: userFound.email,
      role: userFound.role,
    })
    return { token }
  })

  // Logout
  app.post("/logout", async (req, reply) => {
    // Pour le front, on renvoie juste un 200 OK
    return { message: "Logged out" }
  })

  app.get("/api/google/callback", async (req, reply) => {
    const token =
      await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req)
    const userInfo = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token.token.access_token}`,
        },
      }
    ).then((res) => res.json())

    // Vérifie si utilisateur existe ou crée un nouveau
    let insertedUser = await db
      .insert(users)
      .values({
        email: userInfo.email,
        firstname: userInfo.given_name ?? "",
        lastname: userInfo.family_name ?? "",
        password: null,
        clientType: "INDIVIDUAL",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { lastLoginAt: new Date() },
      })
      .returning()
    insertedUser = insertedUser[0]

    // Crée et renvoie un token de session
    const sessionToken = app.jwt.sign({
      id: insertedUser.id,
      email: insertedUser.email,
      role: insertedUser.role,
    })

    reply.redirect(
      `http://localhost:5173/authentication/sign-in-success?token=${sessionToken}`
    )
  })

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
    startRedirectPath: "/api/google",
    callbackUri: "http://localhost:3000/auth/api/google/callback",
  })
}

export default authRoutes
