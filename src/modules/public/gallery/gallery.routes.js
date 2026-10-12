import {
  downloadPrivateGallery,
  downloadPublicPhoto,
  getAllGalleries,
  getSitemapGalleries,
  getGallery,
  getPrivateGallery,
  previewPublicPhoto,
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
  fastify.get("/sitemap-entries", getSitemapGalleries)
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
    "/:galleryId/photos/:photoId/preview",
    { preHandler: [getPhotoDownloadValidator] },
    previewPublicPhoto
  )
  fastify.get(
    "/:galleryId/photos/:photoId/download",
    { preHandler: [getPhotoDownloadValidator] },
    downloadPublicPhoto
  )
}
