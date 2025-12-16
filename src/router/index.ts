import { invoke } from '@tauri-apps/api/core'
import { type } from '@tauri-apps/plugin-os'
import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
  type RouteRecordRaw
} from 'vue-router'

import FriendsList from '@/views/homeWindow/FriendsList.vue'
import Message from '@/views/homeWindow/message/index.vue'
import SearchDetails from '@/views/homeWindow/SearchDetails.vue'

import ChatRoomLayout from '#/layout/chat-room/ChatRoomLayout.vue'
import NoticeLayout from '#/layout/chat-room/NoticeLayout.vue'
import FriendsLayout from '#/layout/friends/FriendsLayout.vue'
import MobileHome from '#/layout/index.vue'
import GroupChatMember from '#/views/chat-room/GroupChatMember.vue'
import MobileInviteGroupMember from '#/views/chat-room/MobileInviteGroupMember.vue'
import MyLayout from '#/layout/my/MyLayout.vue'
import MobileLogin from '#/login.vue'
import ChatSetting from '#/views/chat-room/ChatSetting.vue'
import MobileChatMain from '#/views/chat-room/MobileChatMain.vue'
import SearchChatContent from '#/views/chat-room/SearchChatContent.vue'
import MediaViewer from '#/views/chat-room/MediaViewer.vue'
import NoticeDetail from '#/views/chat-room/notice/NoticeDetail.vue'
import NoticeEdit from '#/views/chat-room/notice/NoticeEdit.vue'
import NoticeList from '#/views/chat-room/notice/NoticeList.vue'
import MobileCommunity from '#/views/community/index.vue'
import DynamicDetailPage from '#/views/community/DynamicDetailPage.vue'
import AddFriends from '#/views/friends/AddFriends.vue'
import ConfirmAddFriend from '#/views/friends/ConfirmAddFriend.vue'
import ConfirmAddGroup from '#/views/friends/ConfirmAddGroup.vue'
import FriendInfo from '#/views/friends/FriendInfo.vue'
import MobileFriendPage from '#/views/friends/index.vue'
import StartGroupChat from '#/views/friends/StartGroupChat.vue'
import MobileMessagePage from '#/views/message/index.vue'
import EditBio from '#/views/my/EditBio.vue'
import EditBirthday from '#/views/my/EditBirthday.vue'
import EditProfile from '#/views/my/EditProfile.vue'
import MobileMy from '#/views/my/index.vue'
import MobileQRCode from '#/views/my/MobileQRCode.vue'
import MobileSettings from '#/views/my/MobileSettings.vue'
import MyMessages from '#/views/my/MyMessages.vue'
import PublishCommunity from '#/views/my/PublishCommunity.vue'
import Share from '#/views/my/Share.vue'
import SimpleBio from '#/views/my/SimpleBio.vue'
import AiAssistant from '#/views/my/AiAssistant.vue'
import MyAlbum from '#/views/my/MyAlbum.vue'
import { TauriCommand } from '@/enums'
import ConfirmQRLogin from '#/views/ConfirmQRLogin.vue'
import MyQRCode from '#/views/MyQRCode.vue'
import Splashscreen from '#/views/Splashscreen.vue'
import MobileForgetPassword from '#/views/MobileForgetPassword.vue'
import MobileServiceAgreement from '#/views/MobileServiceAgreement.vue'
import MobilePrivacyAgreement from '#/views/MobilePrivacyAgreement.vue'
import SyncData from '#/views/SyncData.vue'

/**! 창 생성 후 페이지 이동 시 스타일이 적용되지 않는 문제가 있어 지연 로딩 라우팅 방식을 사용할 수 없으며, 빠른 응답이 필요한 일부 페이지는 지연 로딩이 필요하지 않습니다 */
const { BASE_URL } = import.meta.env

const isMobile = type() === 'ios' || type() === 'android'

