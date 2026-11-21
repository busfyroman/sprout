# Privacy note — Sprout

Sprout is a keyword research extension. It does not have accounts, analytics, ads, or a server of its own.

## What stays on the device

The last seed keyword, marketplace choices, expansion options, excluded words, search-term settings, and the latest result list are stored in `chrome.storage.local` on that browser profile. Starred keywords and the last 20 runs are stored in IndexedDB in the same profile. Nothing in either store is sent to the developer. Uninstalling the extension removes both. There is no account and no sync.

## What is sent, and where

When you press Expand, Sprout requests public Amazon autocomplete. The only query content is the seed plus a letter or digit. Requests go to:

- `https://completion.amazon.<marketplace>/api/2017/suggestions`
- and, only if that host fails or returns something that is not suggestion JSON, `https://www.amazon.<marketplace>/suggestions`

Cookies are not attached (`credentials: "omit"`). No other company receives the keyword from Sprout. The extension does not read orders, reviews, payments, or your Amazon account. It does not request or store search volume or CPC; it has no source for those numbers.

If you click Amazon, Google, or Trends on a keyword, the browser opens that site with the keyword in the link. That visit is between you and that site. Sprout does not observe it.

## What the on-page panel reads

On Amazon storefront pages where the panel is injected, Sprout reads the current URL and the search box (`#twotabsearchtextbox` or `field-keywords`) so it can prefill the seed. It does not scrape the rest of the page.

## Permissions

- `storage` — remember the last run on this device.
- `sidePanel` — open the research panel beside the page.
- Host access to `completion.amazon.*` and `www.amazon.*` for the marketplaces in the selector — call the suggestion endpoints, and show the panel on those storefronts.

The injected panel loads its script from the extension package. Chrome therefore lists that script as a web-accessible resource limited to those Amazon origins. It is the extension’s own code, not your keywords.

## Contact

Until this is published, the privacy contact is the person who loaded the extension. Host this note at a public URL before submitting to the Chrome Web Store, and paste that URL into the store privacy form.

---

# Poznámka o súkromí — Sprout

Sprout je rozšírenie na prieskum kľúčových slov. Nemá účty, analytiku, reklamy ani vlastný server.

## Čo ostáva v zariadení

Posledný seed, zvolené trhoviská, voľby rozšírenia, vylúčené slová, nastavenie search terms a posledný zoznam výsledkov sú v `chrome.storage.local` v danom profile prehliadača. Označené kľúčové slová a posledných 20 behov sú v IndexedDB v tom istom profile. Ani jeden z týchto úložísk sa vývojárovi neposiela. Odinštalovanie rozšírenia zmaže obe. Nie je tu účet ani synchronizácia.

## Čo sa posiela a kam

Po stlačení Expand Sprout požiada o verejný Amazon autocomplete. Obsahom dopytu je len seed a písmeno alebo číslica. Požiadavky idú na:

- `https://completion.amazon.<trhovisko>/api/2017/suggestions`
- a iba keď tento hostiteľ zlyhá alebo nevráti JSON návrhov, na `https://www.amazon.<trhovisko>/suggestions`

Cookies sa neprikladajú (`credentials: "omit"`). Sprout neposiela kľúčové slovo žiadnej inej firme. Rozšírenie nečíta objednávky, recenzie, platby ani účet na Amazone. Nepýta si ani neukladá objem vyhľadávania ani CPC; nemá na ne zdroj.

Keď kliknete na Amazon, Google alebo Trends pri slove, prehliadač otvorí tú stránku s kľúčovým slovom v odkaze. Tá návšteva je medzi vami a tou stránkou. Sprout ju nesleduje.

## Čo číta panel na stránke

Na stránkach Amazonu, kde je panel vložený, Sprout prečíta aktuálnu URL a vyhľadávacie pole (`#twotabsearchtextbox` alebo `field-keywords`), aby predvyplnil seed. Zvyšok stránky nesťahuje.

## Oprávnenia

- `storage` — pamätať si posledný beh v tomto zariadení.
- `sidePanel` — otvoriť panel vedľa stránky.
- Prístup k hostiteľom `completion.amazon.*` a `www.amazon.*` pre trhoviská v zozname — volať endpoint návrhov a zobraziť panel na týchto stránkach.

Vložený panel načíta svoj skript z balíka rozšírenia. Chrome preto tento skript uvedie ako web-accessible resource, obmedzený na tieto amazonovské originy. Je to kód rozšírenia, nie vaše kľúčové slová.

## Kontakt

Kým rozšírenie nie je zverejnené, kontaktom pre súkromie je človek, ktorý ho načítal. Pred odoslaním do Chrome Web Store umiestnite tento text na verejnú URL a tú vložte do formulára o súkromí.
