const vw = ref(document.documentElement.clientWidth)
const vh = ref(document.documentElement.clientHeight)

/** 뷰포트 너비 및 높이 가져오기 */
export const useViewport = () => {
  window.addEventListener('resize', () => {
    vw.value = document.documentElement.clientWidth
    vh.value = document.documentElement.clientHeight
  })
  return {
    vw,
    vh
  }
}
