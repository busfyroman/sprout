import { acceptLanguage, endpointHost, suggestionUrl, type EndpointKind } from './endpoints'
import { REQUEST_LIMITS } from './limits'
import type { Marketplace } from './marketplaces'
import { parseSuggestionPayload, UnexpectedSuggestionError } from './parse'

const RETRYABLE_STATUS = new Set([403, 408, 425, 429, 500, 502, 503, 504])

export interface SuggestionBatch {
  values: string[]
  endpoint: EndpointKind
  host: string
  url: string
}

export class AmazonSuggestError extends Error {
  readonly status?: number
  readonly host: string
  readonly kind: 'network' | 'http' | 'unexpected' | 'aborted'

  constructor(
    message: string,
    options: { status?: number; host: string; kind: AmazonSuggestError['kind'] },
  ) {
    super(message)
    this.name = 'AmazonSuggestError'
    this.status = options.status
    this.host = options.host
    this.kind = options.kind
  }
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return error.name === 'AbortError'
  }
  return error instanceof AmazonSuggestError && error.kind === 'aborted'
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'Unknown error'
}

export type FailureKind = 'network' | 'http' | 'unexpected' | 'aborted'

/** Network and HTTP failures come from Amazon. Anything else is a bug in Sprout. */
export function describeFailure(error: unknown): { kind: FailureKind; message: string } {
  if (error instanceof AmazonSuggestError) return { kind: error.kind, message: error.message }
  if (isAbortError(error)) return { kind: 'aborted', message: 'The expansion was stopped.' }
  const message = error instanceof Error ? error.message.trim() : 'Unknown error'
  if (/illegal invocation|is not a function/i.test(message)) {
    return {
      kind: 'unexpected',
      message: `Sprout hit an internal error before the request was sent (${message}). This is not a network or Amazon failure.`,
    }
  }
  if (error instanceof TypeError) {
    return { kind: 'network', message: `Couldn’t reach Amazon (${message}).` }
  }
  return { kind: 'unexpected', message: `Sprout hit an unexpected error (${message}). This is not a network or Amazon failure.` }
}

export function formatFailedPrefixes(prefixes: readonly string[], limit = 6): string {
  const shown = prefixes.slice(0, limit).map((prefix) => `“${prefix}”`).join(', ')
  const extra = prefixes.length > limit ? ` and ${prefixes.length - limit} more` : ''
  return `${shown}${extra}`
}

export type SleepFn = (ms: number, signal: AbortSignal) => Promise<void>

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal.aborted) return Promise.reject(abortError())
    return Promise.resolve()
  }
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function abortError(): DOMException {
  return new DOMException('The expansion was stopped.', 'AbortError')
}

export class Pacer {
  private nextAt = 0
  private gap: number

  constructor(
    private readonly minGap: number,
    private readonly maxGap: number,
    private readonly sleepFn: SleepFn,
  ) {
    this.gap = minGap
  }

  async wait(signal: AbortSignal): Promise<void> {
    const now = Date.now()
    const jitter = this.minGap === 0 ? 0 : Math.floor(Math.random() * 40)
    const at = Math.max(now, this.nextAt)
    this.nextAt = at + this.gap + jitter
    const delay = at - now
    if (delay > 0) await this.sleepFn(delay, signal)
  }

  penalize(): void {
    this.gap = Math.min(this.maxGap, Math.max(this.minGap + 40, Math.round(this.gap * 1.7)))
    this.nextAt = Math.max(this.nextAt, Date.now() + this.gap)
  }

  relax(): void {
    this.gap = Math.max(this.minGap, Math.round(this.gap * 0.9))
  }
}

export interface ClientContext {
  retries: number
  backoffBaseMs: number
  timeoutMs: number
  pacer: Pacer
  sleepFn: SleepFn
  fetchImpl: typeof fetch
}

export function createClientContext(overrides?: {
  retries?: number
  backoffBaseMs?: number
  timeoutMs?: number
  gapMs?: number
  maxGapMs?: number
  sleepFn?: SleepFn
  fetchImpl?: typeof fetch
}): ClientContext {
  const sleepFn = overrides?.sleepFn ?? sleep
  const fetchImpl = overrides?.fetchImpl ?? callGlobalFetch
  return {
    retries: overrides?.retries ?? REQUEST_LIMITS.retries,
    backoffBaseMs: overrides?.backoffBaseMs ?? REQUEST_LIMITS.backoffBaseMs,
    timeoutMs: overrides?.timeoutMs ?? REQUEST_LIMITS.timeoutMs,
    sleepFn,
    fetchImpl,
    pacer: new Pacer(
      overrides?.gapMs ?? REQUEST_LIMITS.gapMs,
      overrides?.maxGapMs ?? REQUEST_LIMITS.maxGapMs,
      sleepFn,
    ),
  }
}

