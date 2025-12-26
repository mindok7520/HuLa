import router from '../router'
import { useGlobalStore } from '../stores/global'

/**
 * 모바일용 사용자 정보 페이지로 이동
 * @param uid 사용자 uid
 */
export const toFriendInfoPage = (uid: string): void => {
  const globalStore = useGlobalStore()

  globalStore.addFriendModalInfo.uid = uid
  router.push(`/mobile/mobileFriends/friendInfo/${uid}`)
}
