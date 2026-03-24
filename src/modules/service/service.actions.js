import { success, error } from "@lib/responses"
import { db } from "@db"
import { services } from "@db/schema"
import { ServiceStatusEnum } from "./service.schema"
import { HttpStatus } from "@lib/httpStatus"
import { and, eq } from "drizzle-orm"
import { createUpdateObject } from "../../lib/utils/Query"
import { companies } from "../../database/schema"
import { documents } from "../../database/schema"
import path from "path"
import fs from "fs"
import { unlink } from "fs/promises"

import { documentManager } from "../../lib/documentManager"

export const getOneService = async (request, reply) => {
  try {
    const [serviceFound] = await db
      .select({
        id: services.id,
        title: services.title,
        location: services.location,
        description: services.description,
        company: {
          id: companies.id,
          name: companies.name,
          // location: companies.location,
        },
        price: services.price,
        status: services.status,
      })
      .from(services)
      .leftJoin(companies, eq(services.clientCompanyId, companies.id))
      .where(eq(services.id, request.validated.params.id))
    return success(reply, { data: serviceFound })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError(
        "Erreur lors de la récupération de la prestation"
      )
    )
  }
}
export const createService = async (request, reply) => {
  try {
    const [insertedService] = await db
      .insert(services)
      .values({
        title: request.validated.body.title,
        location: request.validated.body.location,
        description: request.validated.body.description,
        price: request.validated.body.price,
        status: ServiceStatusEnum.LEAD,
      })
      .returning()

    return success(reply, {
      data: insertedService,
      message: "Prestation créée",
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la création de la prestation")
    )
  }
}

export const getServices = async (request, reply) => {
  try {
    const servicesList = await db
      .select({
        id: services.id,
        title: services.title,
        location: services.location,
        description: services.description,
        company: services.clientCompanyId,
        price: services.price,
        status: services.status,
      })
      .from(services)
    return success(reply, { data: servicesList })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la récupération des prestations")
    )
  }
}

export const updateService = async (request, reply) => {
  try {
    const updatePayload = createUpdateObject(services, {
      title: request.validated.body.title,
      location: request.validated.body.location,
      description: request.validated.body.description,
      price: request.validated.body.price,
      status: ServiceStatusEnum.LEAD,
      clientCompanyId: request.validated.body.company?.[0],
    })

    const [updatedService] = await db
      .update(services)
      .set(updatePayload.values)
      .where(eq(services.id, request.validated.params.id))
      .returning()

    return success(reply, {
      data: updatedService,
      message: "Prestation modifiée",
    })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la mise à jour de la prestation")
    )
  }
}

export const uploadFileService = async (request, reply) => {
  try {
    const file = await request.file()

    if (!file) {
      return reply.code(400).send({
        success: false,
        message: "Aucun fichier reçu",
      })
    }

    if (!request.validated.params.serviceId) {
      return reply.code(400).send({
        success: false,
        message: "Aucune prestation liée à ce fichier",
      })
    }

    const { serviceId } = request.validated.params

    const document = await documentManager.upload(file, {
      serviceId: serviceId ? parseInt(serviceId) : null,
      category: "SERVICE",
      folder: serviceId,
    })

    return success(reply, { message: "Fichier téléchargé", data: document })
  } catch (err) {
    request.log.error(err)

    return reply.code(500).send({
      success: false,
      message: "Erreur lors de l’upload",
    })
  }
}

export const listFileService = async (request, reply) => {
  try {
    const { serviceId } = request.validated.params

    const files = await db
      .select()
      .from(documents)
      .where(eq(documents.serviceId, serviceId))

    return reply.status(200).send({
      success: true,
      data: files,
    })
  } catch (err) {
    request.log?.error(err)
    return error(reply, err.message, 500)
  }
}

const mimeMap = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".html": "text/html",
  ".csv": "text/csv",
}

export const getFile = async (request, reply) => {
  try {
    const fileId = request.validated.params.fileId
    const serviceId = request.validated.params.serviceId

    const [file] = await db
      .select({ id: documents.id, path: documents.path })
      .from(documents)
      .where(and(eq(documents.id, fileId), eq(documents.serviceId, serviceId)))

    if (!file) {
      return reply.status(404).send({
        success: false,
        message: "Aucun fichier trouvé",
      })
    }

    const ext = path.extname(file.path).toLowerCase()
    const contentType = mimeMap[ext] || "application/octet-stream"
    const fileName = path.basename(file.path)

    reply.header("Content-Type", contentType)
    reply.header("Content-Disposition", `inline; filename="${fileName}"`)
    return reply.send(fs.createReadStream(file.path))
  } catch (err) {
    request.log?.error(err)
    return error(reply, err.message, 500)
  }
}

export const deleteFile = async (request, reply) => {
  const { serviceId, fileId } = request.validated.params

  try {
    const [file] = await db
      .select({
        id: documents.id,
        path: documents.path,
      })
      .from(documents)
      .where(and(eq(documents.id, fileId), eq(documents.serviceId, serviceId)))

    if (!file) {
      return error(reply, "Fichier introuvable", 404)
    }

    // Supprimer le fichier du disque
    await unlink(path.resolve(file.path))

    // Supprimer le fichier en BDD
    await db.delete(documents).where(eq(documents.id, fileId))
    return reply
      .status(200)
      .send({ success: true, message: "Fichier supprimé" })
  } catch (err) {
    request.log?.error(err)
    return error(reply, err.message, 500)
  }
}
