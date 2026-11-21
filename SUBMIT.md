# Sprout 1.0.0 — čo vyplniť v Chrome Web Store

Účet vývojára je tvoj. Tento súbor je len zoznam polí. Texty v úvodzovkách sa kopírujú celé. Sprout nie je prepojený s Amazonom. Amazon je ochranná známka Amazon.com, Inc.

Repozitár: https://github.com/busfyroman/sprout
Súkromie (GitHub Pages): https://busfyroman.github.io/sprout/privacy.html

## Balík

1. V **Package** nahraj `sprout-1.0.0-cws.zip`.
2. V zipe je `manifest.json` priamo v koreni, nie v priečinku. Nenahrávaj `sprout-store-assets.zip` ako balík rozšírenia. Ten je len na ikony, snímky a promo.
3. Verzia v manifeste je `1.0.0`.

## Obchod

| Pole | Hodnota |
| --- | --- |
| Visibility | Public |
| Pricing | Free. Žiadna platba, žiadny trial. |
| Category | Shopping |
| Language (hlavný) | English |
| Distribution | All regions |

Ďalšie jazyky výpisu pridaj ako German, Spanish, French a Italian. Texty sú nižšie.

## Item name (anglicky, limit 75)

```
Sprout – Amazon Keyword Research for Sellers
```

## Summary (anglicky, limit 132)

```
Free Amazon keyword research. Expand one seed into autocomplete suggestions. No account, no tracking, not affiliated with Amazon.
```

## Description (anglicky)

```
Sprout is a free keyword expander for Amazon sellers, KDP authors, and Merch designers. It runs in your browser. There is no Sprout account, no payment, and no tracking.

Sprout is not affiliated with, endorsed by, or sponsored by Amazon. Amazon is a trademark of Amazon.com, Inc.

Type one seed. Sprout asks Amazon’s public autocomplete for that seed and for the seed plus every letter and digit — the same suggestions shoppers see as they type. You can glue the letter on, put a space before it, put it in front, or add connector words such as for, with, and, and without. Pick one marketplace or several. A department menu scopes the list (Books, Kindle, Fashion, Electronics, and others). On an Amazon page, Sprout can start from the department you already selected.

Results are deduplicated. Filter them, sort them, star them, and copy them. Download CSV, XLSX, or an Amazon Ads bulk sheet with Campaign, Ad Group, Keyword, and Match Type. The Words tab counts how often each word and pair appears in this list. That is frequency, not search volume. A position filter shows whether extra words sit before, after, or around the seed.

KDP mode fills seven boxes of 50 characters. Words already in the title or subtitle are skipped, and a word is not reused.

Results can fetch Amazon’s search-page result count for rows you check, or for starred rows if none are checked, about one page per second. The label says result count, not search volume. A robot check stops the queue. Sprout never invents search volume, cost per click, trend scores, or sales.

On an Amazon search or product page, related searches and store names become buttons. A brand is hidden only after you click Exclude. These are page terms, not a reverse lookup of a product code.

Marketplaces: United States, United Kingdom, Germany, France, Italy, Spain, Canada, Australia, Japan, Mexico, India, Brazil, Netherlands, Sweden, Poland, Belgium, Ireland, Singapore, United Arab Emirates, Saudi Arabia, Turkey, and Egypt.

Open Sprout from the toolbar, the side panel, or the button on an Amazon page. Privacy policy: https://busfyroman.github.io/sprout/privacy.html
```

## Deutsch

Názov:

```
Sprout – Amazon-Keyword-Recherche für Verkäufer
```

Krátky text:

```
Kostenlose Keyword-Recherche für Amazon. Ein Seed wird zu Autocomplete. Kein Konto, kein Tracking. Nicht mit Amazon verbunden.
```

Dlhý text je v `store/LISTING.md`, časť Deutsch. Skopíruj odsek pod **Beschreibung**.

## Español

Názov:

```
Sprout – Palabras clave de Amazon para vendedores
```

