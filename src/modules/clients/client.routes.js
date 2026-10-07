import { authenticationMiddleware, adminMiddleware } from "../../lib/middlewares/authentication.js"
import {
  createCompany,
  deleteCompany,
  getAllCompanies,
  getCompany,
  getCompanySummary,
  updateCompany,
  listCompanyContacts,
  createCompanyContact,
  updateCompanyContact,
  deleteCompanyContact,
} from "./client.actions.js"
import {
  createCompanyValidator,
  deleteCompanyValidator,
  getCompanyValidator,
  updateCompanyValidator,
} from "./client.validators.js"

export default function clientRoutes(fastify) {
  fastify.addHook("preHandler", authenticationMiddleware)
  fastify.addHook("preHandler", adminMiddleware)
  const validateContactPath = async (request, reply) => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuid.test(request.params.companyId) || (request.params.contactId && !uuid.test(request.params.contactId))) {
      return reply.code(400).send({ success: false, message: "Identifiant invalide" })
    }
  }
  fastify.get("/companies/:companyId/contacts", { preHandler: [authenticationMiddleware, validateContactPath] }, listCompanyContacts)
  fastify.get("/companies/:companyId/summary", { preHandler: [authenticationMiddleware, validateContactPath] }, getCompanySummary)
  fastify.post("/companies/:companyId/contacts", { preHandler: [authenticationMiddleware, validateContactPath] }, createCompanyContact)
  fastify.put("/companies/:companyId/contacts/:contactId", { preHandler: [authenticationMiddleware, validateContactPath] }, updateCompanyContact)
  fastify.delete("/companies/:companyId/contacts/:contactId", { preHandler: [authenticationMiddleware, validateContactPath] }, deleteCompanyContact)
  fastify.get(
    "/companies/:companyId",
    {
      preHandler: [authenticationMiddleware, getCompanyValidator],
    },
    getCompany
  )
  fastify.get(
    "/companies",
    { preHandler: [authenticationMiddleware] },
    getAllCompanies
  )
  fastify.post(
    "/companies",
    {
      preHandler: [authenticationMiddleware, createCompanyValidator],
    },
    createCompany
  )
  fastify.put(
    "/companies/:companyId",
    {
      preHandler: [authenticationMiddleware, updateCompanyValidator],
    },
    updateCompany
  )
  fastify.delete(
    "/companies/:companyId",
    {
      preHandler: [
        authenticationMiddleware,
        // authorzied
        deleteCompanyValidator,
      ],
    },
    deleteCompany
  )
}
