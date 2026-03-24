import { HttpStatus } from "./HttpStatus"

export const respond = (
  reply,
  { status, message = null, data = null, validation = null }
) => {
  if (typeof status === "function") {
    status = status()
  }
  return reply.status(status.code).send({
    success: status.code < 400,
    code: status.code,
    message: message ?? status.message ?? null,
    data,
    validation,
  })
}

export const success = (reply, { data = null, message = null } = {}) => {
  return respond(reply, {
    status: HttpStatus.ok,
    message,
    data,
  })
}

export const created = (reply, { data = null, message = null } = {}) => {
  return respond(reply, {
    status: HttpStatus.created,
    message,
    data,
  })
}

export const error = (
  reply,
  { status, message = null, data = null, validation = null }
) => {
  return respond(reply, {
    status,
    message,
    data,
    validation,
  })
}
