const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const near = (actual, expected) => Math.abs(actual - expected) <= 2 * HOUR

// The form's calendar presets use the browser's local calendar. Allow for
// daylight-saving changes and the minute precision of datetime-local.
export function defaultGalleryReminders(expiresAt, createdAt = new Date()) {
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return []
  const duration = expiresAt.getTime() - createdAt.getTime()
  if (near(duration, 30 * DAY)) return [{ value: 1, unit: "WEEK" }]
  if (near(duration, 365 * DAY) || near(duration, 366 * DAY)) {
    return [{ value: 1, unit: "MONTH" }, { value: 1, unit: "WEEK" }]
  }
  return []
}
