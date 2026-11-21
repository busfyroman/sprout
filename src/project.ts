/**
 * Public URLs for Sprout. This is the only place the Chrome Web Store link is defined.
 * docs/index.html must use storeUrl as the Add to Chrome href. The release test checks that.
 * Replace EXTENSION_ID after the listing exists, and update that one href to match.
 */
export const PROJECT = {
  repoUrl: 'https://github.com/busfyroman/sprout',
  issuesUrl: 'https://github.com/busfyroman/sprout/issues',
  newIssueUrl: 'https://github.com/busfyroman/sprout/issues/new/choose',
  privacyUrl: 'https://busfyroman.github.io/sprout/privacy.html',
  storeUrl: 'https://chromewebstore.google.com/detail/sprout/EXTENSION_ID',
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
