const URL_PATTERNS = [
  /Failed to fetch dynamically imported module:\s*(.+)/i,
  /error loading dynamically imported module:\s*(.+)/i,
  /Importing a module script failed.*?((?:https?:\/\/|[.\/])[^\s"']+)/i,
]

export function extractFailedUrl(error: Error): string | null {
  for (const pattern of URL_PATTERNS) {
    const match = error.message.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}
