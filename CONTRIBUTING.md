# Contributing to Sprout

Sprout is free and local. Issues and pull requests are welcome at https://github.com/busfyroman/sprout.

## Before you change behavior

- Do not add a backend, an account, a payment, or a paid keyword API.
- Do not show search volume, CPC, trend scores, or sales. A number from an Amazon results page must stay labeled as a result count.
- Do not call related searches or page terms a reverse ASIN lookup.
- Do not hide a brand until the user clicks exclude.
- Keep host permissions on the specific `www.amazon.<store>` and `completion.amazon.<store>` origins already in `src/lib/marketplaces.ts`. Do not switch them to `<all_urls>` or `*://*.amazon.com/*`.

## Develop

```bash
npm install
npm test
npm run build
```

Load `dist/` as an unpacked extension. `npm run test:browser` runs the panel against live Amazon in Playwright’s Chromium and takes several minutes.

A store upload zip, with `manifest.json` at the root, is `npm run package:cws`.

## Privacy URL

The public policy is https://busfyroman.github.io/sprout/privacy.html. The source of that page is `docs/privacy.html`. GitHub Pages serves the `docs/` folder on `main`. If you change what the extension sends, update `docs/privacy.html` and `PRIVACY.md` in the same change.

Public links live in `src/project.ts`. Keep the README, `docs/privacy.html`, and `.github/ISSUE_TEMPLATE/config.yml` on the same repo URL.

## Releases

Tag `vX.Y.Z` only when `package.json` and `manifest.config.ts` already use that version. The Release workflow builds the extension and attaches `sprout-X.Y.Z-cws.zip` to the GitHub release.
