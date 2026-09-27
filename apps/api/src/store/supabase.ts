const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'https://vrodyomwovvnjxcfreqz.supabase.co'

const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_B44RJxS0hIPHYZtilQ32Pw_bRleMXrl'

type QueryOptions = {
  select?: string
  order?: string
  limit?: number
  single?: boolean
}

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

function tableUrl(table: string, params: URLSearchParams = new URLSearchParams()) {
  return `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`
}

export async function insert<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const response = await fetch(tableUrl(table), {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  })
  if (!response.ok) throw new Error(`Supabase insert ${table}: ${await response.text()}`)
  const rows = await response.json() as T[]
  return rows[0]
}

export async function select<T>(
  table: string,
  filters: Record<string, string> = {},
  options: QueryOptions = {}
): Promise<T[]> {
  const params = new URLSearchParams()
  params.set('select', options.select ?? '*')
  for (const [key, value] of Object.entries(filters)) params.set(key, `eq.${value}`)
  if (options.order) params.set('order', options.order)
  if (options.limit) params.set('limit', String(options.limit))

  const response = await fetch(tableUrl(table, params), {
    headers: headers(),
  })
  if (!response.ok) throw new Error(`Supabase select ${table}: ${await response.text()}`)
  return response.json() as Promise<T[]>
}

export async function update(
  table: string,
  filters: Record<string, string>,
  patch: Record<string, unknown>
): Promise<void> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) params.set(key, `eq.${value}`)

  const response = await fetch(tableUrl(table, params), {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`Supabase update ${table}: ${await response.text()}`)
}

export async function count(
  table: string,
  filters: Record<string, string> = {}
): Promise<number> {
  const params = new URLSearchParams()
  params.set('select', 'id')
  params.set('limit', '0')
  for (const [key, value] of Object.entries(filters)) params.set(key, `eq.${value}`)

  const response = await fetch(tableUrl(table, params), {
    headers: headers({ Prefer: 'count=exact' }),
  })
  if (!response.ok) throw new Error(`Supabase count ${table}: ${await response.text()}`)
  const range = response.headers.get('content-range')
  if (!range) return 0
  const total = range.split('/')[1]
  return total && total !== '*' ? Number(total) : 0
}

export async function remove(
  table: string,
  filters: Record<string, string>
): Promise<void> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) params.set(key, `eq.${value}`)
  const response = await fetch(tableUrl(table, params), {
    method: 'DELETE',
    headers: headers(),
  })
  if (!response.ok) throw new Error(`Supabase delete ${table}: ${await response.text()}`)
}
