export class HttpStatus {
  // 1xx – Informational
  static continue(message = "Continue") {
    return { message, code: 100 }
  }
  static switchingProtocols(message = "Switching Protocols") {
    return { message, code: 101 }
  }
  static processing(message = "Processing") {
    return { message, code: 102 }
  }
  static 100(...args) {
    return HttpStatus.continue(...args)
  }
  static 101(...args) {
    return HttpStatus.switchingProtocols(...args)
  }
  static 102(...args) {
    return HttpStatus.processing(...args)
  }

  // 2xx – Success

  static ok(message = "OK") {
    return { message, code: 200 }
  }
  static created(message = "Created") {
    return { message, code: 201 }
  }
  static accepted(message = "Accepted") {
    return { message, code: 202 }
  }
  static nonAuthoritative(message = "Non-Authoritative Information") {
    return { message, code: 203 }
  }
  static noContent(message = "No Content") {
    return { message, code: 204 }
  }
  static resetContent(message = "Reset Content") {
    return { message, code: 205 }
  }
  static partialContent(message = "Partial Content") {
    return { message, code: 206 }
  }
  static multiStatus(message = "Multi-Status") {
    return { message, code: 207 }
  }
  static alreadyReported(message = "Already Reported") {
    return { message, code: 208 }
  }
  static imUsed(message = "IM Used") {
    return { message, code: 226 }
  }
  static 200(...args) {
    return HttpStatus.ok(...args)
  }
  static 201(...args) {
    return HttpStatus.created(...args)
  }
  static 202(...args) {
    return HttpStatus.accepted(...args)
  }
  static 203(...args) {
    return HttpStatus.nonAuthoritative(...args)
  }
  static 204(...args) {
    return HttpStatus.noContent(...args)
  }
  static 205(...args) {
    return HttpStatus.resetContent(...args)
  }
  static 206(...args) {
    return HttpStatus.partialContent(...args)
  }
  static 207(...args) {
    return HttpStatus.multiStatus(...args)
  }
  static 208(...args) {
    return HttpStatus.alreadyReported(...args)
  }
  static 226(...args) {
    return HttpStatus.imUsed(...args)
  }

  // 3xx – Redirection
  static multipleChoices(message = "Multiple Choices") {
    return { message, code: 300 }
  }
  static movedPermanently(message = "Moved Permanently") {
    return { message, code: 301 }
  }
  static found(message = "Found") {
    return { message, code: 302 }
  }
  static seeOther(message = "See Other") {
    return { message, code: 303 }
  }
  static notModified(message = "Not Modified") {
    return { message, code: 304 }
  }
  static useProxy(message = "Use Proxy") {
    return { message, code: 305 }
  }
  static temporaryRedirect(message = "Temporary Redirect") {
    return { message, code: 307 }
  }
  static permanentRedirect(message = "Permanent Redirect") {
    return { message, code: 308 }
  }
  static 300(...args) {
    return HttpStatus.multipleChoices(...args)
  }
  static 301(...args) {
    return HttpStatus.movedPermanently(...args)
  }
  static 302(...args) {
    return HttpStatus.found(...args)
  }
  static 303(...args) {
    return HttpStatus.seeOther(...args)
  }
  static 304(...args) {
    return HttpStatus.notModified(...args)
  }
  static 305(...args) {
    return HttpStatus.useProxy(...args)
  }
  static 307(...args) {
    return HttpStatus.temporaryRedirect(...args)
  }
  static 308(...args) {
    return HttpStatus.permanentRedirect(...args)
  }

