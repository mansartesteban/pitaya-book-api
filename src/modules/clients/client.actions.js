import { db } from "@db"
import { companies } from "../../database/schema"
import { success, error, created } from "@lib/responses"
import { HttpStatus } from "@lib/httpStatus"
import { eq } from "drizzle-orm"

export const getAllCompanies = async (request, reply) => {
  try {
    const results = await db
      .select({
        id: companies.id,
        name: companies.name,
        legalName: companies.legalName,
        siret: companies.siret,
        location: companies.location,
        vatNumber: companies.vatNumber,
      })
      .from(companies)
    return success(reply, { data: results })
  } catch (err) {
    console.error("err", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la récupération des sociétés")
    )
  }
}

export const createCompany = async (request, reply) => {
  try {
    const [insertedCompany] = await db
      .insert(companies)
      .values({
        name: request.validated.body.name,
        legalName: request.validated.body.legalName,
        siret: request.validated.body.siret,
        location: request.validated.body.location,
        vatNumber: request.validated.body.vatNumber,
      })
      .returning()
    return created(reply, { data: insertedCompany, message: "Société créée" })
  } catch (err) {
    console.log("error", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la création de la société")
    )
  }
}
export const updateCompany = async (request, reply) => {
  try {
    const { companyId } = request.validated.params

    const [updatedCompany] = await db
      .update(companies)
      .set({
        name: request.validated.body.name,
        legalName: request.validated.body.legalName,
        siret: request.validated.body.siret,
        location: request.validated.body.location,
        vatNumber: request.validated.body.vatNumber,
      })
      .where(eq(companies.id, companyId))
      .returning()
    return reply
      .status(200)
      .send({
        success: true,
        data: updatedCompany,
        message: "Société modifiée",
      })
  } catch (err) {
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la création de la société")
    )
  }
}

export const deleteCompany = async (request, reply) => {
  try {
    const response = await db
      .delete(companies)
      .where(eq(companies.id, request.validated.params.companyId))
      .returning()
    return success(reply, { message: "Société supprimée" })
  } catch (err) {
    console.log("error", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la suppression de la société")
    )
  }
}

export const getCompany = async (request, reply) => {
  try {
    const [response] = await db
      .select({
        name: companies.name,
        legalName: companies.legalName,
        vatNumber: companies.vatNumber,
        location: companies.location,
        siret: companies.siret,
        id: companies.id,
      })
      .from(companies)
      .where(eq(companies.id, request.validated.params.companyId))
    return success(reply, { data: response })
  } catch (err) {
    console.log("error", err)
    request.log.error(err)
    return error(
      reply,
      HttpStatus.internalError("Erreur lors de la récupération de la société")
    )
  }
}
