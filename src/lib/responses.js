import { HttpStatus } from "./HttpStatus"

export const respond = (reply, status, data) => {
  if (typeof status === "function") {
    status = status()
  }

  let response = {
    success: status.code < 400,
    message: status?.message,
    code: status.code,
  }

  if (data?.validation) {
    response.validation = data.validation
    delete data.validation
  }

  response.data = data

  return reply.status(status.code).send(response)
}

export const success = (reply, data) => {
  return respond(
    reply,
    HttpStatus.ok(data?.message || undefined),
    data?.message ? (({ message, ...all }) => all)(data) : data
  )
}

export const created = (reply, data) => {
  return respond(reply, HttpStatus.created(data?.message || undefined), data)
}

export const error = (reply, status, data) => {
  return respond(reply, status, data)
}
