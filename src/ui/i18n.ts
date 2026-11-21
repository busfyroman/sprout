/** Chrome locale lookup. English is the fallback when the API is missing or the key is empty. */
export function t(key: string, fallback: string, substitutions?: string | string[]): string {
  const getMessage = globalThis.chrome?.i18n?.getMessage
  if (typeof getMessage === 'function') {
    try {
      const message = substitutions == null ? getMessage(key) : getMessage(key, substitutions)
      if (message) return message
    } catch {
      // Unit tests and non-extension pages have no i18n catalog.
    }
  }
  if (substitutions == null) return fallback
  const values = Array.isArray(substitutions) ? substitutions : [substitutions]
  return fallback.replace(/\$(\d+)/g, (_, index) => values[Number(index) - 1] ?? '')
}

const DEPT_KEYS: Record<string, string> = {
  aps: 'deptAll',
  stripbooks: 'deptBooks',
  'digital-text': 'deptKindle',
  fashion: 'deptFashion',
  electronics: 'deptElectronics',
  garden: 'deptGarden',
  kitchen: 'deptKitchen',
  'toys-and-games': 'deptToys',
  sporting: 'deptSports',
  beauty: 'deptBeauty',
  hpc: 'deptHealth',
  'office-products': 'deptOffice',
}

export function departmentName(id: string, english: string): string {
  return t(DEPT_KEYS[id] ?? 'deptAll', english)
}
