export function createUpdateObject(schema, obj) {
  const values = Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  )
  const fields = Object.keys(values).reduce((acc, f) => {
    acc[f] = schema[f]
    return acc
  }, {})

  return { values, fields }
}
