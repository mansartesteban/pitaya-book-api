import { Readable } from "node:stream"

export function webStreamToNode(stream) {
  const reader = stream.getReader()
  return new Readable({
    async read() {
      const { done, value } = await reader.read()
      if (done) {
        this.push(null)
      } else {
        this.push(Buffer.from(value))
      }
    },
  })
}
