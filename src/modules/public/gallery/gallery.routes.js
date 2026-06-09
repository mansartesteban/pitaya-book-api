import {
  downloadPrivateGallery,
  getAllGalleries,
  getGallery,
  getPrivateGallery,
  prepareDownloadPrivateGallery,
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
  fastify.get(
    "/:galleryId/prepare-download",
    {
      preHandler: [getGalleryValidator],
    },
    prepareDownloadPrivateGallery
  )
  fastify.get(
    "/:galleryId/download",
    {
      preHandler: [getGalleryValidator],
    },
    downloadPrivateGallery
  )
}
