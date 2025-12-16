import { animalEmojis, expressionEmojis, gestureEmojis } from '@/components/rightBox/emoticon/material'
import { useI18nGlobal } from '@/services/i18n'

/**
 *
 * @param inputs 파라미터 하나 또는 여러 문자열
 * @returns 2차원 배열 반환
 */
const splitEmoji = (...inputs: string[]) => {
  const emojiRegex: RegExp = /\p{Emoji}/u
  const emojiArrays: string[][] = []

  inputs.forEach((input) => {
    const emojiArray: string[] = []
    for (const char of input) {
      if (emojiRegex.test(char)) {
        emojiArray.push(char)
      }
    }
    emojiArrays.push(emojiArray)
  })

  return [...new Set(emojiArrays)]
}

/**
 * 모든 이모티콘 타입 및 해당 이모티콘 배열 가져오기
 */
const getAllTypeEmojis = () => {
  const emojiArr = splitEmoji(expressionEmojis, animalEmojis, gestureEmojis)
  const { t } = useI18nGlobal()

  return {
    expressionEmojis: { name: t('emoticon.categories.expression'), value: emojiArr[0] },
    animalEmojis: { name: t('emoticon.categories.animal'), value: emojiArr[1] },
    gestureEmojis: { name: t('emoticon.categories.gesture'), value: emojiArr[2] }
  }
}
export { getAllTypeEmojis }
