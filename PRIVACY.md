# Privacy note — Sprout

Sprout is a keyword research extension. It does not have accounts, analytics, ads, or a server of its own.

## What stays on the device

The last seed keyword, marketplace choices, department, expansion options, excluded words, search-term settings, starred keywords, the last 20 runs, and the latest result list are stored in `chrome.storage.local` on that browser profile. Nothing in that store is sent to the developer. Uninstalling the extension removes it. There is no account and no sync. Amazon result counts from a session stay in the panel until you close it. They are not treated as search volume.

## What is sent, and where

When you press Expand, Sprout requests public Amazon autocomplete. The only query content is the seed plus a letter or digit. Requests go to:

- `https://completion.amazon.<marketplace>/api/2017/suggestions`
- and, only if that host fails or returns something that is not suggestion JSON, `https://www.amazon.<marketplace>/suggestions`

Autocomplete requests do not attach cookies (`credentials: "omit"`). No other company receives the keyword from Sprout. The extension does not read orders, reviews, payments, or your Amazon account. It does not request or store search volume or CPC; it has no source for those numbers.

Two extra Amazon page reads happen only when you ask, and they happen in this browser, not on a Sprout server:

- **Amazon result count.** Results fetches `https://www.amazon.<marketplace>/s?k=…` for checked rows, or starred rows when none are checked, about one page per second. Cookies are omitted. Sprout reads the “results” line on that HTML. The panel calls it a result count, not search volume. If the HTML is a robot check, counting stops.
- **Related searches.** On an Amazon page the panel reads the related-search block already in the page. One more level fetches up to three of those search pages from this browser (the page’s own request context, so Amazon cookies already in the browser may be included) and reads the same block. Product titles and “Visit the … Store” names are read from the page you are on. They become buttons. Nothing is excluded until you click.

If you click Amazon, Google, or Trends on a keyword, the browser opens that site with the keyword in the link. That visit is between you and that site. Sprout does not observe it.

## What the on-page panel reads

On Amazon storefront pages where the panel is injected, Sprout reads the current URL, the search box (`#twotabsearchtextbox` or `field-keywords`), the department menu (`#searchDropdownBox`), the product title when that element is on the page, related-search links, and visible store or brand lines such as “Visit the … Store”. Those strings stay in the panel. Translate, when you press it, uses Chrome’s on-device Translator if the browser provides it. Sprout does not send the seed to a translation service. If the API is missing, the translated field is only what you type.

## Permissions

- `storage` — remember the last run on this device.
- `sidePanel` — open the research panel beside the page.
- Host access to `completion.amazon.*` and `www.amazon.*` for the marketplaces in the selector — call the suggestion endpoints, show the panel on those storefronts, and, only when you ask, fetch a search results page to read a result count or a related-search block.

The injected panel loads its script from the extension package. Chrome therefore lists that script as a web-accessible resource limited to those Amazon origins. It is the extension’s own code, not your keywords.

## Contact

Feedback and questions: https://github.com/busfyroman/sprout/issues
The public copy of this note is https://busfyroman.github.io/sprout/privacy.html. Paste that URL into the Chrome Web Store privacy form.

---

# Poznámka o súkromí — Sprout

Sprout je rozšírenie na prieskum kľúčových slov. Nemá účty, analytiku, reklamy ani vlastný server.

## Čo ostáva v zariadení

Posledný seed, zvolené trhoviská, oddelenie, voľby rozšírenia, vylúčené slová, nastavenie search terms, hviezdičky, posledných 20 behov a posledný zoznam výsledkov sú v `chrome.storage.local` v danom profile prehliadača. Z tohto úložiska sa vývojárovi nič neposiela. Odinštalovanie rozšírenia ho zmaže. Nie je tu účet ani synchronizácia. Počty výsledkov z relácie ostanú v paneli, kým ho nezavriete. Za objem hľadania sa nepovažujú.

## Čo sa posiela a kam

Po stlačení Expand Sprout požiada o verejný Amazon autocomplete. Obsahom dopytu je len seed a písmeno alebo číslica. Požiadavky idú na:

- `https://completion.amazon.<trhovisko>/api/2017/suggestions`
- a iba keď tento hostiteľ zlyhá alebo nevráti JSON návrhov, na `https://www.amazon.<trhovisko>/suggestions`

Požiadavky na našeptávač cookies neprikladajú (`credentials: "omit"`). Sprout neposiela kľúčové slovo žiadnej inej firme. Rozšírenie nečíta objednávky, recenzie, platby ani účet na Amazone. Nepýta si ani neukladá objem vyhľadávania ani CPC; nemá na ne zdroj.

Dve ďalšie stránky Amazonu sa čítajú len keď o to požiadate, a čítajú sa v tomto prehliadači, nie na serveri Sprout:

- **Počet výsledkov.** Results stiahne `https://www.amazon.<trhovisko>/s?k=…` pre zaškrtnuté riadky, alebo pre hviezdičky, keď nie je nič zaškrtnuté, zhruba jedna stránka za sekundu. Cookies sa neprikladajú. Sprout prečíta riadok s počtom výsledkov. Panel to volá počet výsledkov, nie objem hľadania. Ak je stránka kontrola robota, počítanie sa zastaví.
- **Súvisiace hľadania.** Na stránke Amazonu panel prečíta blok, ktorý už na stránke je. One more level stiahne najviac tri z tých vyhľadávacích stránok z tohto prehliadača (kontext danej stránky, takže cookies Amazonu, ktoré už prehliadač má, môžu ísť s požiadavkou) a prečíta ten istý blok. Titulok produktu a texty „Visit the … Store“ sa čítajú zo stránky, na ktorej ste. Stanú sa tlačidlami. Nič sa nevylúči, kým nekliknete.

Keď kliknete na Amazon, Google alebo Trends pri slove, prehliadač otvorí tú stránku s kľúčovým slovom v odkaze. Tá návšteva je medzi vami a tou stránkou. Sprout ju nesleduje.

## Čo číta panel na stránke

Na stránkach Amazonu, kde je panel vložený, Sprout prečíta aktuálnu URL, vyhľadávacie pole (`#twotabsearchtextbox` alebo `field-keywords`), menu oddelenia (`#searchDropdownBox`), titulok produktu, keď je na stránke, odkazy súvisiacich hľadaní a viditeľné názvy obchodu alebo značky, napríklad „Visit the … Store“. Tie reťazce ostanú v paneli. Translate, keď ho stlačíte, použije prekladač v Chrome v zariadení, ak ho prehliadač má. Sprout seed neposiela prekladateľskej službe. Keď API chýba, preložené pole je len to, čo napíšete.

## Oprávnenia

- `storage` — pamätať si posledný beh v tomto zariadení.
- `sidePanel` — otvoriť panel vedľa stránky.
- Prístup k hostiteľom `completion.amazon.*` a `www.amazon.*` pre trhoviská v zozname — volať endpoint návrhov, zobraziť panel na týchto stránkach a, len keď o to požiadate, stiahnuť stránku výsledkov kvôli počtu výsledkov alebo bloku súvisiacich hľadaní.

Vložený panel načíta svoj skript z balíka rozšírenia. Chrome preto tento skript uvedie ako web-accessible resource, obmedzený na tieto amazonovské originy. Je to kód rozšírenia, nie vaše kľúčové slová.

## Kontakt

Spätná väzba: https://github.com/busfyroman/sprout/issues
Verejná verzia tejto poznámky je https://busfyroman.github.io/sprout/privacy.html. Túto URL vložte do formulára o súkromí v Chrome Web Store.