// 모바일 라우팅 구성 - 지연 로딩 문제를 피하기 위해 직접 가져오기 사용
const getMobileRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/',
    name: 'mobileRoot',
    redirect: '/mobile/login'
  },
  {
    path: '/mobile/login',
    name: 'mobileLogin',
    component: MobileLogin
  },
  {
    path: '/mobile/MobileForgetPassword',
    name: 'mobileForgetPassword',
    component: MobileForgetPassword
  },
  {
    path: '/mobile/splashscreen',
    name: 'splashscreen',
    component: Splashscreen
  },
  {
    path: '/mobile/serviceAgreement',
    name: 'mobileServiceAgreement',
    component: MobileServiceAgreement
  },
  {
    path: '/mobile/privacyAgreement',
    name: 'mobilePrivacyAgreement',
    component: MobilePrivacyAgreement
  },
  {
    path: '/mobile/syncData',
    name: 'mobileSyncData',
    component: SyncData
  },
  {
    path: '/mobile/chatRoom',
    name: 'mobileChatRoom',
    component: ChatRoomLayout,
    children: [
      {
        path: '',
        name: 'mobileChatRoomDefault',
        redirect: '/mobile/chatRoom/chatMain'
      },
      {
        path: 'chatMain/:uid?', // 선택적 전달, uid가 전달되면 친구와의 1:1 채팅방을 의미함
        name: 'mobileChatMain',
        component: MobileChatMain,
        props: true,
        meta: { keepAlive: true }
      },
      {
        path: 'setting',
        name: 'mobileChatSetting',
        component: ChatSetting
      },
      {
        path: 'searchContent',
        name: 'mobileSearchChatContent',
        component: SearchChatContent
      },
      {
        path: 'mediaViewer',
        name: 'mobileMediaViewer',
        component: MediaViewer
      },
      {
        path: 'groupChatMember',
        name: 'mobileGroupChatMember',
        component: GroupChatMember,
        meta: { keepAlive: true }
      },
      {
        path: 'inviteGroupMember',
        name: 'mobileInviteGroupMember',
        component: MobileInviteGroupMember
      },
      {
        path: 'notice',
        name: 'mobileChatNotice',
        component: NoticeLayout,
        children: [
          {
            path: '',
            name: 'mobileChatNoticeList',
            component: NoticeList
          },
          {
            path: 'add',
            name: 'mobileChatNoticeAdd',
            component: NoticeEdit
          },
          {
            path: 'edit/:id',
            name: 'mobileChatNoticeEdit',
            component: NoticeEdit
          },
          {
            path: 'detail/:id',
            name: 'mobileChatNoticeDetail',
            component: NoticeDetail
          }
        ]
      }
    ]
  },
  {
    path: '/mobile/home',
    name: 'mobileHome',
    component: MobileHome,
    children: [
      {
        path: '',
        name: 'mobileHomeDefault',
        redirect: '/mobile/message'
      },
      {
        path: '/mobile/message',
        name: 'mobileMessage',
        component: MobileMessagePage
      },
      {
        path: '/mobile/friends',
        name: 'mobileFriends',
        component: MobileFriendPage
      },
      {
        path: '/mobile/community',
        name: 'mobileCommunity',
        component: MobileCommunity
      },
      {
        path: '/mobile/my',
        name: 'mobileMy',
        component: MobileMy
      }
    ]
  },
  {
    path: '/mobile/mobileMy',
    name: 'mobileMyLayout',
    component: MyLayout,
    children: [
      {
        path: '',
        name: 'mobileMyDefault',
        redirect: '/mobile/mobileMy/editProfile'
      },
      {
        path: 'editProfile',
        name: 'mobileEditProfile',
        component: EditProfile
      },
      {
        path: 'myMessages',
        name: 'mobileMyMessages',
        component: MyMessages
      },
      {
        path: 'editBio',
        name: 'mobileEditBio',
        component: EditBio
      },
      {
        path: 'editBirthday',
        name: 'mobileEditBirthday',
        component: EditBirthday
      },
      {
        path: 'publishCommunity',
        name: 'mobilePublishCommunity',
        component: PublishCommunity
      },
      {
        path: 'settings',
        name: 'MobileSettings',
        component: MobileSettings
      },
      {
        path: 'scanQRCode',
        name: 'mobileQRCode',
        component: MobileQRCode
      },
      {
        path: 'share',
        name: 'mobileShare',
        component: Share
      },
      {
        path: 'SimpleBio',
        name: 'mobileSimpleBio',
        component: SimpleBio
      },
      {
        path: 'aiAssistant',
        name: 'mobileAiAssistant',
        component: AiAssistant
      },
      {
        path: 'myAlbum',
        name: 'mobileMyAlbum',
        component: MyAlbum
      }
    ]
  },
  {
    path: '/mobile/mobileFriends',
    name: 'mobileFriendsLayout',
    component: FriendsLayout,
    children: [
      {
        path: '',
        name: 'mobileFriendsDefault',
        redirect: '/mobile/mobileFriends/addFriends'
      },
      {
        path: 'addFriends',
        name: 'mobileAddFriends',
        component: AddFriends
      },
      {
        path: 'startGroupChat',
        name: 'mobileStartGroupChat',
        component: StartGroupChat
      },
      {
        path: 'confirmAddFriend',
        name: 'mobileConfirmAddFriend',
        component: ConfirmAddFriend
      },
      {
        path: 'confirmAddGroup',
        name: 'mobileConfirmAddGroup',
        component: ConfirmAddGroup
      },
      {
        path: 'friendInfo/:uid',
        name: 'mobileFriendInfo',
        component: FriendInfo
      }
    ]
  },
  {
    path: '/mobile/confirmQRLogin/:ip/:expireTime/:deviceType/:locPlace/:qrId',
    name: 'mobileConfirmQRLogin',
    component: ConfirmQRLogin,
    props: true
  },
  {
    path: '/mobile/myQRCode',
    name: 'mobileMyQRCode',
    component: MyQRCode
  },
  {
    path: '/mobile/rtcCall',
    name: 'rtcCall',
    component: () => import('../mobile/views/rtcCall/index.vue')
  },
  {
    path: '/mobile/dynamic/:id',
    name: 'mobileDynamicDetail',
    component: DynamicDetailPage,
    props: true
  }
]

