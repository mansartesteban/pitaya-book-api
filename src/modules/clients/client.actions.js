import { db } from "../../database/index.js"
import { companies, companyContacts, galleries, photos } from "../../database/schema.js"
import { and, eq, isNull, or, sql } from "drizzle-orm"

const companyAccess = (request) => or(
  eq(companies.userId, request.user.id),
  isNull(companies.userId)
)

const ownedCompany = async (request, companyId) => {
  const [company] = await db.select({ id: companies.id })
    .from(companies).where(and(eq(companies.id, companyId), companyAccess(request)))
  return company
}

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
      .where(companyAccess(request))
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
        userId: request.user.id,
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
      .where(and(eq(companies.id, companyId), companyAccess(request)))
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
      .where(and(eq(companies.id, request.validated.params.companyId), companyAccess(request)))
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
      .where(and(eq(companies.id, request.validated.params.companyId), companyAccess(request)))
    return reply.code(200).send({ success: true, data: response })
  } catch (err) {
    request.log.error(err)
    return reply.code(500).send({
      success: false,
      message: "Erreur lors de la récupération de la société",
    })
  }
}

export const getCompanySummary = async (request, reply) => {
  const { companyId } = request.params
  if (!await ownedCompany(request, companyId)) return reply.code(404).send({ success: false, message: "Société introuvable" })
  const rows = await db.select({
    id: galleries.id, title: galleries.title, parentGallery: galleries.parentGallery,
    clientCompanyId: galleries.clientCompanyId,
    photoCount: sql`count(${photos.id})`.as("photoCount"),
  }).from(galleries).leftJoin(photos, eq(photos.galleryId, galleries.id))
    .where(eq(galleries.ownerUserId, request.user.id)).groupBy(galleries.id)
  const included = new Set(rows.filter((row) => row.clientCompanyId === companyId).map((row) => row.id))
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (!included.has(row.id) && included.has(row.parentGallery)) {
        included.add(row.id)
        changed = true
      }
    }
  }
  const galleryRows = rows.filter((row) => included.has(row.id)).map((row) => ({
    id: row.id, title: row.title, photoCount: Number(row.photoCount),
  }))
  return reply.send({ success: true, data: {
    galleryCount: galleryRows.length,
    photoCount: galleryRows.reduce((sum, row) => sum + row.photoCount, 0),
    galleries: galleryRows,
  } })
}

export const listCompanyContacts = async (request, reply) => {
  const { companyId } = request.params
  if (!await ownedCompany(request, companyId)) return reply.code(404).send({ success: false, message: "Société introuvable" })
  const data = await db.select({
    id: companyContacts.id,
    firstname: companyContacts.firstname,
    lastname: companyContacts.lastname,
    email: companyContacts.email,
    phone: companyContacts.phone,
    remindersEnabled: companyContacts.remindersEnabled,
  }).from(companyContacts).where(eq(companyContacts.companyId, companyId))
  return reply.send({ success: true, data })
}

export const createCompanyContact = async (request, reply) => {
  const { companyId } = request.params
  if (!await ownedCompany(request, companyId)) return reply.code(404).send({ success: false, message: "Société introuvable" })
  const { firstname, lastname, email, phone } = request.body ?? {}
  if (!firstname?.trim() || !lastname?.trim() || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return reply.code(400).send({ success: false, message: "Contact invalide" })
  }
  const [contact] = await db.insert(companyContacts).values({
    companyId, firstname: firstname.trim(), lastname: lastname.trim(),
    email: email?.trim().toLowerCase() || null, phone: phone?.trim() || null,
  }).returning({ id: companyContacts.id, firstname: companyContacts.firstname, lastname: companyContacts.lastname, email: companyContacts.email, phone: companyContacts.phone, remindersEnabled: companyContacts.remindersEnabled })
  return reply.code(201).send({ success: true, data: contact })
}

export const updateCompanyContact = async (request, reply) => {
  const { companyId, contactId } = request.params
  if (!await ownedCompany(request, companyId)) return reply.code(404).send({ success: false, message: "Société introuvable" })
  const { firstname, lastname, email, phone, remindersEnabled } = request.body ?? {}
  if (!firstname?.trim() || !lastname?.trim() || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return reply.code(400).send({ success: false, message: "Contact invalide" })
  }
  const [contact] = await db.update(companyContacts).set({
    firstname: firstname.trim(), lastname: lastname.trim(),
    email: email?.trim().toLowerCase() || null, phone: phone?.trim() || null,
    ...(typeof remindersEnabled === "boolean" ? { remindersEnabled } : {}),
  }).where(and(eq(companyContacts.id, contactId), eq(companyContacts.companyId, companyId)))
    .returning({ id: companyContacts.id, firstname: companyContacts.firstname, lastname: companyContacts.lastname, email: companyContacts.email, phone: companyContacts.phone, remindersEnabled: companyContacts.remindersEnabled })
  if (!contact) return reply.code(404).send({ success: false, message: "Contact introuvable" })
  return reply.send({ success: true, data: contact })
}

export const deleteCompanyContact = async (request, reply) => {
  const { companyId, contactId } = request.params
  if (!await ownedCompany(request, companyId)) return reply.code(404).send({ success: false, message: "Société introuvable" })
  const [contact] = await db.delete(companyContacts)
    .where(and(eq(companyContacts.id, contactId), eq(companyContacts.companyId, companyId)))
    .returning({ id: companyContacts.id })
  if (!contact) return reply.code(404).send({ success: false, message: "Contact introuvable" })
  return reply.send({ success: true })
}
