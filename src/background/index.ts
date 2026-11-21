function configureSidePanel(): void {
  if (!chrome.sidePanel?.setPanelBehavior) return
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
}

configureSidePanel()
chrome.runtime.onInstalled.addListener(() => {
  configureSidePanel()
})

function viewerUrl(): string {
  return chrome.runtime.getURL('src/viewer/index.html')
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return
  if (message.type === 'sprout:open-table') {
    // openOptionsPage only focuses an existing options tab, and content scripts
    // cannot call chrome.tabs. Creating here always opens a visible tab.
    chrome.tabs.create({ url: viewerUrl(), active: true }).then(
      (tab) => {
        if (tab.windowId != null) void chrome.windows.update(tab.windowId, { focused: true })
        sendResponse({ ok: true })
      },
      (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Could not open the table' }),
    )
    return true
  }
  if (message.type !== 'sprout:open-side-panel') return
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
