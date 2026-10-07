import { eq } from "drizzle-orm"
import { db } from "../../../database/index.js"
import { companyContacts } from "../../../database/schema.js"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function reminderPreferencesRoutes(fastify) {
  fastify.get("/:token", async (request, reply) => {
    if (!uuid.test(request.params.token)) return reply.code(404).send({ success: false })
    const [contact] = await db.select({ email: companyContacts.email, remindersEnabled: companyContacts.remindersEnabled })
      .from(companyContacts).where(eq(companyContacts.reminderToken, request.params.token))
    if (!contact) return reply.code(404).send({ success: false })
    return reply.send({ success: true, data: contact })
  })
  fastify.put("/:token", async (request, reply) => {
    if (!uuid.test(request.params.token)) return reply.code(404).send({ success: false })
    if (typeof request.body?.remindersEnabled !== "boolean") {
      return reply.code(400).send({ success: false, message: "Choix invalide" })
    }
    const [contact] = await db.select({ email: companyContacts.email })
      .from(companyContacts).where(eq(companyContacts.reminderToken, request.params.token))
    if (!contact) return reply.code(404).send({ success: false })
    await db.update(companyContacts)
      .set({ remindersEnabled: request.body.remindersEnabled })
      .where(eq(companyContacts.email, contact.email))
    return reply.send({ success: true })
  })
}
