import {
  createService,
  deleteFile,
  getFile,
  getOneService,
  getServices,
  listFileService,
  updateService,
  uploadFileService,
} from "./service.actions"
import { authenticationMiddleware } from "@/lib/middlewares/authentication"
import {
  createServiceValidator,
  deleteFileValidator,
  getFileValidator,
  getOneServiceValidator,
  listFileServiceValidator,
  updateServiceSchema,
  uploadFileServiceValidator,
} from "./service.validators"

export default function serviceRoutes(fastify) {
  fastify.get(
    "/:id",
    {
      preHandler: [authenticationMiddleware, getOneServiceValidator],
    },
    getOneService
  )
  fastify.get(
    "/",
    {
      preHandler: [authenticationMiddleware],
    },
    getServices
  )
  fastify.post(
    "/",
    {
      preHandler: [authenticationMiddleware, createServiceValidator],
    },
    createService
  )
  fastify.put(
    "/:id",
    {
      preHandler: [authenticationMiddleware, updateServiceSchema],
    },
    updateService
  )
  fastify.post(
    "/:serviceId/files",
    {
      preHandler: [authenticationMiddleware, uploadFileServiceValidator],
    },
    uploadFileService
  )
  fastify.get(
    "/:serviceId/files",
    {
      preHandler: [authenticationMiddleware, listFileServiceValidator],
    },
    listFileService
  )

  fastify.get(
    "/:serviceId/files/:fileId",
    {
      preHandler: [authenticationMiddleware, getFileValidator],
    },
    getFile
  )

  fastify.delete(
    "/:serviceId/files/:fileId",
    {
      preHandler: [authenticationMiddleware, deleteFileValidator],
    },
    deleteFile
  )
}