Krátky text:

```
Palabras clave gratis para vendedores de Amazon. Un seed y el autocompletado. Sin cuenta, sin rastreo, sin afiliación.
```

Dlhý text: `store/LISTING.md`, časť Español, pod **Descripción**.

## Français

Názov:

```
Sprout – Mots-clés Amazon pour les vendeurs
```

Krátky text:

```
Mots-clés gratuits pour vendeurs Amazon. Une requête devient des suggestions. Sans compte, sans suivi, sans lien avec Amazon.
```

Dlhý text: `store/LISTING.md`, časť Français, pod **Description**.

## Italiano

Názov:

```
Sprout – Parole chiave Amazon per venditori
```

Krátky text:

```
Parole chiave gratuite per venditori Amazon. Un seed diventa suggerimenti. Nessun account, nessun tracciamento, non affiliato.
```

Dlhý text: `store/LISTING.md`, časť Italiano, pod **Descrizione**.

## Grafika

Nahraj z priečinka `store/`:

- Ikona 128×128: `store/icons/icon128.png`
- Snímky 1280×800, v tomto poradí: `01-expand.png`, `02-words.png`, `03-kdp.png`, `04-terms.png`, `05-table.png` v `store/screenshots/`
- Malý promo obrázok 440×280: `store/promo/small-tile-440x280.png`
- Marquee 1400×560: `store/promo/marquee-1400x560.png`

Na snímkach sú skutočné návrhy z amazon.com pre seed `yoga mat`. Nie sú tam vymyslené objemy hľadania.

## Privacy practices

URL zásady:

```
https://busfyroman.github.io/sprout/privacy.html
```

Jediný účel (Single purpose):

```
Fetches public Amazon autocomplete for a keyword the user enters, and lets them copy or export that list. Optional result-count and related-search reads happen only after a click and stay in the browser.
```

Oprávnenia, každé zvlášť:

`storage`

```
Saves the last seed, marketplace, options, keyword list, and the dismissed rating note on this device. Nothing is uploaded.
```

`sidePanel`

```
Keeps a longer expansion open beside an Amazon page.
```

Hostia `https://completion.amazon.<doména>/*` (každý trh je samostatný hostiteľ, nie `*://*.amazon.com/*`):

```
Reads Amazon’s public autocomplete API for each marketplace in the selector. One host per store, not a wildcard over every Amazon site.
```

Hostia `https://www.amazon.<doména>/*`:

```
Fallback suggestion URL when the completion host fails, the on-page panel, and a search-results page only when the user asks for a result count or related searches.
```

Vzdialený kód (remote code): **No**.

Údaje:

- Vývojár údaje nezbiera. Nie je server, účet ani analytika.
- Rozšírenie posiela na Amazon len to, čo používateľ práve spustil: seed a prefixy na verejný autocomplete, a po kliknutí stránku výsledkov kvôli počtu výsledkov alebo súvisiacim hľadaniam.
- Nezaškrtávaj vetu, že rozšírenie údaje vôbec neprenáša. Zaškrtni tri obmedzenia použitia: nepredávaš údaje tretím stranám mimo účelu rozšírenia, nepoužívaš ich na nesúvisiaci účel a nepoužívaš ich na úverovú bonitu.
- Ak formulár pýta kategóriu prenášaných údajov: User activity (kľúčové slovo, ktoré používateľ napíše) a Website content (aktuálna Amazon stránka: hľadanie, oddelenie, titulok, súvisiace hľadania, názov obchodu). Nie e-mail, zdravie, platby, poloha ani história prehliadania.

Podrobnejšie vety sú v `store/PRIVACY_PRACTICES.md`.

## Po schválení

Hodnotenie v rozšírení otvára stránku recenzií podľa `chrome.runtime.id`. Po zverejnení netreba dopĺňať ID do kódu. Odkaz Spätná väzba ide na https://github.com/busfyroman/sprout/issues.
