# Chrome Web Store listing draft

Category: **Shopping**. Language of the listing: English. An alternate Slovak text is below for a localized listing later.

Host [PRIVACY.md](PRIVACY.md) at a public URL before submit and paste it into the privacy form. Sprout is free. It has no account, no payment, and no tracking. Keyword lists stay in the browser. The form should say the developer does not collect user data. Transfers are user-initiated requests from this browser to Amazon: the public suggestion endpoint, and, only after a click, a search-results page to read a result count or a related-search block. Links the user opens (Amazon search, Google, Google Trends) are ordinary browser navigations. Result counts are labeled as result counts. Sprout does not show search volume, CPC, trend scores, or sales.

## Name

Sprout — Amazon Suggestion Expander

## Short description

Turn one Amazon seed into a–z and 0–9 autocomplete suggestions for seller, KDP, and Merch research.

(99 characters. Store limit is 132.)

## Single purpose

Fetches public Amazon search autocomplete suggestions for a keyword the user enters and lets them copy or export that list.

## Detailed description

Sprout is free. It expands one seed keyword into the autocomplete suggestions Amazon shows shoppers, and it works entirely in the browser. No account, no payment, no tracking, and no search-volume numbers.

Type a seed, pick one or more marketplaces, and Sprout queries each marketplace’s public suggestion service for the seed alone and for the seed plus every letter and digit. You can glue the letter on (`yoga mata`), put it after a space (`yoga mat a`), put it in front, or do all of those. Results are deduplicated and tagged with the expansion and the marketplace that produced them. Filter, sort, star, copy, or download CSV or XLSX.

The Terms tab builds a backend Search Terms string from the most common words in the list, inside a byte limit you can change (249 to start). Click a word to drop it and the next word fills in. Paste your title and bullets so those words are not repeated. Exclude competitor brands and those phrases disappear from the list and from exports.

Stars and the last 20 runs stay on the device. The keyword table opens each phrase on Amazon, Google, and Google Trends. Sprout does not estimate volume or CPC.

A department picker scopes suggestions (Books is `stripbooks`, Kindle is `digital-text`). Deep adds connector words. Expand this grows one phrase, at most two steps. The Words tab counts words and pairs. KDP fills seven 50-character boxes and skips title and subtitle words. Results fetches Amazon’s result count for selected or starred rows only, about one page a second, and stops on a robot check. Related searches and store names on the current Amazon page are buttons; brands are not hidden until you click Exclude. Translate uses Chrome’s on-device translator when the browser has it, otherwise you type the local seed.

Built for Amazon sellers, KDP authors, and Merch on Demand designers who got empty lists from other expanders. If Amazon’s completion host fails or changes shape, Sprout retries with backoff and falls back to the storefront suggestions URL, then tells you which host answered. It does not invent keywords when the request fails.

Marketplaces: United States, United Kingdom, Germany, France, Italy, Spain, Canada, Australia, Japan, Mexico, India, Brazil, Netherlands, Sweden, Poland, Belgium, Ireland, Singapore, United Arab Emirates, Saudi Arabia, Turkey, and Egypt.

Open it from the toolbar, from the side panel, from the keyword table, or from the small pill on an Amazon search page, which picks up the term you just searched.

## Permission justifications

| Permission | Why |
| --- | --- |
| storage | Save the last seed, marketplace, options, and result list on the device. |
| sidePanel | Keep a longer expansion open beside Amazon. |
| Hosts `https://completion.amazon.<domain>/*` | Read the public autocomplete API for each marketplace in the selector. |
| Hosts `https://www.amazon.<domain>/*` | Fallback suggestions URL when the completion host fails, the on-page panel, and on-demand search pages for a result count or related searches. |

The extension does not request tabs, history, cookies, downloads, or `<all_urls>`.

## Graphics

- Icon: `src/assets/icons/icon128.png` (also 16, 32, 48).
- Screenshot: `docs/sprout-yoga-mat.png` — popup after a real `yoga mat` run on amazon.com, 434 keywords, 73/73 prefixes, `completion.amazon.com`.

## Slovak listing text (alternate)

**Názov:** Sprout — Amazon Suggestion Expander

**Krátky opis:** Z jedného seedu na Amazone spraví návrhy a–z a 0–9 pre prieskum kľúčových slov predajcov, KDP a Merch.

**Popis:** Sprout je zadarmo. Rozšíri jedno kľúčové slovo o našeptávač, ktorý Amazon ukazuje zákazníkom, a celé beží v prehliadači. Žiadny účet, žiadna platba, žiadne sledovanie a žiadne čísla hľadanosti.

Napíšete seed, vyberiete jedno alebo viac trhovísk a Sprout sa opýta na samotný výraz a na výraz s každým písmenom a číslicou. Výsledky sú bez duplicít, s označením rozšírenia aj trhoviska. Dajú sa filtrovať, triediť, označiť hviezdičkou, skopírovať alebo stiahnuť ako CSV a XLSX.

Karta Terms poskladá reťazec pre pole Search Terms z najčastejších slov, v limite bajtov (na začiatku 249). Klik na slovo ho vyhodí a ďalšie doplní miesto. Vylúčené značky zmiznú zo zoznamu aj z exportu. Hviezdičky a posledných 20 behov ostanú v zariadení. Tabuľka otvorí každé slovo na Amazone, v Google a v Google Trends. Sprout neodhaduje objem vyhľadávania ani CPC.

Keď completion hostiteľ zlyhá, Sprout požiadavku zopakuje a skúsi záložnú adresu. Keď požiadavka zlyhá, slová si nevymýšľa.
