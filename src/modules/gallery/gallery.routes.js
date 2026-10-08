import {
  updateGallery,
  updateGalleryDownloadable,
  updateGalleryInteractions,
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
  deletePhotoCover,
  uploadPhotoCover,
  setPhotoCover,
  getFreeGalleries,
} from "./gallery.actions.js"
import {
  addParentGalleryValidator,
  createGalleryValidator,
  deleteGalleryValidator,
  deleteMultiplePhotosValidator,
  deletePhotoCoverValidator,
  deletePhotoValidator,
  downloadMultiplePhotosValidator,
  downloadPhotoValidator,
  getOneGalleryValidator,
  removeParentGalleryValidator,
  updateGalleryValidator,
  updateGalleryDownloadableValidator,
  updateGalleryInteractionsValidator,
  updatePhotoValidator,
  uploadPhotoCoverValidator,
  setPhotoCoverValidator,
  uploadPhotoValidator,
} from "./gallery.validators.js"
import { authenticationMiddleware, adminMiddleware } from "../../lib/middlewares/authentication.js"
import { saveCoverFraming } from "./galleryCoverFraming.js"
import { applyGalleryExpirations } from "./galleryExpiration.js"
import { listGalleryReminders, createGalleryReminder, updateGalleryReminder, deleteGalleryReminder, listGalleryReminderDeliveries, retryGalleryReminderDelivery } from "./galleryReminderSettings.js"
import { listGalleryManagers, replaceGalleryManagers, listGalleryUserManagers, addGalleryUserManager, removeGalleryUserManager,
  searchGalleryManagerCandidates, listUnifiedGalleryManagers, addUnifiedGalleryManager, removeUnifiedGalleryManager,
  resendGalleryManagerInvitation } from "./galleryManagers.js"

export default function galleryRoutes(fastify) {
  fastify.addHook("preHandler", authenticationMiddleware)
  fastify.addHook("preHandler", adminMiddleware)
  fastify.addHook("preHandler", applyGalleryExpirations)
  fastify.get("/:galleryId/managers", listGalleryManagers)
  fastify.put("/:galleryId/managers", replaceGalleryManagers)
  fastify.get("/:galleryId/user-managers", listGalleryUserManagers)
  fastify.post("/:galleryId/user-managers", addGalleryUserManager)
  fastify.delete("/:galleryId/user-managers/:userId", removeGalleryUserManager)
  fastify.get("/:galleryId/manager-candidates", searchGalleryManagerCandidates)
  fastify.get("/:galleryId/manager-access", listUnifiedGalleryManagers)
  fastify.post("/:galleryId/manager-access", addUnifiedGalleryManager)
  fastify.delete("/:galleryId/manager-access/:type/:id", removeUnifiedGalleryManager)
  fastify.patch("/:galleryId/cover-framing", saveCoverFraming)
  fastify.post("/:galleryId/manager-access/:id/resend", resendGalleryManagerInvitation)
  fastify.get("/:galleryId/reminders", { preHandler: [authenticationMiddleware] }, listGalleryReminders)
  fastify.post("/:galleryId/reminders", { preHandler: [authenticationMiddleware] }, createGalleryReminder)
  fastify.put("/:galleryId/reminders/:reminderId", { preHandler: [authenticationMiddleware] }, updateGalleryReminder)
  fastify.delete("/:galleryId/reminders/:reminderId", { preHandler: [authenticationMiddleware] }, deleteGalleryReminder)
  fastify.get("/:galleryId/reminder-deliveries", { preHandler: [authenticationMiddleware] }, listGalleryReminderDeliveries)
  fastify.post("/:galleryId/reminder-deliveries/:deliveryId/retry", { preHandler: [authenticationMiddleware] }, retryGalleryReminderDelivery)
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
  fastify.get(
    "/free",
    {
      preHandler: [authenticationMiddleware],
    },
    getFreeGalleries
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
  fastify.patch(
    "/:galleryId/downloadable",
    {
      preHandler: [authenticationMiddleware, updateGalleryDownloadableValidator],
    },
    updateGalleryDownloadable
  )
  fastify.patch("/:galleryId/interactions", {
    preHandler: [authenticationMiddleware, updateGalleryInteractionsValidator],
  }, updateGalleryInteractions)
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
    "/:galleryId/photo-cover",
    {
      preHandler: [authenticationMiddleware, uploadPhotoCoverValidator],
    },
    uploadPhotoCover
  )
  fastify.put(
    "/:galleryId/photo-cover/:photoId",
    {
      preHandler: [authenticationMiddleware, setPhotoCoverValidator],
    },
    setPhotoCover
  )
  fastify.delete(
    "/:galleryId/photo-cover",
    {
      preHandler: [authenticationMiddleware, deletePhotoCoverValidator],
    },
    deletePhotoCover
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
