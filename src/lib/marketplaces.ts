export interface Marketplace {
  id: string
  code: string
  label: string
  domain: string
  mid: string
  locale: string
  completionHost: string
  storefrontHost: string
}

interface MarketplaceSeed {
  id: string
  code: string
  label: string
  domain: string
  mid: string
  locale: string
}

function defineMarketplace(seed: MarketplaceSeed): Marketplace {
  return {
    ...seed,
    completionHost: `completion.${seed.domain}`,
    storefrontHost: `www.${seed.domain}`,
  }
}

/**
 * Marketplace IDs checked against Amazon’s completion API on 2026-11-21.
 * `completion.{domain}` returned keyword JSON for every row except India,
 * where that host answered HTTP 502 and `www.amazon.in/suggestions` worked.
 */
export const MARKETPLACES: readonly Marketplace[] = [
  defineMarketplace({ id: 'us', code: 'US', label: 'United States', domain: 'amazon.com', mid: 'ATVPDKIKX0DER', locale: 'en_US' }),
  defineMarketplace({ id: 'uk', code: 'UK', label: 'United Kingdom', domain: 'amazon.co.uk', mid: 'A1F83G8C2ARO7P', locale: 'en_GB' }),
  defineMarketplace({ id: 'de', code: 'DE', label: 'Germany', domain: 'amazon.de', mid: 'A1PA6795UKMFR9', locale: 'de_DE' }),
  defineMarketplace({ id: 'fr', code: 'FR', label: 'France', domain: 'amazon.fr', mid: 'A13V1IB3VIYZZH', locale: 'fr_FR' }),
  defineMarketplace({ id: 'it', code: 'IT', label: 'Italy', domain: 'amazon.it', mid: 'APJ6JRA9NG5V4', locale: 'it_IT' }),
  defineMarketplace({ id: 'es', code: 'ES', label: 'Spain', domain: 'amazon.es', mid: 'A1RKKUPIHCS9HS', locale: 'es_ES' }),
  defineMarketplace({ id: 'ca', code: 'CA', label: 'Canada', domain: 'amazon.ca', mid: 'A2EUQ1WTGCTBG2', locale: 'en_CA' }),
  defineMarketplace({ id: 'au', code: 'AU', label: 'Australia', domain: 'amazon.com.au', mid: 'A39IBJ37TRP1C6', locale: 'en_AU' }),
  defineMarketplace({ id: 'jp', code: 'JP', label: 'Japan', domain: 'amazon.co.jp', mid: 'A1VC38T7YXB528', locale: 'ja_JP' }),
  defineMarketplace({ id: 'mx', code: 'MX', label: 'Mexico', domain: 'amazon.com.mx', mid: 'A1AM78C64UM0Y8', locale: 'es_MX' }),
  defineMarketplace({ id: 'in', code: 'IN', label: 'India', domain: 'amazon.in', mid: 'A21TJRUUN4KGV', locale: 'en_IN' }),
  defineMarketplace({ id: 'br', code: 'BR', label: 'Brazil', domain: 'amazon.com.br', mid: 'A2Q3Y263D00KWC', locale: 'pt_BR' }),
  defineMarketplace({ id: 'nl', code: 'NL', label: 'Netherlands', domain: 'amazon.nl', mid: 'A1805IZSGTT6HS', locale: 'nl_NL' }),
  defineMarketplace({ id: 'se', code: 'SE', label: 'Sweden', domain: 'amazon.se', mid: 'A2NODRKZP88ZB9', locale: 'sv_SE' }),
  defineMarketplace({ id: 'pl', code: 'PL', label: 'Poland', domain: 'amazon.pl', mid: 'A1C3SOZRARQ6R3', locale: 'pl_PL' }),
  defineMarketplace({ id: 'be', code: 'BE', label: 'Belgium', domain: 'amazon.com.be', mid: 'AMEN7PMS3EDWL', locale: 'fr_BE' }),
  defineMarketplace({ id: 'ie', code: 'IE', label: 'Ireland', domain: 'amazon.ie', mid: 'A28R8C7NBKEWEA', locale: 'en_IE' }),
  defineMarketplace({ id: 'sg', code: 'SG', label: 'Singapore', domain: 'amazon.sg', mid: 'A19VAU5U5O7RUS', locale: 'en_SG' }),
  defineMarketplace({ id: 'ae', code: 'AE', label: 'United Arab Emirates', domain: 'amazon.ae', mid: 'A2VIGQ35RCS4UG', locale: 'en_AE' }),
  defineMarketplace({ id: 'sa', code: 'SA', label: 'Saudi Arabia', domain: 'amazon.sa', mid: 'A17E79C6D8DWNP', locale: 'ar_SA' }),
  defineMarketplace({ id: 'tr', code: 'TR', label: 'Turkey', domain: 'amazon.com.tr', mid: 'A33AVAJ2PDY3EV', locale: 'tr_TR' }),
  defineMarketplace({ id: 'eg', code: 'EG', label: 'Egypt', domain: 'amazon.eg', mid: 'ARBP9OOSHTCHU', locale: 'ar_EG' }),
]

const BY_ID = new Map(MARKETPLACES.map((marketplace) => [marketplace.id, marketplace]))

export function getMarketplace(id: string): Marketplace {
  return BY_ID.get(id) ?? MARKETPLACES[0]
}

export function marketplaceFromHostname(hostname: string): Marketplace | null {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  return MARKETPLACES.find((marketplace) => marketplace.domain === host) ?? null
}
