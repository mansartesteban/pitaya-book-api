import {
  downloadPrivateGallery,
  downloadPublicPhoto,
  getAllGalleries,
  getGallery,
  getPrivateGallery,
  prepareDownloadPrivateGallery,
} from "./gallery.actions.js"
import {
  getGalleryValidator,
  getPhotoDownloadValidator,
  getPrivateGalleryValidator,
} from "./gallery.validators.js"
import { applyGalleryExpirations } from "../../gallery/galleryExpiration.js"

export default function galleryRoutes(fastify) {
  fastify.addHook("preHandler", applyGalleryExpirations)
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
  fastify.get(
    "/:galleryId/photos/:photoId/download",
    { preHandler: [getPhotoDownloadValidator] },
    downloadPublicPhoto
  )
}
