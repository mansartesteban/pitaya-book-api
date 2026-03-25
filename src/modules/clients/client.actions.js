import { db } from "../../database/index.js"
import { companies } from "../../database/schema.js"
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
    return reply.code(200).send({ success: true, data: results })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la récupération des sociétés",
    })
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
    return reply
      .code(201)
      .send({ success: true, data: insertedCompany, message: "Société créée" })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la création de la société",
    })
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
    return reply.status(200).send({
      success: true,
      data: updatedCompany,
      message: "Société modifiée",
    })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la création de la société",
    })
  }
}

export const deleteCompany = async (request, reply) => {
  try {
    const response = await db
      .delete(companies)
      .where(eq(companies.id, request.validated.params.companyId))
      .returning()
    return reply.code(200).send({ success: true, message: "Société supprimée" })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la suppression de la société",
    })
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
    return reply.code(200).send({ success: true, data: response })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la récupération de la société",
    })
  }
}
