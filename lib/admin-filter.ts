/**
 * Builds admin path with current filter query params (manager, property).
 * Use for sidebar links and internal admin links so the filter persists.
 */
export function adminPathWithFilter(
  path: string,
  params: { manager?: string | null; property?: string | null }
): string {
  const search = new URLSearchParams()
  if (params.manager) search.set("manager", params.manager)
  if (params.property) search.set("property", params.property)
  const q = search.toString()
  return q ? `${path}?${q}` : path
}