  // 4xx – Client Error
  static badRequest(message = "Bad Request") {
    return { message, code: 400 }
  }
  static unauthorized(message = "Unauthorized") {
    return { message, code: 401 }
  }
  static paymentRequired(message = "Payment Required") {
    return { message, code: 402 }
  }
  static forbidden(message = "Forbidden") {
    return { message, code: 403 }
  }
  static notFound(message = "Not Found") {
    return { message, code: 404 }
  }
  static methodNotAllowed(message = "Method Not Allowed") {
    return { message, code: 405 }
  }
  static notAcceptable(message = "Not Acceptable") {
    return { message, code: 406 }
  }
  static proxyAuthRequired(message = "Proxy Authentication Required") {
    return { message, code: 407 }
  }
  static requestTimeout(message = "Request Timeout") {
    return { message, code: 408 }
  }
  static conflict(message = "Conflict") {
    return { message, code: 409 }
  }
  static gone(message = "Gone") {
    return { message, code: 410 }
  }
  static lengthRequired(message = "Length Required") {
    return { message, code: 411 }
  }
  static preconditionFailed(message = "Precondition Failed") {
    return { message, code: 412 }
  }
  static payloadTooLarge(message = "Payload Too Large") {
    return { message, code: 413 }
  }
  static uriTooLong(message = "URI Too Long") {
    return { message, code: 414 }
  }
  static unsupportedMediaType(message = "Unsupported Media Type") {
    return { message, code: 415 }
  }
  static rangeNotSatisfiable(message = "Range Not Satisfiable") {
    return { message, code: 416 }
  }
  static expectationFailed(message = "Expectation Failed") {
    return { message, code: 417 }
  }
  static teapot(message = "I'm a teapot") {
    return { message, code: 418 }
  }
  static misdirectedRequest(message = "Misdirected Request") {
    return { message, code: 421 }
  }
  static unprocessable(message = "Unprocessable Entity") {
    return { message, code: 422 }
  }
  static locked(message = "Locked") {
    return { message, code: 423 }
  }
  static failedDependency(message = "Failed Dependency") {
    return { message, code: 424 }
  }
  static tooEarly(message = "Too Early") {
    return { message, code: 425 }
  }
  static upgradeRequired(message = "Upgrade Required") {
    return { message, code: 426 }
  }
  static preconditionRequired(message = "Precondition Required") {
    return { message, code: 428 }
  }
  static tooManyRequests(message = "Too Many Requests") {
    return { message, code: 429 }
  }
  static requestHeaderFieldsTooLarge(
    message = "Request Header Fields Too Large"
  ) {
    return { message, code: 431 }
  }
  static unavailableForLegalReasons(message = "Unavailable For Legal Reasons") {
    return { message, code: 451 }
  }
  static 400(...args) {
    return HttpStatus.badRequest(...args)
  }
  static 401(...args) {
    return HttpStatus.unauthorized(...args)
  }
  static 402(...args) {
    return HttpStatus.paymentRequired(...args)
  }
  static 403(...args) {
    return HttpStatus.forbidden(...args)
  }
  static 404(...args) {
    return HttpStatus.notFound(...args)
  }
  static 405(...args) {
    return HttpStatus.methodNotAllowed(...args)
  }
  static 406(...args) {
    return HttpStatus.notAcceptable(...args)
  }
  static 407(...args) {
    return HttpStatus.proxyAuthRequired(...args)
  }
  static 408(...args) {
    return HttpStatus.requestTimeout(...args)
  }
  static 409(...args) {
    return HttpStatus.conflict(...args)
  }
  static 410(...args) {
    return HttpStatus.gone(...args)
  }
  static 411(...args) {
    return HttpStatus.lengthRequired(...args)
  }
  static 412(...args) {
    return HttpStatus.preconditionFailed(...args)
  }
  static 413(...args) {
    return HttpStatus.payloadTooLarge(...args)
  }
  static 414(...args) {
    return HttpStatus.uriTooLong(...args)
  }
  static 415(...args) {
    return HttpStatus.unsupportedMediaType(...args)
  }
  static 416(...args) {
    return HttpStatus.rangeNotSatisfiable(...args)
  }
  static 417(...args) {
    return HttpStatus.expectationFailed(...args)
  }
  static 418(...args) {
    return HttpStatus.teapot(...args)
  }
  static 421(...args) {
    return HttpStatus.misdirectedRequest(...args)
  }
  static 422(...args) {
    return HttpStatus.unprocessable(...args)
  }
  static 423(...args) {
    return HttpStatus.locked(...args)
  }
  static 424(...args) {
    return HttpStatus.failedDependency(...args)
  }
  static 425(...args) {
    return HttpStatus.tooEarly(...args)
  }
  static 426(...args) {
    return HttpStatus.upgradeRequired(...args)
  }
  static 428(...args) {
    return HttpStatus.preconditionRequired(...args)
  }
  static 429(...args) {
    return HttpStatus.tooManyRequests(...args)
  }
  static 431(...args) {
    HttpStatus.requestHeaderFieldsTooLarge(...args)
  }
  static 451(...args) {
    return HttpStatus.unavailableForLegalReasons(...args)
  }

  // 5xx – Server Error
  static internalError(message = "Internal Server Error") {
    return { message, code: 500 }
  }
  static notImplemented(message = "Not Implemented") {
    return { message, code: 501 }
  }
  static badGateway(message = "Bad Gateway") {
    return { message, code: 502 }
  }
  static serviceUnavailable(message = "Service Unavailable") {
    return { message, code: 503 }
  }
  static gatewayTimeout(message = "Gateway Timeout") {
    return { message, code: 504 }
  }
  static httpVersionNotSupported(message = "HTTP Version Not Supported") {
    return { message, code: 505 }
  }
  static variantAlsoNegotiates(message = "Variant Also Negotiates") {
    return { message, code: 506 }
  }
  static insufficientStorage(message = "Insufficient Storage") {
    return { message, code: 507 }
  }
  static loopDetected(message = "Loop Detected") {
    return { message, code: 508 }
  }
  static notExtended(message = "Not Extended") {
    return { message, code: 510 }
  }
  static networkAuthenticationRequired(
    message = "Network Authentication Required"
  ) {
    return { message, code: 511 }
  }
  static 500(...args) {
    return HttpStatus.internalError(...args)
  }
  static 501(...args) {
    return HttpStatus.notImplemented(...args)
  }
  static 502(...args) {
    return HttpStatus.badGateway(...args)
  }
  static 503(...args) {
    return HttpStatus.serviceUnavailable(...args)
  }
  static 504(...args) {
    return HttpStatus.gatewayTimeout(...args)
  }
  static 505(...args) {
    return HttpStatus.httpVersionNotSupported(...args)
  }
  static 506(...args) {
    return HttpStatus.variantAlsoNegotiates(...args)
  }
  static 507(...args) {
    return HttpStatus.insufficientStorage(...args)
  }
  static 508(...args) {
    return HttpStatus.loopDetected(...args)
  }
  static 510(...args) {
    return HttpStatus.notExtended(...args)
  }
  static 511(...args) {
    HttpStatus.networkAuthenticationRequired(...args)
  }
}
