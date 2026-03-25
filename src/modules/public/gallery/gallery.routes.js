import { getAllGalleries, getGallery } from "./gallery.actions.js"
import { getGalleryValidator } from "./gallery.validators.js"

export default function galleryRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [],
    },
    getAllGalleries
  )
  fastify.get(
    "/:galleryId",
    {
      preHandler: [getGalleryValidator],
    },
    getGallery
  )
}
