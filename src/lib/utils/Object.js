export const filterObject = (object, toFilter, onKeys = true) => {
  return Object.entries(object).reduce((filtered, [key, value]) => {
    if (toFilter.includes(onKeys ? key : value)) {
      filtered[key] = value
    }
    return filtered
  }, {})
}
