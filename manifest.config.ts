import { defineManifest } from '@crxjs/vite-plugin'
import { MARKETPLACES } from './src/lib/marketplaces'

const hostPermissions = [...new Set(MARKETPLACES.flatMap((marketplace) => [
  `https://${marketplace.completionHost}/*`,
  `https://${marketplace.storefrontHost}/*`,
]))]

const contentMatches = MARKETPLACES.map((marketplace) => `https://${marketplace.storefrontHost}/*`)

export default defineManifest({
  manifest_version: 3,
  name: 'Sprout — Amazon Suggestion Expander',
  short_name: 'Sprout',
  version: '0.2.0',
  description: 'Turn one Amazon seed into a–z and 0–9 autocomplete suggestions for seller, KDP, and Merch research.',
  minimum_chrome_version: '120',
  action: {
    default_title: 'Sprout — Amazon suggestions',
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'src/assets/icons/icon16.png',
      32: 'src/assets/icons/icon32.png',
      48: 'src/assets/icons/icon48.png',
    },
  },
  icons: {
    16: 'src/assets/icons/icon16.png',
    32: 'src/assets/icons/icon32.png',
    48: 'src/assets/icons/icon48.png',
    128: 'src/assets/icons/icon128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_ui: {
    page: 'src/viewer/index.html',
    open_in_tab: true,
  },
  permissions: ['storage', 'sidePanel'],
  host_permissions: hostPermissions,
  content_scripts: [
    {
      matches: contentMatches,
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
})
