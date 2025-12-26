/**
 * Each locale is split into multiple domain-based translation fragments
 * eg: (home.json, room.json, common.json...) stored in locales/{lang}/.
 * This fragmented structure improves maintainability and prevents large
 * single-file translation bundles.
 *
 * On language switch, all fragments of the selected locale are dynamically
 * imported and merged into a complete message set.
 */

import { App } from 'vue'
import { createI18n } from 'vue-i18n'
import type { Locale } from 'vue-i18n'
import { useSettingStore } from '../stores/setting'
import { setDayjsLocale } from '@/utils/ComputedTime'

const i18n = createI18n({
  legacy: false,
  locale: ''
})

/**
 * setup 외부에서 사용, 이는 vue-i18n v9.x와 상충되는 것으로 보임
 * 꼭 필요한 경우가 아니면 직접 사용하지 마십시오!!!
 */
export const useI18nGlobal = () => i18n.global

// 모든 JSON 동적 가져오기
type LoadLocale = () => Promise<{ default: Record<string, string> }>

const locales = Object.entries(import.meta.glob('../../locales/**/*.json'))
  .map(([path, loader]) => {
    const match = path.match(/\/locales\/([\w-]+)\/([\w-]+)\.json$/)
    if (!match) return null

    const [, locale, part] = match
    return [locale, part, loader as LoadLocale] as const
  })
  .reduce(
    (acc, item) => {
      if (!item) return acc
      const [locale, part, loader] = item
      acc[locale] ??= {}
      acc[locale][part] = loader
      return acc
    },
    {} as Record<Locale, Record<string, LoadLocale>>
  )

export const availableLocales = Object.keys(locales)

const loadedLanguages: Locale[] = []

// Obtain language prefix
function getLangPrefix(lang: string) {
  const normalized = lang.replace('_', '-').trim()
  const parts = normalized.split('-')
  return parts[0].toLowerCase()
}

// 통합된 접두사 매핑 테이블, 추후 다른 언어를 지원해야 하는 경우 여기에 매핑을 추가하기만 하면 됩니다.
const PREFIX_LANG_MAP: Record<string, Locale> = {
  zh: 'zh-CN',
  en: 'en'
}

// 언어 접두사에 따라 지원되는 로케일을 매핑하고, 일치하지 않으면 중국어로 대체
const mapByPrefix = (lang: string): Locale => {
  return PREFIX_LANG_MAP[getLangPrefix(lang)] ?? 'zh-CN'
}

// AUTO 언어 분석: 지원되는 접두사를 제한하기 위해 매핑 테이블을 사용하고, 나머지는 중국어로 대체
const resolveAutoLanguage = (): Locale => {
  if (typeof navigator !== 'undefined') {
    return mapByPrefix(navigator.language)
  }
  return 'zh-CN'
}

// 언어 값 정규화: 명시적으로 지원되는 언어를 우선으로 하고, 그 다음 접두사 매핑, 마지막으로 중국어로 대체
const normalizeLang = (lang: string): Locale => {
  if (lang === 'AUTO') {
    return resolveAutoLanguage()
  }

  if (availableLocales.includes(lang)) {
    return lang as Locale
  }

  return mapByPrefix(lang)
}

// i18n 및 html 태그에 언어 적용
export function setI18nLanguage(lang: Locale) {
  const resolved = normalizeLang(lang)
  i18n.global.locale.value = resolved
  setDayjsLocale(resolved)
  if (typeof document !== 'undefined') {
    document.querySelector('html')?.setAttribute('lang', resolved)
  }
  return resolved
}

function findLocales(lang: string) {
  const exact = locales[lang]
  if (exact) return exact

  const prefix = getLangPrefix(lang)
  const like = availableLocales.find((lang) => getLangPrefix(lang) === prefix)
  // When “lang" does not exist, "zh-CN" as the default value.
  return locales[like ?? 'zh-CN']
}

// 언어 팩 로드 및 언어 전환, 로드하기 전에 lang이 정규화되었는지 확인
export async function loadLanguage(lang: Locale) {
  const resolvedLang = normalizeLang(lang)
  if (i18n.global.locale.value === resolvedLang) {
    return setI18nLanguage(resolvedLang)
  }

  if (loadedLanguages.includes(resolvedLang)) {
    return setI18nLanguage(resolvedLang)
  }

  const messageParts = findLocales(resolvedLang)
  if (!messageParts) {
    console.warn(`No locale data found for: ${resolvedLang}`)
    return
  }

  // 각 파일의 Promise 수집
  const tasks = Object.entries(messageParts).map(async ([key, loader]) => {
    const mod = await loader()
    return [key, mod.default]
  })

  // 모든 JSON 로드 완료 대기
  const modules = await Promise.all(tasks)

  // 파일 구조는 { home: {...}, room: {...} } 입니다.
  // messages = { ...home, ...room } 로 병합
  const messages = Object.fromEntries(modules)

  // 언어 팩 설정
  i18n.global.setLocaleMessage(resolvedLang, messages)

  loadedLanguages.push(resolvedLang)

  return setI18nLanguage(resolvedLang)
}

/**
 * Ensure that pinia is initialized first.
 */
export const setupI18n = (app: App) => {
  const settingStore = useSettingStore()

  loadLanguage(settingStore.page.lang ?? 'en')
  app.use(i18n)
}
