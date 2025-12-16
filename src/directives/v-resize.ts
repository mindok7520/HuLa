const map = new WeakMap()

// ResizeObserver 인스턴스 생성
const ob = new ResizeObserver((entries: any[]) => {
  // 감지된 모든 요소 순회
  for (const entry of entries) {
    // 해당 요소의 핸들러 가져오기
    const handler = map.get(entry.target)
    // 핸들러가 존재하는 경우
    if (handler) {
      // 핸들러 함수 호출 및 요소의 너비와 높이 전달
      handler({
        width: entry.borderBoxSize[0].inlineSize,
        height: entry.borderBoxSize[0].blockSize
      })
    }
  }
})

/**
 * 요소 크기 조정 지시문
 */
export default {
  mounted(el: any, binding: any) {
    // el 요소 크기 변경 감지
    map.set(el, binding.value)
    ob.observe(el)
  },
  unmounted(el: any) {
    // 감지 취소
    ob.unobserve(el)
  }
}
