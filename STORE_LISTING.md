# Chrome Web Store listing draft

Category: **Shopping**. Language of the listing: English. An alternate Slovak text is below for a localized listing later.

Host [PRIVACY.md](PRIVACY.md) at a public URL before submit and paste it into the privacy form. This package does not collect user data for the developer. The form should say data is not sold, not used for purposes unrelated to the extension’s single purpose, and not transferred except the user-initiated request to Amazon described below.

## Name

Sprout — Amazon Suggestion Expander

## Short description

Turn one Amazon seed into a–z and 0–9 autocomplete suggestions for seller, KDP, and Merch research.

(99 characters. Store limit is 132.)

## Single purpose

Fetches public Amazon search autocomplete suggestions for a keyword the user enters and lets them copy or export that list.

## Detailed description

Sprout expands one seed keyword into the autocomplete suggestions Amazon shows shoppers.

Type a seed, pick a marketplace, and Sprout queries that marketplace’s public suggestion service for the seed alone and for the seed plus every letter and digit. You can glue the letter on (`yoga mata`), put it after a space (`yoga mat a`), put it in front, or do all of those. Results are deduplicated, tagged with the expansion that produced them, and ready to filter, sort, copy, or download as CSV or XLSX.

Built for Amazon sellers, KDP authors, and Merch on Demand designers who got empty lists from other expanders. If Amazon’s completion host fails or changes shape, Sprout retries with backoff and falls back to the storefront suggestions URL, then tells you which host answered. It does not invent keywords when the request fails.

Marketplaces: United States, United Kingdom, Germany, France, Italy, Spain, Canada, Australia, Japan, Mexico, India, Brazil, Netherlands, Sweden, Poland, Belgium, Ireland, Singapore, United Arab Emirates, Saudi Arabia, Turkey, and Egypt.

No search volume. No account. No payment. The last seed and result list stay in the browser.

Open it from the toolbar, from the side panel, or from the small pill on an Amazon search page, which picks up the term you just searched.

## Permission justifications

| Permission | Why |
| --- | --- |
| storage | Save the last seed, marketplace, options, and result list on the device. |
| sidePanel | Keep a longer expansion open beside Amazon. |
| Hosts `https://completion.amazon.<domain>/*` | Read the public autocomplete API for each marketplace in the selector. |
| Hosts `https://www.amazon.<domain>/*` | Fallback suggestions URL when the completion host fails, and the on-page panel on search results. |

The extension does not request tabs, history, cookies, downloads, or `<all_urls>`.

## Graphics

- Icon: `src/assets/icons/icon128.png` (also 16, 32, 48).
- Screenshot: `docs/sprout-yoga-mat.png` — popup after a real `yoga mat` run on amazon.com, 434 keywords, 73/73 prefixes, `completion.amazon.com`.

## Slovak listing text (alternate)

**Názov:** Sprout — Amazon Suggestion Expander

**Krátky opis:** Z jedného seedu na Amazone spraví návrhy a–z a 0–9 pre prieskum kľúčových slov predajcov, KDP a Merch.

**Popis:** Sprout rozšíri jedno kľúčové slovo o našeptávač, ktorý Amazon ukazuje zákazníkom. Napíšete seed, vyberiete trhovisko a Sprout sa opýta na samotný výraz a na výraz s každým písmenom a číslicou. Písmeno môže byť prilepené (`yoga mata`), za medzerou (`yoga mat a`), pred výrazom, alebo všetky tieto tvary naraz. Výsledky sú bez duplicít, s označením, ktoré rozšírenie ich prinieslo, a dajú sa filtrovať, triediť, skopírovať alebo stiahnuť ako CSV a XLSX.

Je pre predajcov, autorov KDP a tvorcov Merch, ktorým iné expandery vracajú prázdny zoznam. Keď completion hostiteľ zlyhá alebo zmení odpoveď, Sprout požiadavku zopakuje a skúsi záložnú adresu návrhov na stránke obchodu. Keď požiadavka zlyhá, slová si nevymýšľa.

Žiadny objem vyhľadávania, žiadny účet, žiadna platba. Posledný seed a zoznam ostanú v prehliadači.