// 데스크톱 라우팅 구성
const getDesktopRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/home',
    name: 'home',
    component: () => import('@/layout/index.vue'),
    children: [
      {
        path: '/message',
        name: 'message',
        component: Message
      },
      {
        path: '/friendsList',
        name: 'friendsList',
        component: FriendsList
      },
      {
        path: '/searchDetails',
        name: 'searchDetails',
        component: SearchDetails
      }
    ]
  },
  {
    path: '/robot',
    name: 'robot',
    component: () => import('@/plugins/robot/index.vue'),
    children: [
      {
        path: '/welcome',
        name: 'welcome',
        component: () => import('@/plugins/robot/views/Welcome.vue')
      },
      {
        path: '/chat',
        name: 'chat',
        component: () => import('@/plugins/robot/views/Chat.vue')
      },
      {
        path: '/chatSettings',
        name: 'chatSettings',
        component: () => import('@/plugins/robot/views/chatSettings/index.vue')
      },
      {
        path: '/imageGeneration',
        name: 'imageGeneration',
        component: () => import('@/plugins/robot/views/ImageGeneration.vue')
      },
      {
        path: '/videoGeneration',
        name: 'videoGeneration',
        component: () => import('@/plugins/robot/views/VideoGeneration.vue')
      }
    ]
  },
  {
    path: '/mail',
    name: 'mail',
    component: () => import('@/views/mailWindow/index.vue')
  },
  {
    path: '/fileManager',
    name: 'fileManager',
    component: () => import('@/views/fileManagerWindow/index.vue')
  },
  {
    path: '/dynamic',
    name: 'dynamic',
    component: () => import('@/plugins/dynamic/index.vue')
  },
  {
    path: '/dynamic/:id',
    name: 'dynamicDetailWithId',
    component: () => import('@/plugins/dynamic/detail.vue')
  },
  {
    path: '/dynamicDetail',
    name: 'dynamicDetail',
    component: () => import('@/plugins/dynamic/detail.vue')
  },
  {
    path: '/onlineStatus',
    name: 'onlineStatus',
    component: () => import('@/views/onlineStatusWindow/index.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/aboutWindow/index.vue')
  },
  {
    path: '/alone',
    name: 'alone',
    component: () => import('@/views/homeWindow/message/Alone.vue')
  },
  {
    path: '/sharedScreen',
    name: 'sharedScreen',
    component: () => import('@/views/homeWindow/SharedScreen.vue')
  },
  {
    path: '/modal-invite',
    name: 'modal-invite',
    component: () => import('@/views/modalWindow/index.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/moreWindow/settings/index.vue'),
    children: [
      {
        path: '/general',
        name: 'general',
        component: () => import('@/views/moreWindow/settings/General.vue')
      },
      {
        path: '/loginSetting',
        name: 'loginSetting',
        component: () => import('@/views/moreWindow/settings/LoginSetting.vue')
      },
      {
        path: '/notification',
        name: 'notification',
        component: () => import('@/views/moreWindow/settings/Notification.vue')
      },
      {
        path: '/versatile',
        name: 'versatile',
        component: () => import('@/views/moreWindow/settings/Versatile.vue')
      },
      {
        path: '/manageStore',
        name: 'manageStore',
        component: () => import('@/views/moreWindow/settings/ManageStore.vue')
      },
      {
        path: '/shortcut',
        name: 'shortcut',
        component: () => import('@/views/moreWindow/settings/Shortcut.vue')
      }
    ]
  },
  {
    path: '/announList/:roomId/:type',
    name: 'announList',
    component: () => import('@/views/announWindow/index.vue')
  },
  {
    path: '/previewFile',
    name: 'previewFile',
    component: () => import('@/views/previewFileWindow/index.vue')
  },
  {
    path: '/chat-history',
    name: 'chat-history',
    component: () => import('@/views/chatHistory/index.vue')
  },
  {
    path: '/rtcCall',
    name: 'rtcCall',
    component: () => import('@/views/callWindow/index.vue')
  },
  // 채팅 기록 창 라우트 추가
  {
    path: '/multiMsg',
    name: 'multiMsg',
    component: () => import('@/views/multiMsgWindow/index.vue')
  },
  {
    path: '/searchFriend',
    name: 'searchFriend',
    component: () => import('@/views/friendWindow/SearchFriend.vue')
  },
  {
    path: '/addFriendVerify',
    name: 'addFriendVerify',
    component: () => import('@/views/friendWindow/AddFriendVerify.vue')
  },
  {
    path: '/addGroupVerify',
    name: 'addGroupVerify',
    component: () => import('@/views/friendWindow/AddGroupVerify.vue')
  }
]

