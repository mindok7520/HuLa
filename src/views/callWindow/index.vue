<template>
  <!-- 알림 스타일 창 (수신자 및 미수락 상태) -->
  <div
    v-if="isReceiver && !isCallAccepted"
    class="w-360px h-full bg-white dark:bg-gray-800 flex-y-center px-12px select-none">
    <!-- 사용자 아바타 -->
    <div class="relative mr-12px">
      <n-avatar
        :size="56"
        :src="avatarSrc"
        :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
        :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
        class="rounded-12px shadow-md" />
      <!-- 통화 타입 표시기 -->
      <div class="absolute -bottom-2px -right-2px w-20px h-20px rounded-full bg-blue-500 flex-center shadow-lg">
        <svg class="size-14px color-#fff">
          <use :href="callType === CallTypeEnum.VIDEO ? '#video-one' : '#phone-telephone'"></use>
        </svg>
      </div>
    </div>

    <!-- 사용자 정보 및 상태 -->
    <div class="flex-1 min-w-0">
      <div class="text-15px font-semibold text-gray-900 dark:text-white mb-12px truncate">
        {{ remoteUserInfo?.name || t('message.call_window.unknown_user') }}
      </div>
      <div class="text-12px text-gray-500 dark:text-gray-400 flex items-center">
        <div class="w-6px h-6px rounded-full bg-#13987f mr-6px animate-pulse"></div>
        {{ t('message.call_window.incoming') }} ·
        {{
          callType === CallTypeEnum.VIDEO ? t('message.call_window.video_call') : t('message.call_window.voice_call')
        }}
      </div>
    </div>

    <!-- 조작 버튼 -->
    <div class="flex gap-16px mr-8">
      <!-- 거절 버튼 -->
      <div
        @click="hangUp(CallResponseStatus.REJECTED)"
        class="size-40px rounded-full bg-#d5304f hover:bg-#d5304f flex-center cursor-pointer shadow-lg">
        <svg class="color-#fff size-20px">
          <use href="#PhoneHangup"></use>
        </svg>
      </div>
      <!-- 수락 버튼 -->
      <div
        @click="acceptCall"
        class="size-40px rounded-full bg-#13987f hover:bg-#13987f flex-center cursor-pointer shadow-lg">
        <svg class="color-#fff size-20px">
          <use href="#phone-telephone-entity"></use>
        </svg>
      </div>
    </div>
  </div>

  <!-- 일반 통화 창 -->
  <div v-else data-tauri-drag-region class="h-full flex flex-col select-none relative bg-#161616">
    <!-- 배경 페더링 블러 레이어 -->
    <div
      :style="{
        backgroundImage: `url(${avatarSrc})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }"
      class="absolute inset-0 blur-xl opacity-40"></div>
    <!-- 어두운 마스크 -->
    <div class="absolute inset-0 bg-black/20"></div>

    <!-- 창 제어 바 -->
    <ActionBar
      v-if="!isMobileDevice"
      ref="actionBarRef"
      class="relative z-10"
      :top-win-label="WebviewWindow.getCurrent().label"
      :shrink="false" />

    <!-- 주요 내용 영역 -->
    <div
      :class="[
        'relative z-10 flex flex-col min-h-0 flex-1',
        isMobileDevice ? 'p-0' : 'px-8px pt-6px',
        !isMobileDevice || callType !== CallTypeEnum.VIDEO ? 'items-center justify-center' : ''
      ]">
      <!-- 영상 통화 시 비디오 표시 (양쪽 모두 비디오를 켰을 때만 표시) -->
      <div
        v-if="callType === CallTypeEnum.VIDEO && localStream && (isVideoEnabled || hasRemoteVideo)"
        class="w-full flex-1 relative min-h-0 overflow-hidden">
        <div
          v-if="!isMobileDevice && connectionStatus !== RTCCallStatus.ACCEPT"
          class="absolute inset-0 flex-center z-20">
          <div class="rounded-full bg-black/60 px-20px py-8px text-16px text-white">
            {{ callStatusText }}
          </div>
        </div>
        <!-- 메인 비디오 -->
        <video
          ref="mainVideoRef"
          autoplay
          playsinline
          :class="[
            'w-full h-full scale-x-[-1] bg-black object-cover',
            isMobileDevice ? 'rounded-none' : 'rounded-8px'
          ]"></video>

        <!-- PIP(화중화) 비디오 -->
        <div :class="isMobileDevice ? 'top-100px' : 'top-12px'" class="absolute right-8px group z-30">
          <video
            ref="pipVideoRef"
            autoplay
            playsinline
            :class="pipVideoSizeClass"
            class="scale-x-[-1] rounded-8px bg-black object-cover border-2 border-white cursor-pointer"
            @click="toggleVideoLayout"></video>
          <!-- 전환 안내 -->
          <div
            class="absolute inset-0 flex-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-30 rounded-8px pointer-events-none">
            <svg class="text-#fff size-20px">
              <use href="#switch"></use>
            </svg>
          </div>
        </div>

        <!-- 하단 제어 버튼 플로팅 레이어 (모바일 전용) -->
        <div
          v-if="isMobileDevice"
          class="absolute inset-x-0 bottom-0 z-30 px-24px pb-24px pointer-events-none"
          :style="{
            background: 'linear-gradient(180deg, rgba(15, 15, 15, 0) 0%, rgba(15, 15, 15, 0.88) 100%)',
            paddingBottom: 'calc(24px + env(safe-area-inset-bottom))'
          }">
          <!-- 통화 시간 -->
          <div v-if="connectionStatus === RTCCallStatus.ACCEPT" class="pb-16px text-center pointer-events-none">
            <div class="inline-block rounded-full bg-black/50 px-16px py-6px text-14px text-#fff">
              {{ formattedCallDuration }}
            </div>
          </div>

          <div class="flex-center gap-24px pointer-events-auto">
            <!-- 음소거 버튼 -->
            <div class="flex-center">
              <div
                @click="toggleMute"
                class="size-44px rounded-full flex-center cursor-pointer"
                :class="!isMuted ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
                <svg class="size-16px color-#fff">
                  <use :href="!isMuted ? '#voice' : '#voice-off'"></use>
                </svg>
              </div>
            </div>

            <!-- 스피커 버튼 -->
            <div class="flex-center">
              <div
                @click="toggleSpeaker"
                class="size-44px rounded-full flex-center cursor-pointer"
                :class="isSpeakerOn ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
                <svg class="size-16px color-#fff">
                  <use :href="isSpeakerOn ? '#volume-notice' : '#volume-mute'"></use>
                </svg>
              </div>
            </div>

            <!-- 카메라 전환 버튼 (모바일 영상 통화 전용) -->
            <div v-if="callType === CallTypeEnum.VIDEO" class="flex-center">
              <div
                @click="switchCameraFacing"
                class="size-44px rounded-full flex-center cursor-pointer bg-gray-600 hover:bg-gray-500">
                <svg class="size-16px color-#fff">
                  <use href="#refresh"></use>
                </svg>
              </div>
            </div>

            <!-- 카메라 버튼 -->
            <div class="flex-center">
              <div
                @click="toggleVideo"
                class="size-44px rounded-full flex-center cursor-pointer"
                :class="isVideoEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
                <svg class="size-16px color-#fff">
                  <use :href="isVideoEnabled ? '#video-one' : '#monitor-off'"></use>
                </svg>
              </div>
            </div>

            <!-- 종료 버튼 -->
            <div class="flex-center">
              <div
                @click="hangUp()"
                class="size-44px rounded-full bg-#d5304f60 hover:bg-#d5304f80 flex-center cursor-pointer">
                <svg class="size-16px color-#fff">
                  <use href="#PhoneHangup"></use>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 음성 통화 또는 기타 상태 시 아바타 표시 -->
      <div
        v-else
        :class="['mb-24px flex flex-col items-center', shouldCenterPreparingAvatar ? 'absolute-center' : 'relative']">
        <n-avatar
          :size="140"
          :src="avatarSrc"
          :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
          :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          class="rounded-22px mb-16px" />

        <!-- 사용자 이름 -->
        <div class="text-20px font-medium text-white mb-8px text-center">
          {{ remoteUserInfo?.name }}
        </div>

        <!-- 상태 텍스트 -->
        <div class="text-14px text-gray-300 text-center">
          {{ callStatusText }}
        </div>
      </div>

      <!-- 통화 시간 -->
      <div
        v-if="connectionStatus === RTCCallStatus.ACCEPT && (!isMobileDevice || callType !== CallTypeEnum.VIDEO)"
        class="inline-block rounded-full bg-black/50 px-16px py-6px text-16px text-gray-300 my-12px text-center">
        {{ formattedCallDuration }}
      </div>
    </div>

    <!-- 하단 제어 버튼 (영상 통화 - 데스크톱) -->
    <div v-if="callType === CallTypeEnum.VIDEO && !isMobileDevice" class="relative z-10">
      <div class="py-14px flex-center gap-32px">
        <!-- 음소거 버튼 -->
        <div class="flex-col-x-center gap-8px w-80px">
          <div
            @click="toggleMute"
            class="size-44px rounded-full flex-center cursor-pointer"
            :class="!isMuted ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
            <svg class="size-16px color-#fff">
              <use :href="!isMuted ? '#voice' : '#voice-off'"></use>
            </svg>
          </div>
          <div class="text-12px text-gray-400 text-center">
            {{ !isMuted ? t('message.call_window.mic_on') : t('message.call_window.mic_off') }}
          </div>
        </div>

        <!-- 스피커 버튼 -->
        <div class="flex-col-x-center gap-8px w-80px">
          <div
            @click="toggleSpeaker"
            class="size-44px rounded-full flex-center cursor-pointer"
            :class="isSpeakerOn ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
            <svg class="size-16px color-#fff">
              <use :href="isSpeakerOn ? '#volume-notice' : '#volume-mute'"></use>
            </svg>
          </div>
          <div class="text-12px text-gray-400 text-center">
            {{ isSpeakerOn ? t('message.call_window.speaker_on') : t('message.call_window.speaker_off') }}
          </div>
        </div>

        <!-- 카메라 버튼 -->
        <div class="flex-col-x-center gap-8px w-80px">
          <div
            @click="toggleVideo"
            class="size-44px rounded-full flex-center cursor-pointer"
            :class="isVideoEnabled ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
            <svg class="size-16px color-#fff">
              <use :href="isVideoEnabled ? '#video-one' : '#monitor-off'"></use>
            </svg>
          </div>
          <div class="text-12px text-gray-400 text-center">
            {{ isVideoEnabled ? t('message.call_window.camera_disable') : t('message.call_window.camera_enable') }}
          </div>
        </div>

        <!-- 종료 버튼 -->
        <div class="flex-col-x-center gap-8px w-80px">
          <div
            @click="hangUp()"
            class="size-44px rounded-full bg-#d5304f60 hover:bg-#d5304f80 flex-center cursor-pointer">
            <svg class="size-16px color-#fff">
              <use href="#PhoneHangup"></use>
            </svg>
          </div>
          <div class="text-12px text-gray-400 text-center">{{ t('message.call_window.hangup') }}</div>
        </div>
      </div>
    </div>

    <!-- 하단 제어 버튼 (음성 통화) -->
    <div v-if="callType !== CallTypeEnum.VIDEO" class="relative z-10">
      <div :class="isMobileDevice ? 'pb-120px' : 'pb-30px'" class="flex-col-x-center">
        <!-- 상단 버튼: 음소거, 스피커, 카메라 -->
        <div class="flex-center gap-40px mb-32px">
          <!-- 음소거 버튼 -->
          <div class="flex-col-x-center gap-8px w-80px">
            <div
              @click="toggleMute"
              class="size-44px rounded-full flex-center cursor-pointer"
              :class="!isMuted ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
              <svg class="size-16px color-#fff">
                <use :href="!isMuted ? '#voice' : '#voice-off'"></use>
              </svg>
            </div>
            <div v-if="!isMobileDevice" class="text-12px text-gray-400 text-center">
              {{ !isMuted ? t('message.call_window.mic_on') : t('message.call_window.mic_off') }}
            </div>
          </div>

          <!-- 스피커 버튼 -->
          <div class="flex-col-x-center gap-8px w-80px">
            <div
              @click="toggleSpeaker"
              class="size-44px rounded-full flex-center cursor-pointer"
              :class="isSpeakerOn ? 'bg-gray-600 hover:bg-gray-500' : 'bg-#d5304f60 hover:bg-#d5304f80'">
              <svg class="size-16px color-#fff">
                <use :href="isSpeakerOn ? '#volume-notice' : '#volume-mute'"></use>
              </svg>
            </div>
            <div v-if="!isMobileDevice" class="text-12px text-gray-400 text-center">
              {{ isSpeakerOn ? t('message.call_window.speaker_on') : t('message.call_window.speaker_off') }}
            </div>
          </div>
        </div>

        <!-- 하단 버튼: 종료 -->
        <div class="flex-x-center">
          <div
            @click="hangUp()"
            class="size-66px rounded-full bg-#d5304f60 hover:bg-#d5304f80 flex-center cursor-pointer">
            <svg class="size-24px color-#fff">
              <use href="#PhoneHangup"></use>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>

  <audio ref="remoteAudioRef" autoplay playsinline style="display: none"></audio>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { primaryMonitor } from '@tauri-apps/api/window'
import { info } from '@tauri-apps/plugin-log'
import { useRoute } from 'vue-router'
import type ActionBar from '@/components/windows/ActionBar.vue'
import { CallTypeEnum, RTCCallStatus, ThemeEnum } from '@/enums'
import { useWebRtc } from '@/hooks/useWebRtc'
import { useSettingStore } from '@/stores/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isDesktop, isMac, isMobile, isWindows } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import router from '@/router'
import { useGroupStore } from '@/stores/group'
import { CallResponseStatus } from '../../services/wsType'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const route = useRoute()

const resolveCallType = (value?: string | null): CallTypeEnum => {
  const numeric = Number(value)
  return numeric === CallTypeEnum.VIDEO ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
}

const remoteUserId = (route.query.remoteUserId as string) || ''
const roomId = (route.query.roomId as string) || ''
const callType = resolveCallType(route.query.callType as string | null)
// 수신자 여부, true면 수신자
const isReceiver = route.query.isIncoming === 'true'
const shouldAutoAccept = isReceiver && route.query.autoAccept === '1'
const isMobileDevice = isMobile()

if ((!roomId || !remoteUserId) && isMobileDevice) {
  router.replace('/mobile/message')
}
const {
  localStream,
  remoteStream,
  handleCallResponse,
  callDuration,
  connectionStatus,
  sendRtcCall2VideoCallResponse,
  toggleMute: toggleMuteWebRtc,
  toggleVideo: toggleVideoWebRtc,
  switchCameraFacing,
  isVideoEnabled,
  pauseBell,
  playBell,
  stopBell,
  startBell
} = useWebRtc(roomId, remoteUserId, callType, isReceiver)
const remoteAudioRef = ref<HTMLAudioElement>()
const isMuted = ref(false)
const isSpeakerOn = ref(true)
// 영상 통화 시 기본적으로 비디오 켬, 음성 통화 시 기본적으로 끔
const isVideoOn = ref(callType === CallTypeEnum.VIDEO)
const groupStore = useGroupStore()
// 원격 사용자 정보 가져오기
const remoteUserInfo = groupStore.getUserInfo(remoteUserId)!
// 비디오 요소 참조
const mainVideoRef = ref<HTMLVideoElement>()
const pipVideoRef = ref<HTMLVideoElement>()
// ActionBar 컴포넌트 참조
const actionBarRef = useTemplateRef<typeof ActionBar>('actionBarRef')
// 비디오 레이아웃 상태: false=원격 비디오 메인, true=로컬 비디오 메인
const isLocalVideoMain = ref(true)
// 통화 수락 상태
const isCallAccepted = ref(!isReceiver)

const createSize = (width: number, height: number) => {
  const size = isWindows() ? new LogicalSize(width, height) : new PhysicalSize(width, height)
  return size
}

const hangUp = (status: CallResponseStatus = CallResponseStatus.DROPPED) => {
  // 즉시 벨소리 중지
  stopBell()
  if (isMobileDevice) {
    if (router.currentRoute.value.path === '/mobile/rtcCall') {
      if (window.history.length > 1) {
        router.back()
      } else {
        router.replace('/mobile/message')
      }
    } else {
      router.back()
    }
  }
  handleCallResponse(status)
}

const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(remoteUserInfo.avatar as string))

const callStatusText = computed(() => {
  switch (connectionStatus.value) {
    case RTCCallStatus.CALLING:
      return t('message.call_window.status.calling')
    case RTCCallStatus.ACCEPT:
      return t('message.call_window.status.ongoing')
    case RTCCallStatus.END:
      return t('message.call_window.status.ended')
    default:
      return t('message.call_window.status.preparing')
  }
})

// 통화 시간 포맷팅
const formattedCallDuration = computed(() => {
  const duration = callDuration.value
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = duration % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
})

// 원격 스트림에 비디오 트랙이 있고 활성화되어 있는지 확인
const hasRemoteVideo = computed(() => {
  if (!remoteStream.value) return false
  const videoTracks = remoteStream.value.getVideoTracks()
  return videoTracks.length > 0 && videoTracks.some((track) => track.enabled)
})

// 로컬 비디오 활성화 여부 확인
const hasLocalVideo = computed(() => {
  return isVideoEnabled.value && !!localStream.value
})

// 창 최대화 상태 가져오기
const isWindowMaximized = computed(() => {
  return actionBarRef.value?.windowMaximized
})

const pipVideoSizeClass = computed(() => {
  if (!isMobileDevice) {
    return isWindowMaximized.value ? 'w-320px h-190px' : 'w-120px h-90px'
  }
  return 'w-140px h-160px'
})

// 준비 중 아바타 표시 여부
const shouldCenterPreparingAvatar = computed(() => {
  if (!isMobileDevice) {
    return false
  }

  if (!connectionStatus.value) {
    return true
  }

  return connectionStatus.value !== RTCCallStatus.END && connectionStatus.value !== RTCCallStatus.ERROR
})

// 비디오 스트림 할당 유틸리티 함수
const assignVideoStreams = async () => {
  await nextTick()

  if (!hasLocalVideo.value && !hasRemoteVideo.value) {
    // 양쪽 모두 비디오가 없으면 모든 비디오 요소 초기화
    clearVideoElements()
    return
  }

  if (hasLocalVideo.value && hasRemoteVideo.value) {
    // 양쪽 모두 비디오가 있으면 레이아웃에 따라 할당
    assignDualVideoStreams()
  } else if (hasLocalVideo.value) {
    // 로컬 비디오만 있음
    assignSingleVideoStream(localStream.value, true)
  } else if (hasRemoteVideo.value) {
    // 원격 비디오만 있음
    assignSingleVideoStream(remoteStream.value, false)
  }
}

// 비디오 요소 초기화
const clearVideoElements = () => {
  if (mainVideoRef.value) mainVideoRef.value.srcObject = null
  if (pipVideoRef.value) pipVideoRef.value.srcObject = null
}

// 듀얼 비디오 스트림 할당
const assignDualVideoStreams = () => {
  if (isLocalVideoMain.value) {
    // 로컬 비디오를 메인 비디오로 설정
    setVideoElement(mainVideoRef.value, localStream.value, true)
    setVideoElement(pipVideoRef.value, remoteStream.value)
  } else {
    // 원격 비디오를 메인 비디오로 설정
    setVideoElement(mainVideoRef.value, remoteStream.value)
    setVideoElement(pipVideoRef.value, localStream.value, true)
  }
}

// 단일 비디오 스트림 할당
const assignSingleVideoStream = (stream: MediaStream | null, isMuted: boolean) => {
  setVideoElement(mainVideoRef.value, stream, isMuted)
  setVideoElement(pipVideoRef.value, null, isMuted)
}

// 비디오 요소 설정
const setVideoElement = (
  videoElement: HTMLVideoElement | undefined,
  stream: MediaStream | null,
  isMuted: boolean = false
) => {
  if (!videoElement) return

  videoElement.srcObject = stream
  videoElement.muted = isMuted

  // 설정 완료 후 오디오 상태 일괄 업데이트
  if (stream) {
    nextTick(() => updateRemoteVideoAudio())
  }
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
  toggleMuteWebRtc()
}

// 모든 원격 비디오 요소의 오디오 상태 업데이트
const updateRemoteVideoAudio = () => {
  const shouldMute = !isSpeakerOn.value
  info(`updateRemoteVideoAudio, shouldMute: ${shouldMute}`)

  // 전용 오디오 요소 업데이트
  if (remoteAudioRef.value && remoteStream.value) {
    remoteAudioRef.value.srcObject = remoteStream.value
    remoteAudioRef.value.muted = shouldMute
  }

  // 메인 비디오가 원격 스트림인지 확인
  if (mainVideoRef.value && mainVideoRef.value.srcObject === remoteStream.value) {
    mainVideoRef.value.muted = shouldMute
  }

  // PIP 비디오가 원격 스트림인지 확인
  if (pipVideoRef.value && pipVideoRef.value.srcObject === remoteStream.value) {
    pipVideoRef.value.muted = shouldMute
  }
}

const toggleSpeaker = () => {
  isSpeakerOn.value = !isSpeakerOn.value
  updateRemoteVideoAudio()
  console.log('스피커 상태 전환:', isSpeakerOn.value, '원격 비디오 음소거:', !isSpeakerOn.value)

  if (connectionStatus.value === RTCCallStatus.CALLING && !isSpeakerOn.value) {
    pauseBell()
  } else if (connectionStatus.value === RTCCallStatus.CALLING && isSpeakerOn.value) {
    playBell()
  }
}

const toggleVideo = async () => {
  try {
    // WebRTC 레이어의 비디오 스위치 호출
    await toggleVideoWebRtc()

    // UI 상태 동기화
    isVideoOn.value = isVideoEnabled.value

    // 비디오 스트림 재할당
    await assignVideoStreams()
  } catch (error) {
    console.error('비디오 전환에 실패했습니다:', error)
  }
}

// 비디오 레이아웃 전환
const toggleVideoLayout = async () => {
  isLocalVideoMain.value = !isLocalVideoMain.value
  // 비디오 스트림 재할당
  await assignVideoStreams()
}

// 통화 수락
const acceptCall = async () => {
  // 즉시 벨소리 중지
  stopBell()
  isCallAccepted.value = true
  // 수락 응답 함수 호출
  sendRtcCall2VideoCallResponse(1)

  // 창 크기를 일반 통화 크기로 조정
  try {
    const currentWindow = WebviewWindow.getCurrent()
    const isVideo = callType === CallTypeEnum.VIDEO
    await currentWindow.setSize(createSize(isVideo ? 850 : 500, isVideo ? 580 : 650))
    await currentWindow.center()

    // 창 상단 고정 취소
    await currentWindow.setAlwaysOnTop(false)

    // 타이틀바 버튼 표시 복구
    if (isMac()) {
      await invokeSilently('show_title_bar_buttons', { windowLabel: currentWindow.label })
    }

    // 창 포커스 확보
    try {
      await currentWindow.setFocus()
    } catch (error) {
      console.warn('Failed to set window focus after accepting call:', error)
    }
  } catch (error) {
    console.error('Failed to resize window after accepting call:', error)
  }
}

// 비디오 상태 변화 감지, 비디오 표시 자동 업데이트
watch([hasLocalVideo, hasRemoteVideo, localStream, remoteStream], assignVideoStreams, { deep: true })

// 원격 스트림 변화 감지, 오디오 자동 설정
watch(
  remoteStream,
  (newStream) => {
    if (remoteAudioRef.value && newStream) {
      remoteAudioRef.value.srcObject = newStream
      remoteAudioRef.value.muted = !isSpeakerOn.value
    }
  },
  { immediate: true }
)

// 초기 비디오 상태 동기화
watch(
  isVideoEnabled,
  (newVal) => {
    isVideoOn.value = newVal
  },
  { immediate: true }
)

// 생명 주기
onMounted(async () => {
  if (isMobileDevice) {
    if (isReceiver && !isCallAccepted.value && !shouldAutoAccept) {
      startBell()
    }

    if (shouldAutoAccept && isReceiver && !isCallAccepted.value) {
      await nextTick()
      await acceptCall()
    }
    return
  }

  const currentWindow = WebviewWindow.getCurrent()

  // 창 닫기 이벤트 감지, 창 닫을 때 통화 종료 보장
  const unlistenCloseRequested = await currentWindow.onCloseRequested(async (_event) => {
    try {
      // 통화 상태인 경우 먼저 통화 종료 메시지 발송
      if (connectionStatus.value === RTCCallStatus.CALLING || connectionStatus.value === RTCCallStatus.ACCEPT) {
        await sendRtcCall2VideoCallResponse(CallResponseStatus.DROPPED)
        unlistenCloseRequested()
      }
    } catch (error) {
      console.error('통화 종료 메시지 발송 실패:', error)
    }
  })

  if (isDesktop()) {
    if (isReceiver && !isCallAccepted.value) {
      // 수신자 즉시 벨소리 재생 시작
      startBell()

      // 수신 알림 창의 올바른 크기 및 위치 설정
      await currentWindow.setSize(createSize(360, 90))

      // 타이틀바 숨기기 및 창 이동 불가 설정
      if (isMac()) {
        await invokeSilently('hide_title_bar_buttons', { windowLabel: currentWindow.label, hideCloseButton: true })
      }

      // 화면 크기 가져오기 및 위치 지정
      const monitor = await primaryMonitor()
      if (monitor) {
        const margin = 20
        const taskbarHeight = 40

        let screenWidth: number
        let screenHeight: number
        let x: number
        let y: number

        if (isWindows()) {
          // Windows는 논리 픽셀을 사용하여 계산, 창은 우측 하단에 위치
          screenWidth = monitor.size.width / (monitor.scaleFactor || 1)
          screenHeight = monitor.size.height / (monitor.scaleFactor || 1)
          x = Math.max(0, screenWidth - 360 - margin)
          y = Math.max(0, screenHeight - 90 - margin - taskbarHeight)
          await currentWindow.setPosition(new LogicalPosition(x, y))
        } else {
          // Mac은 물리 픽셀을 사용하여 계산, 창은 우측 상단에 위치
          screenWidth = monitor.size.width
          screenHeight = monitor.size.height
          x = Math.max(0, screenWidth - 360 - margin)
          y = margin
          await currentWindow.setPosition(new PhysicalPosition(x, y))
        }
      } else {
        // 주 모니터 정보를 가져올 수 없는 경우 화면 우측 하단의 추정 위치 사용
        await currentWindow.setPosition(new LogicalPosition(800, 600))
      }
      await currentWindow.setAlwaysOnTop(true)
    } else {
      // 일반 통화 창 설정
      await currentWindow.center()
      await currentWindow.setAlwaysOnTop(false)

      // 타이틀바 버튼 표시 보장 (수신 알림 상태가 아닌 경우)
      if (isMac()) {
        await invokeSilently('show_title_bar_buttons', { windowLabel: currentWindow.label })
      }
    }

    // 창 표시 보장
    await currentWindow.show()
    await currentWindow.setFocus()
  }
})

defineExpose({
  hangUp
})
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}
</style>
