import galleryRoutes from "./gallery/gallery.routes"

export default async function publicRoutes(app) {
  await app.register(galleryRoutes, { prefix: "/gallery" })
}