// 공통 라우팅 구성 (모든 플랫폼 필요)
const getCommonRoutes = (): Array<RouteRecordRaw> => [
  {
    path: '/manageGroupMember',
    name: 'manageGroupMember',
    component: () => import('@/views/ManageGroupMember.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/loginWindow/Login.vue')
  },
  {
    path: '/splashscreen',
    name: 'splashscreen',
    component: Splashscreen
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/registerWindow/index.vue')
  },
  {
    path: '/forgetPassword',
    name: 'forgetPassword',
    component: () => import('@/views/forgetPasswordWindow/index.vue')
  },
  {
    path: '/qrCode',
    name: 'qrCode',
    component: () => import('@/views/loginWindow/QRCode.vue')
  },
  {
    path: '/network',
    name: 'network',
    component: () => import('@/views/loginWindow/Network.vue')
  },
  {
    path: '/tray',
    name: 'tray',
    component: () => import('@/views/Tray.vue')
  },
  {
    path: '/notify',
    name: 'notify',
    component: () => import('@/views/Notify.vue')
  },
  {
    path: '/update',
    name: 'update',
    component: () => import('@/views/Update.vue')
  },
  {
    path: '/checkupdate',
    name: 'checkupdate',
    component: () => import('@/views/CheckUpdate.vue')
  },
  {
    path: '/capture',
    name: 'capture',
    component: () => import('@/views/Capture.vue')
  },
  {
    path: '/imageViewer',
    name: 'imageViewer',
    component: () => import('@/views/imageViewerWindow/index.vue')
  },
  {
    path: '/videoViewer',
    name: 'videoViewer',
    component: () => import('@/views/videoViewerWindow/index.vue')
  },
  {
    path: '/modal-serviceAgreement',
    name: 'modal-serviceAgreement',
    component: () => import('@/views/agreementWindow/Server.vue')
  },
  {
    path: '/modal-privacyAgreement',
    name: 'modal-privacyAgreement',
    component: () => import('@/views/agreementWindow/Privacy.vue')
  },
  {
    path: '/modal-remoteLogin',
    name: 'modal-remoteLogin',
    component: () => import('@/views/loginWindow/RemoteLoginModal.vue')
  }
]

