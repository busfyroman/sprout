interface TranslatorLike {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<{ translate(text: string): Promise<string> }>
}

export function translatorAvailable(): boolean {
  return typeof (globalThis as { Translator?: unknown }).Translator === 'function'
    || typeof (globalThis as { Translator?: unknown }).Translator === 'object'
}

/** Uses Chrome's on-device Translator when the browser has it. Returns null otherwise. */
export async function translateOnDevice(text: string, sourceLanguage: string, targetLanguage: string): Promise<string | null> {
  const Translator = (globalThis as { Translator?: TranslatorLike }).Translator
  if (!Translator?.create || sourceLanguage === targetLanguage) return null
  try {
    if (Translator.availability) {
      const status = await Translator.availability({ sourceLanguage, targetLanguage })
      if (status === 'unavailable' || status === 'no') return null
    }
    const translator = await Translator.create({ sourceLanguage, targetLanguage })
    const translated = (await translator.translate(text)).trim()
    return translated || null
  } catch {
    return null
  }
}

export function languageFromLocale(locale: string): string {
  return locale.toLowerCase().split(/[_-]/)[0] || 'en'
}
