/**
 * 네트워크 상태 모니터링 훅
 */
export const useNetworkStatus = () => {
  // 네트워크 상태 - 브라우저 navigator.onLine 기반
  const isOnline = ref(navigator.onLine)

  // 브라우저 네트워크 상태 변경 감지
  const handleOnline = () => {
    isOnline.value = true
  }

  const handleOffline = () => {
    isOnline.value = false
  }

  // 네트워크 상태 리스너 초기화
  const initNetworkListener = () => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  // 네트워크 상태 리스너 정리
  const cleanupNetworkListener = () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }

  // 리스너 자동 초기화
  initNetworkListener()

  // 컴포넌트 언마운트 시 리스너 정리
  onUnmounted(() => {
    cleanupNetworkListener()
  })

  return {
    isOnline,
    initNetworkListener,
    cleanupNetworkListener
  }
}
