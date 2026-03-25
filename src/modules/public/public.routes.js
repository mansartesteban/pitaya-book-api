import galleryRoutes from "./gallery/gallery.routes.js"

export default async function publicRoutes(app) {
  await app.register(galleryRoutes, { prefix: "/gallery" })
}
