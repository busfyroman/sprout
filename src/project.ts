/**
 * Public URLs for Sprout. Change this file, then keep docs/privacy.html,
 * the README, and the issue templates on the same repo and privacy URL.
 */
export const PROJECT = {
  repoUrl: 'https://github.com/busfyroman/sprout',
  issuesUrl: 'https://github.com/busfyroman/sprout/issues',
  newIssueUrl: 'https://github.com/busfyroman/sprout/issues/new/choose',
  privacyUrl: 'https://busfyroman.github.io/sprout/privacy.html',
} as const

/** Chrome Web Store name. Must stay at or under 75 characters. */
export const EXTENSION_NAME = 'Sprout – Amazon Keyword Research for Sellers'

/** Chrome Web Store and manifest summary. Must stay at or under 132 characters. */
export const EXTENSION_DESCRIPTION =
  'Free Amazon keyword research. Expand one seed into autocomplete suggestions. No account, no tracking, not affiliated with Amazon.'

export function storeReviewUrl(): string {
  const id = typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : ''
  return id ? `https://chromewebstore.google.com/detail/${id}/reviews` : 'https://chromewebstore.google.com/'
}

export function openExternal(url: string): void {
  try {
    chrome.tabs.create({ url }, () => {
      void chrome.runtime.lastError
    })
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}
