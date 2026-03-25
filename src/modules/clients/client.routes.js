import { authenticationMiddleware } from "@/lib/middlewares/authentication"
import {
  createCompany,
  deleteCompany,
  getAllCompanies,
  getCompany,
  updateCompany,
} from "./client.actions"
import {
  createCompanyValidator,
  deleteCompanyValidator,
  getCompanyValidator,
  updateCompanyValidator,
} from "./client.validators"

export default function clientRoutes(fastify) {
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
