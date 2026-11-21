function configureSidePanel(): void {
  if (!chrome.sidePanel?.setPanelBehavior) return
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
}

configureSidePanel()
chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel()
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || message.type !== 'sprout:open-side-panel') return
  const windowId = sender.tab?.windowId
  if (windowId == null || !chrome.sidePanel?.open) {
    sendResponse({ ok: false })
    return
  }
  void chrome.sidePanel.open({ windowId }).then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false }),
  )
  return true
})
