const ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  "Couldn't resolve component",
]

export function isDynamicImportError(error: Error): boolean {
  const message = error.message.toLowerCase()
  return ERROR_PATTERNS.some(p => message.includes(p.toLowerCase()))
}
