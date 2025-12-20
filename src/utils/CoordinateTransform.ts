/**
 * 좌표 변환 도구 클래스
 * 서로 다른 좌표계 간의 변환에 사용됨
 */

// 좌표 변환 상수
const PI = Math.PI
const A = 6378245.0 // 장반축(Semi-major axis)
const EE = 0.006693421622965943 // 이심률 제곱 (JavaScript 안전 정밀도 유지)

type Coordinate = {
  lat: number
  lng: number
}

/**
 * 좌표가 중국 내에 있는지 판단
 * @param lat 위도
 * @param lng 경도
 * @returns 중국 내 위치 여부
 */
const isInChina = (lat: number, lng: number): boolean => {
  return lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55
}

/**
 * 오프셋 계산
 * @param lat 위도
 * @param lng 경도
 * @returns 오프셋 좌표
 */
const transformLat = (lat: number, lng: number): number => {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng))
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

const transformLng = (lat: number, lng: number): number => {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng))
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

/**
 * WGS84를 GCJ02(화성 좌표계)로 변환
 * @param wgsLat WGS84 위도
 * @param wgsLng WGS84 경도
 * @returns GCJ02 좌표
 */
export const wgs84ToGcj02 = (wgsLat: number, wgsLng: number): Coordinate => {
  // 중국 내에 있지 않으면 원래 좌표를 즉시 반환
  if (!isInChina(wgsLat, wgsLng)) {
    return { lat: wgsLat, lng: wgsLng }
  }

  let dLat = transformLat(wgsLat - 35.0, wgsLng - 105.0)
  let dLng = transformLng(wgsLat - 35.0, wgsLng - 105.0)

  const radLat = (wgsLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)

  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)

  return {
    lat: wgsLat + dLat,
    lng: wgsLng + dLng
  }
}

/**
 * GCJ02를 BD09(바이두 좌표계)로 변환
 * @param gcjLat GCJ02 위도
 * @param gcjLng GCJ02 경도
 * @returns BD09 좌표
 */
export const gcj02ToBd09 = (gcjLat: number, gcjLng: number): Coordinate => {
  const z = Math.sqrt(gcjLng * gcjLng + gcjLat * gcjLat) + 0.00002 * Math.sin((gcjLat * PI * 3000.0) / 180.0)
  const theta = Math.atan2(gcjLat, gcjLng) + 0.000003 * Math.cos((gcjLng * PI * 3000.0) / 180.0)

  return {
    lat: z * Math.sin(theta) + 0.006,
    lng: z * Math.cos(theta) + 0.0065
  }
}

/**
 * BD09를 GCJ02로 변환
 * @param bdLat BD09 위도
 * @param bdLng BD09 경도
 * @returns GCJ02 좌표
 */
export const bd09ToGcj02 = (bdLat: number, bdLng: number): Coordinate => {
  const x = bdLng - 0.0065
  const y = bdLat - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin((y * PI * 3000.0) / 180.0)
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos((x * PI * 3000.0) / 180.0)

  return {
    lat: z * Math.sin(theta),
    lng: z * Math.cos(theta)
  }
}

/**
 * GCJ02를 WGS84로 변환
 * @param gcjLat GCJ02 위도
 * @param gcjLng GCJ02 경도
 * @returns WGS84 좌표
 */
export const gcj02ToWgs84 = (gcjLat: number, gcjLng: number): Coordinate => {
  // 중국 내에 있지 않으면 원래 좌표를 즉시 반환
  if (!isInChina(gcjLat, gcjLng)) {
    return { lat: gcjLat, lng: gcjLng }
  }

  let dLat = transformLat(gcjLat - 35.0, gcjLng - 105.0)
  let dLng = transformLng(gcjLat - 35.0, gcjLng - 105.0)

  const radLat = (gcjLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)

  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)

  return {
    lat: gcjLat - dLat,
    lng: gcjLng - dLng
  }
}

/**
 * WGS84를 BD09로 직접 변환
 * @param wgsLat WGS84 위도
 * @param wgsLng WGS84 경도
 * @returns BD09 좌표
 */
export const wgs84ToBd09 = (wgsLat: number, wgsLng: number): Coordinate => {
  const gcj02 = wgs84ToGcj02(wgsLat, wgsLng)
  return gcj02ToBd09(gcj02.lat, gcj02.lng)
}

/**
 * BD09를 WGS84로 직접 변환
 * @param bdLat BD09 위도
 * @param bdLng BD09 경도
 * @returns WGS84 좌표
 */
export const bd09ToWgs84 = (bdLat: number, bdLng: number): Coordinate => {
  const gcj02 = bd09ToGcj02(bdLat, bdLng)
  return gcj02ToWgs84(gcj02.lat, gcj02.lng)
}

/**
 * 두 좌표 지점 사이의 거리 계산 (단위: 미터)
 * Haversine 공식 사용
 * @param lat1 시작점 위도
 * @param lng1 시작점 경도
 * @param lat2 끝점 위도
 * @param lng2 끝점 경도
 * @returns 거리 (미터)
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000 // 지구 반지름 (미터)
  const dLat = ((lat2 - lat1) * PI) / 180
  const dLng = ((lng2 - lng1) * PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * PI) / 180) * Math.cos((lat2 * PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 좌표 변환 입구 함수
 * 가장 적합한 변환 방안 자동 선택
 * @param lat 원래 위도
 * @param lng 원래 경도
 * @param fromType 원래 좌표계 유형
 * @param toType 대상 좌표계 유형
 * @returns 변환된 좌표
 */
export const transformCoordinate = (
  lat: number,
  lng: number,
  fromType: 'WGS84' | 'GCJ02' | 'BD09' = 'WGS84',
  toType: 'WGS84' | 'GCJ02' | 'BD09' = 'GCJ02'
): Coordinate => {
  if (fromType === toType) {
    return { lat, lng }
  }

  switch (`${fromType}_TO_${toType}`) {
    case 'WGS84_TO_GCJ02':
      return wgs84ToGcj02(lat, lng)
    case 'WGS84_TO_BD09':
      return wgs84ToBd09(lat, lng)
    case 'GCJ02_TO_WGS84':
      return gcj02ToWgs84(lat, lng)
    case 'GCJ02_TO_BD09':
      return gcj02ToBd09(lat, lng)
    case 'BD09_TO_WGS84':
      return bd09ToWgs84(lat, lng)
    case 'BD09_TO_GCJ02':
      return bd09ToGcj02(lat, lng)
    default:
      console.warn(`지원되지 않는 좌표 변환: ${fromType} -> ${toType}`)
      return { lat, lng }
  }
}
