import {
  getAllGalleries,
  getGallery,
  getPrivateGallery,
} from "./gallery.actions.js"
import {
  getGalleryValidator,
  getPrivateGalleryValidator,
} from "./gallery.validators.js"

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
  fastify.post(
    "/:galleryId",
    {
      preHandler: [getPrivateGalleryValidator],
    },
    getPrivateGallery
  )
}
