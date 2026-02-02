import bcrypt from "bcrypt"

import { db } from "../database/index.js"
import { users } from "../database/schemas/index.js"
import { eq } from "drizzle-orm"

const privateRoutes = async (app) => {
  app.get("/me", { preHandler: [app.authenticate] }, async (req, res) => {
    try {
      // Check if the user object exists and contains a valid ID
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .send({ error: "Unauthorized: Missing or invalid user ID" })
      }

      // Fetch the user from the database using the ID from the token
      const [foundAccount] = await db
        .select({
          id: users.id,
          firstname: users.firstname,
          lastname: users.lastname,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, req.user.id))

      // Handle case where user is not found
      if (!foundAccount) {
        return res.status(404).send({ error: "User not found" })
      }

      // Return the user data
      return {
        firstname: foundAccount?.firstname,
        lastname: foundAccount?.lastname,
        username: foundAccount?.email,
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      return res.status(500).send({ error: "Internal Server Error" })
    }
  })

  app.get("/profile", { preHandler: [app.authenticate] }, async (req, res) => {
    try {
      // Check if the user object exists and contains a valid ID
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .send({ error: "Unauthorized: Missing or invalid user ID" })
      }

      // Fetch the user from the database using the ID from the token
      const [foundAccount] = await db
        .select({
          id: users.id,
          firstname: users.firstname,
          lastname: users.lastname,
          email: users.email,
          phone: users.phone,
          clientType: users.clientType,
          companyName: users.companyName,
        })
        .from(users)
        .where(eq(users.id, req.user.id))

      // Handle case where user is not found
      if (!foundAccount) {
        return res.status(404).send({ error: "User not found" })
      }

      // Return the user data
      return { user: foundAccount }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      return res.status(500).send({ error: "Internal Server Error" })
    }
  })

  app.post("/profile", { preHandler: [app.authenticate] }, async (req, res) => {
    try {
      // Check if the user object exists and contains a valid ID
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .send({ error: "Unauthorized: Missing or invalid user ID" })
      }

      const fields = {
        firstname: users.firstname,
        lastname: users.lastname,
        email: users.email,
        phone: users.phone,
        clientType: users.clientType,
        companyName: users.companyName,
      }

      const updated = await db
        .update()
        .set(fields)
        .where(eq(users.id, req.user.id))
        .returning({ ...fields, id: users.id })

      // Handle case where user is not found
      if (updated.length === 0) {
        return res.status(404).send({ error: "User not found" })
      }

      return { user: updated[0] }
    } catch (error) {
      console.error("Error updating user profile:", error)
      return res.status(500).send({ error: "Internal Server Error" })
    }
  })

  app.get("/password", { preHandler: [app.authenticate] }, async (req, res) => {
    try {
      // Check if the user object exists and contains a valid ID
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .send({ error: "Unauthorized: Missing or invalid user ID" })
      }

      const [foundAccount] = await db
        .select({ password: users.password })
        .from(users)
        .where(eq(users.id, req.user.id))

      // Handle case where user is not found
      if (!foundAccount) {
        return res.status(404).send({ error: "User not found" })
      }

      // Return the user's password (hashed, for security)
      return {
        hasPassword: !!foundAccount.password,
        email: foundAccount.email,
      }
    } catch (error) {
      console.error("Error fetching user password:", error)
      return res.status(500).send({ error: "Internal Server Error" })
    }
  })

  app.post(
    "/password",
    { preHandler: [app.authenticate] },
    async (req, res) => {
      try {
        // Check if the user object exists and contains a valid ID
        if (!req.user || !req.user.id) {
          return res
            .status(401)
            .send({ error: "Unauthorized: Missing or invalid user ID" })
        }

        const [foundAccount] = await db
          .select({ password: users.password })
          .from(users)
          .where(eq(users.id, req.user.id))

        // Handle case where user is not found
        if (!foundAccount) {
          return res.status(404).send({ error: "User not found" })
        }

        // Case when the user has authenticated with oauth2
        if (foundAccount.password) {
          if (!bcrypt.compareSync(req.body.password, foundAccount.password)) {
            return res.status(400).send({
              error: "Current password is incorrect",
            })
          }
          if (bcrypt.compareSync(req.body.newPassword, foundAccount.password)) {
            return res.status(400).send({
              error: "New password cannot be the same as the old one",
            })
          }
        }

        if (!req.body.newPassword || !req.body.confirmPassword) {
          return res
            .status(400)
            .send({ error: "New password and confirmation are required" })
        }

        if (req.body.newPassword !== req.body.confirmPassword) {
          return res
            .status(400)
            .send({ error: "New password and confirmation do not match" })
        }

        const hashedPassword = await bcrypt.hash(req.body.newPassword, 10)
        const [updatedAccount] = await db
          .update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, req.user.id))

        // Return a success message
        return {
          message: "Password updated successfully",
          user: updatedAccount,
        }
      } catch (error) {
        console.error("Error updating user password:", error)
        return res.status(500).send({ error: "Internal Server Error" })
      }
    }
  )
}

export default privateRoutes
