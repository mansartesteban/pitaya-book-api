import { authenticationMiddleware, adminMiddleware } from "../../lib/middlewares/authentication.js"
import { getAllUsers, getUser } from "./user.actions.js"
import { eq } from "drizzle-orm"
import { db } from "../../database/index.js"
import { dashboardLayouts } from "../../database/schema.js"
import { listMyManagedGalleries } from "../gallery/galleryManagers.js"

const widgetIds = ["clients", "galleries", "photos", "articles", "actions", "nextArticles", "upcoming"]
const validLayout = (layout) => {
  if (!layout || !Number.isInteger(layout.columns) || layout.columns < 2 || layout.columns > 8 ||
      !Number.isInteger(layout.rows) || layout.rows < 2 || layout.rows > 20 ||
      !Array.isArray(layout.widgets) || layout.widgets.length !== widgetIds.length) return false
  const ids = new Set()
  const cells = new Set()
  for (const widget of layout.widgets) {
    if (!widget || !widgetIds.includes(widget.id) || ids.has(widget.id) ||
        ![widget.x, widget.y, widget.width, widget.height].every(Number.isInteger) ||
        widget.x < 0 || widget.y < 0 || widget.width < 1 || widget.height < 1 ||
        widget.x + widget.width > layout.columns || widget.y + widget.height > layout.rows) return false
    ids.add(widget.id)
    for (let y = widget.y; y < widget.y + widget.height; y++) for (let x = widget.x; x < widget.x + widget.width; x++) {
      const key = `${x}:${y}`
      if (cells.has(key)) return false
      cells.add(key)
    }
  }
  return ids.size === widgetIds.length
}

export default function userRoutes(fastify) {
  fastify.get("/me/managed-galleries", { preHandler: [authenticationMiddleware] }, listMyManagedGalleries)
  fastify.get("/me/dashboard-layout", { preHandler: [authenticationMiddleware, adminMiddleware] }, async (request, reply) => {
    const [saved] = await db.select({ layout: dashboardLayouts.layout }).from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, request.user.id))
    return reply.send({ success: true, data: saved?.layout || null })
  })
  fastify.put("/me/dashboard-layout", { preHandler: [authenticationMiddleware, adminMiddleware] }, async (request, reply) => {
    if (!validLayout(request.body)) return reply.code(400).send({ success: false, message: "Disposition invalide" })
    const layout = { columns: request.body.columns, rows: request.body.rows,
      widgets: request.body.widgets.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })) }
    await db.insert(dashboardLayouts).values({ userId: request.user.id, layout })
      .onConflictDoUpdate({ target: dashboardLayouts.userId, set: { layout, updatedAt: new Date() } })
    return reply.send({ success: true, data: layout })
  })
  fastify.get(
    "/me",
    {
      preHandler: [authenticationMiddleware],
    },
    getUser
  )
  fastify.get(
    "/",
    { preHandler: [authenticationMiddleware, adminMiddleware] },
    getAllUsers
  )
}
