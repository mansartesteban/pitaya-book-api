import {
  updateGallery,
  getAllGalleries,
  getOneGallery,
  createGallery,
  deleteGallery,
  uploadPhoto,
  deletePhoto,
  deleteMultiplePhotos,
  updatePhoto,
  downloadPhoto,
  downloadMultiplePhotos,
  addParentGallery,
  removeParentGallery,
} from "./gallery.actions.js"
import {
  addParentGalleryValidator,
  createGalleryValidator,
  deleteGalleryValidator,
  deleteMultiplePhotosValidator,
  deletePhotoValidator,
  downloadMultiplePhotosValidator,
  downloadPhotoValidator,
  getOneGalleryValidator,
  removeParentGalleryValidator,
  updateGalleryValidator,
  updatePhotoValidator,
  uploadPhotoValidator,
} from "./gallery.validators.js"
import { authenticationMiddleware } from "../../lib/middlewares/authentication.js"

export default function galleryRoutes(fastify) {
  fastify.get(
    "/:galleryId",
    {
      preHandler: [authenticationMiddleware, getOneGalleryValidator],
    },
    getOneGallery
  )
  fastify.get(
    "/",
    {
      preHandler: [authenticationMiddleware],
    },
    getAllGalleries
  )
  fastify.post(
    "/",
    {
      preHandler: [authenticationMiddleware, createGalleryValidator],
    },
    createGallery
  )
  fastify.put(
    "/:galleryId",
    {
      preHandler: [authenticationMiddleware, updateGalleryValidator],
    },
    updateGallery
  )
  fastify.put(
    "/:galleryId/parent-gallery",
    {
      preHandler: [authenticationMiddleware, addParentGalleryValidator],
    },
    addParentGallery
  )
  fastify.delete(
    "/:galleryId/parent-gallery",
    {
      preHandler: [authenticationMiddleware, removeParentGalleryValidator],
    },
    removeParentGallery
  )
  fastify.delete(
    "/:galleryId",
    {
      preHandler: [authenticationMiddleware, deleteGalleryValidator],
    },
    deleteGallery
  )
  fastify.post(
    "/:galleryId/photos",
    {
      preHandler: [authenticationMiddleware, uploadPhotoValidator],
    },
    uploadPhoto
  )
  fastify.delete(
    "/:galleryId/photos/:photoId",
    {
      preHandler: [authenticationMiddleware, deletePhotoValidator],
    },
    deletePhoto
  )
  fastify.post(
    "/:galleryId/photos/delete",
    {
      preHandler: [authenticationMiddleware, deleteMultiplePhotosValidator],
    },
    deleteMultiplePhotos
  )
  fastify.put(
    "/:galleryId/photos/:photoId",
    {
      preHandler: [authenticationMiddleware, updatePhotoValidator],
    },
    updatePhoto
  )
  fastify.get(
    "/:galleryId/photos/:photoId",
    { preHandler: [authenticationMiddleware, downloadPhotoValidator] },
    downloadPhoto
  )
  fastify.post(
    "/:galleryId/photos/download",
    { preHandler: [authenticationMiddleware, downloadMultiplePhotosValidator] },
    downloadMultiplePhotos
  )
}
