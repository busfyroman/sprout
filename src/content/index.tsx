import { Sprout } from 'lucide-react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { readMarketplace, readPageSeed } from '../lib/page-context'
import cssText from '../styles/globals.css?inline'
import { App } from '../ui/App'

const HOST_ID = 'sprout-amazon-suggestion-expander'

function currentSeed(): string {
  const field = document.querySelector<HTMLInputElement>('#twotabsearchtextbox, input[name="field-keywords"]')
  return readPageSeed(location.href, field?.value ?? '')
}

function Overlay() {
  const marketplace = readMarketplace(location.hostname)
  const [liveSeed, setLiveSeed] = useState(currentSeed)
  const [open, setOpen] = useState(false)
  const [sessionSeed, setSessionSeed] = useState<string | null>(null)
  const expanded = open && sessionSeed !== null

  useEffect(() => {
    const host = document.getElementById(HOST_ID)
    if (!host) return
    if (expanded) {
      host.style.height = 'min(640px, calc(100vh - 32px))'
      host.style.maxHeight = 'calc(100vh - 32px)'
      host.style.overflow = 'hidden'
    } else {
      host.style.height = 'auto'
      host.style.maxHeight = 'none'
      host.style.overflow = 'visible'
    }
  }, [expanded])

  useEffect(() => {
    const id = window.setInterval(() => setLiveSeed(currentSeed()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="sprout-app text-ink">
      {sessionSeed !== null && (
        <div className={open ? 'block' : 'hidden'}>
          <App
            surface="overlay"
            pageSeed={sessionSeed}
            pageMarketplaceId={marketplace?.id}
            onCollapse={() => setOpen(false)}
          />
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => {
            const seed = currentSeed()
            setLiveSeed(seed)
            setSessionSeed((current) => current ?? seed)
            setOpen(true)
          }}
          className="flex max-w-[min(280px,calc(100vw-28px))] items-center gap-2 rounded-full border border-line bg-cream py-1.5 pr-3 pl-1.5 text-left shadow-[0_12px_32px_rgba(28,25,21,0.2)]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[#f4e4ce]">
            <Sprout className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{liveSeed || 'Sprout'}</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Expand suggestions</span>
          </span>
        </button>
      )}
    </div>
  )
}

function mount(): void {
  if (window.top !== window) return
  if (document.getElementById(HOST_ID)) return
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
    return
  }
  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.all = 'initial'
  host.style.position = 'fixed'
  host.style.zIndex = '2147483646'
  host.style.right = '16px'
  host.style.bottom = '16px'
  host.style.display = 'flex'
  host.style.flexDirection = 'column'
  host.style.width = 'max-content'
  host.style.maxWidth = 'calc(100vw - 24px)'
  host.style.height = 'min(640px, calc(100vh - 32px))'
  host.style.maxHeight = 'calc(100vh - 32px)'
  host.style.overflow = 'hidden'
  host.style.colorScheme = 'light'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = cssText
  const mountPoint = document.createElement('div')
  mountPoint.style.display = 'flex'
  mountPoint.style.flexDirection = 'column'
  mountPoint.style.height = '100%'
  mountPoint.style.minHeight = '0'
  mountPoint.style.overflow = 'hidden'
  shadow.append(style, mountPoint)
  document.documentElement.appendChild(host)
  createRoot(mountPoint).render(
    <StrictMode>
      <Overlay />
    </StrictMode>,
  )
}

mount()
