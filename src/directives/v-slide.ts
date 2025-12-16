const DISTANCE = 35 // 거리
const DURATION = 300 // 지속 시간

const map = new WeakMap() // 약한 참조 매핑

/** 관찰자 생성 */
const ob = new IntersectionObserver((entries: any) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      const animation = map.get(entry.target) // 매핑에서 애니메이션 가져오기
      if (animation) {
        animation.play() // 애니메이션 재생
        ob.unobserve(entry.target) // 해당 요소 관찰 중지
      }
    }
  }
})

function isBelowViewport(el: any) {
  return el.getBoundingClientRect().top - DISTANCE > window.innerHeight // 요소가 뷰포트 아래에 있는지 확인
}

export default {
  mounted(el: any) {
    if (!isBelowViewport(el)) return // 요소가 뷰포트 내에 있으면 아래 코드 실행 안 함
    const animation = el.animate(
      [
        {
          transform: `translateY(${DISTANCE}px)`,
          opacity: 0.5
        },
        {
          transform: 'translateY(0)',
          opacity: 1
        }
      ],
      {
        duration: DURATION, // 애니메이션 지속 시간 설정
        easing: 'ease-in-out', // 애니메이션 이징 효과 설정
        fill: 'forwards' // 애니메이션 채우기 모드 설정
      }
    )
    animation.pause() // 애니메이션 일시 중지
    ob.observe(el) // 해당 요소 관찰 시작
    map.set(el, animation) // 애니메이션 객체를 매핑에 저장
  },
  unmounted(el: any) {
    ob.unobserve(el) // 해당 요소 관찰 중지
  }
}