// 모든 라우트 생성 (공통 라우트 + 플랫폼별 라우트)
const getAllRoutes = (): Array<RouteRecordRaw> => {
  const commonRoutes = getCommonRoutes()
  if (isMobile) {
    return [...commonRoutes, ...getMobileRoutes()]
  } else {
    return [...commonRoutes, ...getDesktopRoutes()]
  }
}

// 라우터 생성
const router: any = createRouter({
  history: createWebHistory(BASE_URL),
  routes: getAllRoutes()
})

// 라우터 생성 후 전역 전위 가드 추가
// "'to'가 선언되었으나 값을 읽지 않음" 문제를 해결하기 위해 to 매개변수를 밑줄로 시작하여 사용되지 않음을 표시
router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
  // 데스크톱은 직접 통과
  if (!isMobile) {
    console.log('[가드] 비모바일, 직접 통과')
    return next()
  }

  try {
    const isLoginPage = to.path === '/mobile/login'
    const isSplashPage = to.path === '/mobile/splashscreen'
    const isForgetPage = to.path === '/mobile/MobileForgetPassword'
    const isAgreementPage = to.path === '/mobile/serviceAgreement' || to.path === '/mobile/privacyAgreement'

    // 스플래시 화면 화이트리스트: 로그인 상태와 관계없이 진입 허용
    console.log('라우팅 가드 to->', to.path)
    if (isSplashPage || isForgetPage || isAgreementPage) {
      return next()
    }

    const tokens = await invoke<{ token: string | null; refreshToken: string | null }>(TauriCommand.GET_USER_TOKENS)
    const isLoggedIn = !!(tokens.token && tokens.refreshToken)

    // 로그인하지 않았고 로그인 페이지가 아닌 경우 → 로그인으로 이동
    if (!isLoggedIn && !isLoginPage) {
      console.warn('[가드] 미로그인, /mobile/login으로 강제 이동')
      return next('/mobile/login')
    }

    return next()
  } catch (error) {
    console.error('[가드] 토큰 가져오기 오류:', error)
    // 오류 발생 시에도 로그인 페이지로 이동 (무한 루프 방지)
    if (to.path !== '/mobile/login') {
      console.warn('[가드] 오류 발생, /mobile/login으로 강제 이동')
      return next('/mobile/login')
    }
    // console.log('[가드] 오류 발생했으나 목표가 로그인 페이지임, 직접 통과')
    return next()
  }
})

export default router
