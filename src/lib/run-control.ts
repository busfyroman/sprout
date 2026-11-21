const BLOCK_MS = 1500

const live = new Map<number, AbortController>()
const stoppedIds = new Set<number>()

export function resetExpansionGates(): void {
  for (const controller of live.values()) controller.abort()
  live.clear()
  stoppedIds.clear()
}

export interface ExpansionGate {
  begin: () => { ok: true; signal: AbortSignal; startedAt: number } | { ok: false; signal: AbortSignal; startedAt: number }
  /** Stop that run id. Works from a surface that did not start it. */
  stop: (startedAt: number) => boolean
  /** Running and done progress after Stop must not replace the partial list or history. */
  acceptProgress: (status: 'running' | 'done' | 'cancelled' | 'error') => boolean
  readonly startedAt: number
  readonly stopped: boolean
}

/**
 * Surfaces in one extension share the live controllers through this module in a
 * page, and through chrome.storage across pages. Stop always aborts the owner.
 * A second Expand is blocked briefly so the Stop click cannot start a new run.
 */
export function createExpansionGate(now: () => number = Date.now): ExpansionGate {
  let myId = 0
  let blockUntil = 0

  return {
    begin() {
      if (now() < blockUntil) {
        return { ok: false, signal: new AbortController().signal, startedAt: 0 }
      }
      const previous = live.get(myId)
      if (previous && !stoppedIds.has(myId)) {
        stoppedIds.add(myId)
        previous.abort()
      }
      const controller = new AbortController()
      myId = now()
      while (live.has(myId)) myId += 1
      live.set(myId, controller)
      stoppedIds.delete(myId)
      return { ok: true, signal: controller.signal, startedAt: myId }
    },
    stop(id: number) {
      blockUntil = now() + BLOCK_MS
      const controller = live.get(id)
      if (!controller || stoppedIds.has(id)) return false
      stoppedIds.add(id)
      controller.abort()
      return true
    },
    acceptProgress(status) {
      if (!stoppedIds.has(myId)) return true
      return status === 'cancelled'
    },
    get startedAt() {
      return myId
    },
    get stopped() {
      return stoppedIds.has(myId)
    },
  }
}

export const STOP_KEY = 'sprout.stopRequest'

export interface StopRequest {
  startedAt: number
  at: number
}

export async function publishStop(startedAt: number): Promise<void> {
  const request: StopRequest = { startedAt, at: Date.now() }
  try {
    if (chrome.storage?.local) await chrome.storage.local.set({ [STOP_KEY]: request })
  } catch {
    // The owning surface still aborts through the shared gate.
  }
  try {
    chrome.runtime.sendMessage({ type: 'sprout:stop', startedAt }, () => {
      void chrome.runtime.lastError
    })
  } catch {
    // No extension runtime in unit tests.
  }
}

export function subscribeStop(onStop: (startedAt: number) => void): () => void {
  const onMessage = (message: { type?: string; startedAt?: number }) => {
    if (message?.type === 'sprout:stop' && typeof message.startedAt === 'number') onStop(message.startedAt)
  }
  const onChanged: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== 'local' || !changes[STOP_KEY]) return
    const startedAt = (changes[STOP_KEY].newValue as StopRequest | undefined)?.startedAt
    if (typeof startedAt === 'number') onStop(startedAt)
  }
  chrome.runtime?.onMessage?.addListener(onMessage)
  chrome.storage?.onChanged?.addListener(onChanged)
  return () => {
    chrome.runtime?.onMessage?.removeListener(onMessage)
    chrome.storage?.onChanged?.removeListener(onChanged)
  }
}
