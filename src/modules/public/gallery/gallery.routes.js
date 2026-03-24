import { getAllGalleries, getGallery } from "./gallery.actions"
import { getGalleryValidator } from "./gallery.validators"

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
