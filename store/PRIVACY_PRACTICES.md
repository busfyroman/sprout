# Chrome Web Store privacy practices

Answers for the Privacy practices tab. Sprout does not collect data for its developer. It does send the keyword the user typed to Amazon, because that is the request the user just made.

## Single purpose

Fetches public Amazon autocomplete for a keyword the user enters, and lets them copy or export that list. Optional result-count and related-search reads happen only after a click and stay in the browser.

## Permissions

| Permission | Justification to paste |
| --- | --- |
| storage | Saves the last seed, marketplace, options, keyword list, and the dismissed rating note on this device. Nothing is uploaded. |
| sidePanel | Keeps a longer expansion open beside an Amazon page. |
| Host `https://completion.amazon.<domain>/*` | Reads Amazon’s public autocomplete API for each marketplace in the selector. One host per store, not a wildcard over every Amazon site. |
| Host `https://www.amazon.<domain>/*` | Fallback suggestion URL when the completion host fails, the on-page panel, and a search-results page only when the user asks for a result count or related searches. |

Not requested: `tabs`, `history`, `cookies`, `downloads`, `<all_urls>`, Seller Central, AWS, or any host outside `www.amazon.<store>` and `completion.amazon.<store>`.

The on-page bundle is listed under `web_accessible_resources` only for those `www.amazon.<store>` origins. It is the extension’s own script, required so the Amazon page can show the panel. It is not remote code.

## Remote code

No. The package contains only the extension’s own scripts. `content_security_policy.extension_pages` is `script-src 'self'; object-src 'self'`. There is no `eval`, no external script URL, and no update URL that loads code.

## Data use

**Does the developer collect user data?** No. There is no Sprout server, account, or analytics.

**Does the extension transmit user data?** Yes, to Amazon, at the user’s request:

- The seed and the expanded prefixes go to Amazon’s public suggestion endpoint.
- A result-count or related-search click fetches an Amazon search page in the user’s browser.
- The on-page panel reads the current Amazon URL, search box, department, product title, related searches, and visible store names. Those strings stay on the device unless the user expands one of them.

Do not certify that the item neither collects nor transmits any user data. Certify the three use limits:

- I do not sell or transfer user data to third parties, apart from the Amazon requests the user just started.
- I do not use or transfer user data for purposes that are unrelated to the item’s single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Suggested categories if the form asks what is transmitted, not stored by the developer:

- User activity: the keyword the user types, sent to Amazon’s suggestion API.
- Website content: the current Amazon search, department, title, related searches, and store name, read to fill the panel.

Not collected and not needed: personally identifiable information, health, financial or payment information, authentication information, personal communications, location, web history beyond the open Amazon page, or email.

## Privacy policy URL

https://busfyroman.github.io/sprout/privacy.html
