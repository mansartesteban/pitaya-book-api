import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"
import {
  getProfile,
  updateProfile,
  hasPassword,
  updatePassword,
  deleteAccount,
} from "./account.actions.js"
import {
  updatePasswordValidator,
  updateProfileValidator,
} from "./account.validators.js"
import { db } from "../../database/index.js"
import { users } from "../../database/schema.js"
import { eq } from "drizzle-orm"
import sharp from "sharp"
import { avatarPath, avatarPathFromUrl, avatarUrl, downloadAvatar, removeAvatar, uploadAvatar } from "./avatarStorage.js"

export default function accountRoutes(fastify) {
  fastify.get("/avatar-file/:userId/:filename", async (request, reply) => {
    const { userId, filename } = request.params
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}\.webp$/i.test(filename)) {
      return reply.code(404).send()
    }
    const path = `/profile-pictures/${userId}/${filename}`
    const [owner] = await db.select({ avatar: users.avatar }).from(users).where(eq(users.id, userId))
    if (avatarPathFromUrl(owner?.avatar) !== path) return reply.code(404).send()
    try {
      const { stream } = await downloadAvatar(path)
      return reply.header("Content-Type", "image/webp")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(stream)
    } catch (error) {
      request.log.error(error)
      return reply.code(404).send()
    }
  })
  fastify.post("/avatar", { preHandler: [authenticationMiddleware] }, async (request, reply) => {
    const part = await request.file()
    if (!part || !["image/jpeg", "image/png", "image/webp"].includes(part.mimetype)) {
      return reply.code(400).send({ success: false, message: "Choisissez une image JPEG, PNG ou WebP." })
    }
    try {
      const chunks = []
      let size = 0
      for await (const chunk of part.file) {
        size += chunk.length
        if (size > 5 * 1024 * 1024) return reply.code(413).send({ success: false, message: "Image trop volumineuse (5 Mo maximum)." })
        chunks.push(chunk)
      }
      const image = await sharp(Buffer.concat(chunks)).rotate().resize(256, 256, { fit: "cover" })
        .webp({ quality: 78 }).toBuffer()
      const path = avatarPath(request.user.id)
      await uploadAvatar(path, image)
      const avatar = avatarUrl(path)
      const [current] = await db.select({ avatar: users.avatar }).from(users).where(eq(users.id, request.user.id))
      try { await db.update(users).set({ avatar }).where(eq(users.id, request.user.id)) }
      catch (error) { await removeAvatar(path).catch(() => {}); throw error }
      const previousPath = avatarPathFromUrl(current?.avatar)
      if (previousPath) removeAvatar(previousPath).catch((error) => request.log.error(error))
      return reply.send({ success: true, data: { avatar } })
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, message: "Impossible d'enregistrer cette image." })
    }
  })
  fastify.get("/notification-preferences", { preHandler: [authenticationMiddleware] }, async (request, reply) => {
    const [account] = await db.select({ publicGalleryNotificationsEnabled: users.publicGalleryNotificationsEnabled })
      .from(users).where(eq(users.id, request.user.id))
    return account ? reply.send({ success: true, data: account }) : reply.code(404).send({ success: false })
  })
  fastify.put("/notification-preferences", { preHandler: [authenticationMiddleware] }, async (request, reply) => {
    if (typeof request.body?.publicGalleryNotificationsEnabled !== "boolean") {
      return reply.code(400).send({ success: false, message: "Préférence invalide" })
    }
    const [account] = await db.update(users).set({ publicGalleryNotificationsEnabled: request.body.publicGalleryNotificationsEnabled })
      .where(eq(users.id, request.user.id)).returning({ publicGalleryNotificationsEnabled: users.publicGalleryNotificationsEnabled })
    return account ? reply.send({ success: true, data: account }) : reply.code(404).send({ success: false })
  })
  fastify.delete("/", { preHandler: [authenticationMiddleware] }, deleteAccount)
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