/**
 * `const f = fetch; f(url)` throws "Illegal invocation" in Chrome because
 * `this` is no longer the window. Call the global as a property access.
 */
export function callGlobalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init)
}

export async function fetchBatch(
  marketplace: Marketplace,
  prefix: string,
  endpoint: EndpointKind,
  signal: AbortSignal,
  ctx: ClientContext,
): Promise<SuggestionBatch> {
  const host = endpointHost(marketplace, endpoint)
  const url = suggestionUrl(marketplace, prefix, endpoint)
  let lastError: AmazonSuggestError | null = null

  for (let attempt = 0; attempt < ctx.retries; attempt++) {
    await ctx.pacer.wait(signal)
    try {
      const values = await fetchOnce(url, host, marketplace.locale, signal, ctx)
      ctx.pacer.relax()
      return { values, endpoint, host, url }
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw abortError()
      }
      if (!(error instanceof AmazonSuggestError)) throw error
      lastError = error
      const retryable = error.kind === 'network' || (error.kind === 'http' && error.status != null && RETRYABLE_STATUS.has(error.status))
      if (!retryable || attempt === ctx.retries - 1) throw error
      ctx.pacer.penalize()
      await ctx.sleepFn(ctx.backoffBaseMs * 2 ** attempt, signal)
    }
  }

  throw lastError ?? new AmazonSuggestError(`No response from ${host}.`, { host, kind: 'network' })
}

async function fetchOnce(
  url: string,
  host: string,
  locale: string,
  signal: AbortSignal,
  ctx: ClientContext,
): Promise<string[]> {
  const timeout = AbortSignal.timeout(ctx.timeoutMs)
  const combined = AbortSignal.any([signal, timeout])
  let response: Response
  try {
    response = await ctx.fetchImpl(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal: combined,
      headers: {
        Accept: 'application/json, text/javascript, */*;q=0.1',
        'Accept-Language': acceptLanguage(locale),
      },
    })
  } catch (error) {
    if (signal.aborted) throw abortError()
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AmazonSuggestError(`Timed out waiting for ${host}.`, { host, kind: 'network' })
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AmazonSuggestError(`Timed out waiting for ${host}.`, { host, kind: 'network' })
    }
    const failure = describeFailure(error)
    throw new AmazonSuggestError(failure.message, { host, kind: failure.kind === 'aborted' ? 'network' : failure.kind })
  }

  if (!response.ok) {
    throw new AmazonSuggestError(httpMessage(response.status, host), {
      host,
      status: response.status,
      kind: 'http',
    })
  }

  const text = (await response.text()).replace(/^\uFEFF/, '').trim()
  const contentType = response.headers.get('content-type') ?? 'unknown type'
  if (!text || text.startsWith('<') || text.startsWith('<!')) {
    throw new AmazonSuggestError(
      `${host} returned ${contentType} instead of suggestion JSON. The endpoint may have changed.`,
      { host, status: response.status, kind: 'unexpected' },
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new AmazonSuggestError(
      `${host} returned ${contentType} that isn’t JSON. The endpoint may have changed.`,
      { host, status: response.status, kind: 'unexpected' },
    )
  }

  try {
    return parseSuggestionPayload(payload)
  } catch (error) {
    if (error instanceof UnexpectedSuggestionError) {
      throw new AmazonSuggestError(
        `${host} returned JSON without a suggestions list. The endpoint may have changed.`,
        { host, status: response.status, kind: 'unexpected' },
      )
    }
    throw error
  }
}

function httpMessage(status: number, host: string): string {
  if (status === 429) return `Amazon rate-limited ${host} (HTTP 429).`
  if (status === 403) return `Amazon blocked the request to ${host} (HTTP 403).`
  if (status === 404 || status === 410) {
    return `Amazon’s suggestion endpoint on ${host} was not found (HTTP ${status}). It may have moved.`
  }
  if (status >= 500) return `${host} returned HTTP ${status}.`
  return `${host} returned HTTP ${status}.`
}

export class ProbeFailedError extends Error {
  readonly kind: FailureKind

  constructor(marketplace: Marketplace, primary: unknown, secondary: unknown) {
    const left = describeFailure(primary)
    const right = describeFailure(secondary)
    const kind: FailureKind = left.kind === 'unexpected' || right.kind === 'unexpected'
      ? 'unexpected'
      : left.kind === 'http' || right.kind === 'http'
        ? 'http'
        : 'network'
    const message = kind === 'unexpected'
      ? `Couldn’t load suggestions for ${marketplace.domain}. ${left.kind === 'unexpected' ? left.message : right.message}`
      : `Couldn’t load suggestions for ${marketplace.domain}. ${marketplace.completionHost}: ${left.message} ${marketplace.storefrontHost}: ${right.message}`
    super(message)
    this.name = 'ProbeFailedError'
    this.kind = kind
  }
}
