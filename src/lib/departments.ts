/** Search aliases passed to Amazon's completion `alias` parameter. */
export interface Department {
  id: string
  label: string
}

/**
 * Aliases checked on 2026-11-21 against completion.amazon.com (and stripbooks on .de).
 * `electronics` answered with a short list; the JSON shape was still valid.
 * Other rows are Amazon's public search-alias values for the same endpoint.
 */
export const DEPARTMENTS: readonly Department[] = [
  { id: 'aps', label: 'All departments' },
  { id: 'stripbooks', label: 'Books' },
  { id: 'digital-text', label: 'Kindle' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'garden', label: 'Home & Garden' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'toys-and-games', label: 'Toys & Games' },
  { id: 'sporting', label: 'Sports' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'hpc', label: 'Health' },
  { id: 'office-products', label: 'Office' },
]

const IDS = new Set(DEPARTMENTS.map((item) => item.id))

export function normalizeDepartment(value: string | null | undefined): string {
  const id = (value ?? '').replace(/^search-alias=/, '').trim()
  return IDS.has(id) ? id : 'aps'
}

export function departmentLabel(id: string): string {
  return DEPARTMENTS.find((item) => item.id === id)?.label ?? 'All departments'
}
