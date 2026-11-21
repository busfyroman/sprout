# Changelog

## 1.0.2

Stop cancels the run from every Sprout surface and does not start another one. The partial list stays on screen, history records one Stopped entry, and a later Saved entry is not written. Capped Amazon result lines show as `5,000+`. The word-count filter counts numbers such as `0.5`. Product-code spec lines are left out of page terms and exclude chips. The translated seed stays after Expand. Checked rows label the export button `Export 3 checked`.

## 1.0.1

Chrome Web Store locales. The manifest sets `default_locale` to `en` and uses `__MSG_extName__` and `__MSG_extDescription__`. Message catalogs for English, German, Spanish, French, Italian, and Slovak live in `_locales`. The side panel and keyword table use `chrome.i18n.getMessage`, with the English string as the fallback.

## 1.0.0

First store release. The name is Sprout – Amazon Keyword Research for Sellers. The seed field keeps spaces while typing. Stop cancels the queue and says Stopped. Space on asks only for `seed letter`, not the joined form as well. Result counts read “N results for” and “1-48 of N results”, and a failed read explains itself. Related searches and brand filters come from the Amazon page. A completion host that returns 502 is skipped for the rest of the session. Books and Kindle send `alias` and `search-alias`. The package asks only for `storage`, `sidePanel`, and the Amazon storefront and completion hosts already used for suggestions. A privacy page, a feedback link, and a one-time rating note after three finished runs are included. Listing text for English, German, Spanish, French, and Italian is in `store/LISTING.md`.

## 0.3.0

Department-scoped suggestions, deeper connector expansion, word analysis, before/after/between filters, KDP boxes, on-demand Amazon result counts, related searches, on-device translation when the browser has it, and competitor names as exclude chips. Result counts stay labeled as result counts.

## 0.2.2

The keyword table opens from every panel. The old placeholder seed is cleared. CSV no longer repeats the run-wide marketplace. The on-page footer no longer covers the last row.

## 0.2.1

Autocomplete requests call `fetch` with the page as `this`, so Expand works in Chrome. Failed prefixes and failed runs are recorded.

## 0.2.0

Search-term builder, exclusions, starred keywords, multi-marketplace runs, history, and the keyword table. All of it stays on the device.

## 0.1.0

Seed expansion through Amazon’s public suggestion endpoint, with popup, side panel, and an on-page button.
