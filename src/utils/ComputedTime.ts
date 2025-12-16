import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import weekday from 'dayjs/plugin/weekday'
import type { ConfigType, Dayjs, OpUnitType } from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import 'dayjs/locale/ko'
import { useI18nGlobal } from '@/services/i18n'

export const setDayjsLocale = (lang: string) => {
  const mapped = lang.toLowerCase().includes('ko') ? 'ko-KR' : 'en'
  dayjs.locale(mapped)
}

dayjs.extend(relativeTime)
dayjs.extend(weekday)
setDayjsLocale('ko-KR')

// 시간을 상대적 텍스트로 포맷, 위챗 스타일 모방
export const timeToStr = (time: number) => {
  const sendTime = dayjs(time)
  // 오늘과 메시지 전송 시간 간격이 며칠인지 계산
  const gapDay = dayjs().endOf('day').diff(sendTime, 'day')
  // 메시지가 오늘로부터 7일 이상 지났는지
  const isLastWeek = gapDay >= 7
  // 오늘은 시분 표시, 어제는 `어제 시분` 표시, 오늘로부터 일주일 이내는 `요일 시분` 표시, 그 이전은 날짜 `년월일 시분` 표시
  return gapDay < 2
    ? `${gapDay === 1 ? `${useI18nGlobal().t('menu.yesterday')} ` : ''}${sendTime.format('HH:mm')}`
    : isLastWeek
      ? sendTime.format('YYYY-MM-DD HH:mm')
      : dayjs(sendTime).format('dddd HH:mm')
}

/**
 * 메시지 타임스탬프 포맷
 * @param timestamp 타임스탬프
 * @param isDetail 상세 시간 표시 여부
 * @returns 포맷된 시간 문자열
 */
export const formatTimestamp = (timestamp: number, isDetail = false): string => {
  timestamp = Number(timestamp)
  const now: Dayjs = dayjs()
  const date: Dayjs = dayjs(timestamp)
  // 오늘과 메시지 전송 시간 간격이 며칠인지 계산
  const gapDay = dayjs().endOf('day').diff(date, 'day')
  // 메시지가 오늘로부터 7일 이상 지났는지
  const isLastWeek = gapDay >= 7

  // 먼저 연도가 다른지 확인
  if (now.year() !== date.year()) {
    return date.format(`${isDetail ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'}`)
  }

  // 다른 경우는 변경 없이 유지
  if (now.isSame(date, 'day')) {
    return date.format(`${isDetail ? 'HH:mm:ss' : 'HH:mm'}`)
  } else {
    if (isDetail) return date.format('MM-DD HH:mm:ss')
    return gapDay === 1
      ? useI18nGlobal().t('menu.yesterday')
      : isLastWeek
        ? date.format('MM-DD')
        : dayjs(date).format('dddd')
  }
}

/**
 * 메시지 간격 판단
 * @param {ConfigType} time 입력 시간
 * @param {OpUnitType} unit 간격 단위
 * @param {number} diff 간격 값
 * @returns boolean 입력 시간이 now로부터 간격 값 이상인지 여부.
 */
export const isDiffNow = ({ time, unit, diff }: { unit: OpUnitType; time: ConfigType; diff: number }): boolean => {
  return dayjs().diff(dayjs(time), unit) > diff
}

/**
 * 현재로부터 10분 지났는지
 * @param {ConfigType} time 입력 시간
 * @returns boolean 입력 시간이 now로부터 간격 값 이상인지 여부.
 */
export const isDiffNow10Min = (time: ConfigType): boolean => {
  return isDiffNow({ time, unit: 'minute', diff: 10 })
}

/**
 * 날짜 그룹 라벨 포맷 (채팅 기록 등의 시나리오에 사용)
 * @param timestamp 타임스탬프
 * @returns 포맷된 날짜 문자열 (오늘/어제/MM-DD)
 */
export const formatDateGroupLabel = (timestamp: number): string => {
  const date = dayjs(timestamp)
  const now = dayjs()
  const i18n = useI18nGlobal()

  if (now.isSame(date, 'day')) {
    return i18n.t('menu.today')
  } else if (now.subtract(1, 'day').isSame(date, 'day')) {
    return i18n.t('menu.yesterday')
  } else {
    return date.format('MM-DD')
  }
}

/** 상대 시간(전) */
export const handRelativeTime = (time: string) => {
  return dayjs(time).fromNow()
}

/** 지정된 날짜의 요일 가져오기 */
export const getWeekday = (time: string) => {
  return dayjs(time).format('ddd')
}
