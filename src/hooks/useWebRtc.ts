import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { error, info } from '@tauri-apps/plugin-log'
import { initConfig } from '@/utils/ImRequestUtils'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import rustWebSocketClient from '@/services/webSocketRust'
import { useUserStore } from '@/stores/user'
import { WsRequestMsgType, WsResponseMessageType } from '../services/wsType'
import { isMobile } from '../utils/PlatformConstants'
import { useMitt } from './useMitt'
import { useTauriListener } from './useTauriListener'

interface RtcMsgVO {
  roomId: string
  callType: CallTypeEnum
  callerId: string
  [key: string]: any
}

// 시그널링 유형 열거형
export enum SignalTypeEnum {
  JOIN = 'join',
  OFFER = 'offer',
  ANSWER = 'answer',
  CANDIDATE = 'candidate',
  LEAVE = 'leave'
}

export interface WSRtcCallMsg {
  // 방 ID
  roomId: string
  // 통화 ID
  callerId: string
  // 시그널링 유형
  signalType: SignalTypeEnum
  // 시그널
  signal: string
  // 수신자 ID 목록
  receiverIds: string[]
  // 발신자 ID
  senderId?: string
  // 통화 상태
  status: RTCCallStatus
  // 영상 통화 여부
  video: boolean
  // 대상 UID
  targetUid: string
}

// const TURN_SERVER = import.meta.env.VITE_TURN_SERVER_URL
const MAX_TIME_OUT_SECONDS = 30
let configuration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:117.72.67.248:3478' },
    {
      urls: ['turn:117.72.67.248:3478?transport=udp', 'turn:117.72.67.248:3478?transport=tcp'],
      username: 'chr',
      credential: '123456'
    }
  ],
  iceTransportPolicy: 'all'
}

const loadIceServers = async () => {
  try {
    const init: any = await initConfig()
    const ice = init?.iceServer
    if (ice && Array.isArray(ice.urls) && ice.urls.length > 0) {
      const entry: RTCIceServer =
        ice.username && ice.credential
          ? { urls: ice.urls, username: ice.username, credential: ice.credential }
          : { urls: ice.urls }
      configuration = { iceServers: [entry], iceTransportPolicy: 'all' }
      info(`ICE 구성 로드됨: ${JSON.stringify(configuration)}`)
    } else {
      info('ICE 구성이 비어 있어 내장 기본 구성을 사용합니다')
    }
  } catch (e) {
    error(`ICE 구성 로드 실패: ${String(e)}`)
  }
}

// const settings = await getSettings()
// configuration.iceServers?.push(settings.ice_server)
// const isSupportScreenSharing = !!navigator?.mediaDevices?.getDisplayMedia
// TODO 동적 구성으로 변경
const rtcCallBellUrl = '/sound/hula_bell.mp3'

/**
 * WebRTC 관련
 * @returns RTC 관련 상태 및 메서드
 */
export const useWebRtc = (roomId: string, remoteUserId: string, callType: CallTypeEnum, isReceiver: boolean) => {
  const { addListener } = useTauriListener()

  const router = useRouter()

  info(`useWebRtc, roomId: ${roomId}, remoteUserId: ${remoteUserId}, callType: ${callType}, isReceiver: ${isReceiver}`)
  const rtcMsg = ref<Partial<RtcMsgVO>>({
    roomId: undefined,
    callType: undefined,
    callerId: undefined
  })
  const userStore = useUserStore()

  // 장치 관련 상태
  const audioDevices = ref<MediaDeviceInfo[]>([])
  const videoDevices = ref<MediaDeviceInfo[]>([])
  const selectedAudioDevice = ref<string | null | undefined>(null)
  const selectedVideoDevice = ref<string | null | undefined>(null)

  // 상태
  const connectionStatus = ref<RTCCallStatus | undefined>(undefined)
  const isDeviceLoad = ref(false)
  const isLinker = ref(false) // WebRTC 연결 참여자 여부 판단

  // RTC 상태
  const rtcStatus = ref<RTCPeerConnectionState | undefined>(undefined)
  // const isRtcConnecting = computed(() => rtcStatus.value === 'connecting')
  // 스트림 관련 상태
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  // WebRTC 연결 객체
  const peerConnection = ref<RTCPeerConnection | null>(null)
  const channel = ref<RTCDataChannel | null>(null)
  const channelStatus = ref<RTCDataChannelState | undefined>(undefined)
  // 전송 대기 중인 ICE 목록
  const pendingCandidates = ref<RTCIceCandidate[]>([])
  // 벨소리 관련 상태 추가
  const bellAudio = ref<HTMLAudioElement | null>(null)

  // 타이머 참조 추가
  const callTimer = ref<NodeJS.Timeout | null>(null)

  // 타이머 관련 변수 추가
  const callDuration = ref(0)
  const animationFrameId = ref<number | null>(null)
  const startTime = ref<number>(0)

  // 화면 공유 관련 상태 추가
  const isScreenSharing = ref(false)
  const offer = ref<RTCSessionDescriptionInit>()

  // 연결 후 창이 포커스되어 표시되도록 보장
  const focusCurrentWindow = async () => {
    try {
      const currentWindow = getCurrentWebviewWindow()
      const visible = await currentWindow.isVisible()
      if (!visible) {
        await currentWindow.show()
      }
      const minimized = await currentWindow.isMinimized()
      if (minimized) {
        await currentWindow.unminimize()
      }
      await currentWindow.setFocus()
    } catch (e) {
      console.warn('창 포커스 설정 실패:', e)
    }
  }

  // 타이머 시작
  const startCallTimer = () => {
    // 고정밀 타임스탬프 가져오기
    startTime.value = performance.now()
    const animate = (currentTime: number) => {
      // 경과된 초 계산
      const elapsed = Math.floor((currentTime - startTime.value) / 1000)
      callDuration.value = elapsed
      // 재귀 호출, 애니메이션 루프 형성
      animationFrameId.value = requestAnimationFrame(animate)
    }
    animationFrameId.value = requestAnimationFrame(animate) // 애니메이션 루프 시작
  }

  // 타이머 중지
  const stopCallTimer = () => {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }
    callDuration.value = 0
    startTime.value = 0
  }

  /**
   * 벨소리 켜기
   */
  const startBell = () => {
    if (!rtcCallBellUrl) {
      console.log('RTC 통화가 이미 음소거되었습니다')
      bellAudio.value = null
      return
    }
    bellAudio.value = new Audio(rtcCallBellUrl)
    bellAudio.value!.loop = true
    bellAudio.value?.play?.()
  }

  /**
   * 통화 요청 전송
   */
  const sendCall = async () => {
    try {
      await rustWebSocketClient.sendMessage({
        type: WsRequestMsgType.VIDEO_CALL_REQUEST,
        data: {
          roomId: roomId,
          targetUid: remoteUserId,
          isVideo: callType === CallTypeEnum.VIDEO
        }
      })
    } catch (error) {
      console.error('통화 요청 전송 실패:', error)
    }
  }

  /**
   * 벨소리 끄기
   */
  const stopBell = () => {
    bellAudio.value?.pause?.()
    bellAudio.value = null
  }

  const pauseBell = () => {
    bellAudio.value?.pause?.()
  }

  const playBell = () => {
    bellAudio.value?.play?.()
  }

  /**
   * 전화 수신 응답 이벤트
   */
  const handleCallResponse = async (status: number) => {
    try {
      info('[알림 수신] 전화 수신 응답 이벤트')
      // 끊기 메시지 전송
      sendRtcCall2VideoCallResponse(status)
      await endCall()
    } finally {
      clear()
    }
  }

  /**
   * 통화 종료
   */
  const endCall = async () => {
    try {
      info('[알림 수신] 통화 종료')
      // 모바일 라우터 뒤로 가기
      if (!isMobile()) {
        await getCurrentWebviewWindow().close()
      } else {
        router.back()
      }
    } finally {
      clear()
    }
  }

  // WS 요청 전송, 양측에 통화 상태 알림
  // -1 = 시간 초과 0 = 거절 1 = 연결됨 2 = 끊기
  const sendRtcCall2VideoCallResponse = async (status: number) => {
    try {
      info(`WS 요청 전송, 양측에 통화 상태 알림 ${status}`)
      await rustWebSocketClient.sendMessage({
        type: WsRequestMsgType.VIDEO_CALL_RESPONSE,
        data: {
          callerUid: remoteUserId,
          roomId: roomId,
          accepted: status
        }
      })
    } catch (error) {
      console.error('통화 응답 전송 실패:', error)
    }
  }

  // 장치 목록 가져오기
  const getDevices = async () => {
    try {
      info('start getDevices')
      isDeviceLoad.value = true

      // 전체 장치 정보를 얻기 위해 먼저 권한 요청
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        stream.getTracks().forEach((track) => track.stop()) // 즉시 스트림 중지
      } catch (_permissionError) {
        error('Permission denied, will get limited device info')
      }

      const devices = (await navigator.mediaDevices.enumerateDevices()) || []
      info(`getDevices, devices: ${JSON.stringify(devices)}`)
      if (devices.length === 0) {
        return false
      }
      audioDevices.value = devices.filter((device) => device.kind === 'audioinput')
      videoDevices.value = devices.filter((device) => device.kind === 'videoinput')
      // "default" 또는 "첫 번째" 장치 기본 선택
      selectedAudioDevice.value =
        audioDevices.value.find((device) => device.deviceId === 'default')?.deviceId ||
        audioDevices.value?.[0]?.deviceId
      selectedVideoDevice.value =
        videoDevices.value.find((device) => device.deviceId === 'default')?.deviceId ||
        videoDevices.value?.[0]?.deviceId
      isDeviceLoad.value = false
      return true
    } catch (err) {
      window.$message.error('장치 가져오기 실패!')
      error(`장치 가져오기 실패: ${err}`)
      // 기본적으로 장치 없음
      selectedAudioDevice.value = selectedAudioDevice.value || null
      selectedVideoDevice.value = selectedVideoDevice.value || null
      isDeviceLoad.value = false
      return false
    }
  }

  // 로컬 미디어 스트림 가져오기
  const getLocalStream = async (type: CallTypeEnum) => {
    try {
      info('로컬 미디어 스트림 가져오기')
      const constraints = {
        audio: audioDevices.value.length > 0 ? { deviceId: selectedAudioDevice.value || undefined } : false,
        video:
          type === CallTypeEnum.VIDEO && videoDevices.value.length > 0
            ? { deviceId: selectedVideoDevice.value || undefined }
            : false
      }
      if (!constraints.audio && !constraints.video) {
        window.$message.error('사용 가능한 장치가 없습니다!')
        // 사용 가능한 장치가 없을 때 자동으로 끊고 창 닫기
        setTimeout(async () => {
          if (isReceiver) {
            // 수신자: 거절 응답 전송
            await handleCallResponse(0)
          } else {
            // 발신자: 통화 즉시 종료
            await handleCallResponse(2)
          }
        }, 1000)
        return false
      }
      localStream.value = await navigator.mediaDevices.getUserMedia(constraints)
      // localStream 정보 출력 (stream을 직접 직렬화하면 null이 반환됨)
      info(`get localStream success`)
      info(`localStream.id: ${localStream.value?.id}`)
      info(`localStream.active: ${localStream.value?.active}`)
      info(`localStream.getTracks().length: ${localStream.value?.getTracks()?.length}`)
      // 각 트랙 정보 출력
      localStream.value?.getTracks()?.forEach((track, index) => {
        info(`Track ${index}: kind=${track.kind}, label=${track.label}, enabled=${track.enabled}`)
      })

      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        // 오디오 트랙이 실제로 작동하는지 확인
        info(`Audio track enabled: ${audioTrack.enabled}`)
        info(`Audio track muted: ${audioTrack.muted}`)
        info(`Audio track readyState: ${audioTrack.readyState}`)

        // 오디오 트랙 강제 활성화
        audioTrack.enabled = true
      }

      return true
    } catch (err) {
      console.error('로컬 스트림 가져오기 실패:', err)
      window.$message.error('로컬 미디어 스트림 가져오기 실패, 장치를 확인하세요!')
      error(`로컬 미디어 스트림 가져오기 실패, 장치를 확인하세요! ${err}`)
      await sendRtcCall2VideoCallResponse(2)
      return false
    }
  }

  // RTCPeerConnection 생성
  const createPeerConnection = (roomId: string) => {
    try {
      const pc = new RTCPeerConnection(configuration)

      // 원격 스트림 수신 대기
      pc.ontrack = (event) => {
        info('PC에서 ontrack 이벤트 감지')
        if (event.streams[0]) {
          console.log('원격 스트림 수신:', event.streams[0])
          remoteStream.value = event.streams[0]
        } else {
          remoteStream.value = null
        }
      }

      // 로컬 스트림 추가
      info('PC에 로컬 스트림 추가')
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          localStream.value && pc.addTrack(track, localStream.value)
        })
      } else {
        console.warn('localStream이 null이므로 PeerConnection에 로컬 스트림을 추가할 수 없습니다')
      }

      // 연결 상태 변경 "closed" | "connected" | "connecting" | "disconnected" | "failed" | "new";
      pc.onconnectionstatechange = (e) => {
        info(`RTC 연결 상태 변경: ${pc.connectionState}`)
        switch (pc.connectionState) {
          case 'new':
            info('RTC 연결 새로 생성됨')
            break
          case 'connecting':
            info('RTC 연결 중')
            connectionStatus.value = RTCCallStatus.CALLING
            break
          case 'connected':
            info('RTC 연결 성공')
            connectionStatus.value = RTCCallStatus.ACCEPT
            startCallTimer() // 타이머 시작
            // 연결 후 창을 맨 위로 표시하고 포커스
            void focusCurrentWindow()
            break
          case 'disconnected':
            info('RTC 연결 끊김')
            connectionStatus.value = RTCCallStatus.END
            window.$message.error('RTC 통신 연결 실패!')
            setTimeout(async () => {
              await endCall()
            }, 500)
            break
          case 'closed':
            info('RTC 연결 닫힘')
            connectionStatus.value = RTCCallStatus.END
            setTimeout(async () => {
              await endCall()
            }, 500)
            break
          case 'failed':
            connectionStatus.value = RTCCallStatus.ERROR
            info('RTC 연결 실패')
            window.$message.error('RTC 통신 연결 실패!')
            setTimeout(async () => {
              await endCall()
            }, 500)
            break
          default:
            info('RTC 연결 상태 변경: ', pc.connectionState)
            break
        }
        // @ts-expect-error
        rtcStatus.value = (e?.currentTarget?.connectionState || pc.connectionState) as RTCPeerConnectionState
      }
      // 채널 생성
      channel.value = pc.createDataChannel('chat')
      channel.value.onopen = () => {
        // console.log("채널이 열렸습니다");
      }
      channel.value.onmessage = (_event) => {
        // console.log("메시지 수신:", event.data);
      }
      channel.value.onerror = (event) => {
        console.warn('채널 오류:', event)
      }
      channel.value.onclose = () => {
        // console.log("채널이 닫혔습니다");
      }
      pc.onicecandidate = async (event) => {
        info('PC에서 onicecandidate 이벤트 감지')
        if (event.candidate && roomId) {
          try {
            pendingCandidates.value.push(event.candidate)
          } catch (err) {
            console.error('ICE 후보 전송 오류:', err)
          }
        }
      }
      peerConnection.value = pc
    } catch (err) {
      console.error('PeerConnection 생성 실패:', err)
      connectionStatus.value = RTCCallStatus.ERROR
      throw err
    }
  }

  // 통화 시작
  const startCall = async (roomId: string, type: CallTypeEnum, uidList?: string[]) => {
    try {
      if (!roomId) {
        return false
      }
      clear() // 리소스 정리
      if (!(await getDevices())) {
        window.$message.error('장치 가져오기 실패!')
        // 장치 가져오기 실패 시 자동으로 창 닫기
        setTimeout(async () => {
          await handleCallResponse(0)
        }, 1000)
        return
      }
      // 통화 정보 저장
      rtcMsg.value = {
        roomId,
        callType: type,
        callerId: userStore.userInfo!.uid,
        uidList: uidList || []
      }
      isLinker.value = true // 대화 참여자로 표시
      // 30초 타임아웃 타이머 설정
      callTimer.value = setTimeout(() => {
        if (connectionStatus.value === RTCCallStatus.CALLING) {
          window.$message.warning('통화 응답이 없어 자동으로 끊습니다')
          endCall()
        }
      }, MAX_TIME_OUT_SECONDS * 1000)

      if (!(await getLocalStream(type))) {
        clear()
        // 로컬 미디어 스트림 가져오기 실패 시 자동으로 창 닫기
        setTimeout(async () => {
          await endCall()
        }, 1000)
        return false
      }

      // 1. RTCPeerConnection 생성
      createPeerConnection(roomId)
      // offer 생성 및 전송
      const rtcOffer = await peerConnection.value!.createOffer()
      offer.value = rtcOffer
      await peerConnection.value!.setLocalDescription(rtcOffer)
      // 통화 요청 시작
      await sendCall()
      // 벨소리 재생
      startBell()

      // 통화 시작
      connectionStatus.value = RTCCallStatus.CALLING
      rtcStatus.value = 'new'
    } catch (err) {
      console.error('통화 시작 실패:', err)
      window.$message.error('RTC 통신 연결 실패!')
      clear()
      return false
    }
  }

  // SDP offer 전송
  const sendOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo!.uid,
        roomId: roomId,
        signal: JSON.stringify(offer),
        signalType: 'offer',
        targetUid: remoteUserId,
        video: callType === CallTypeEnum.VIDEO
      }

      info('WS offer 전송')
      await rustWebSocketClient.sendMessage({
        type: WsRequestMsgType.WEBRTC_SIGNAL,
        data: signalData
      })
    } catch (error) {
      console.error('Failed to send SDP offer:', error)
    }
  }

  const clear = () => {
    try {
      // 벨소리 중지 및 초기화
      stopBell()
      // 타임아웃 타이머 지우기
      if (callTimer.value) {
        clearTimeout(callTimer.value)
        callTimer.value = null
      }
      // 타이머 중지
      stopCallTimer()
      // 채널 닫기
      channel.value?.close?.()
      // 연결 닫기
      peerConnection.value?.close?.()
      // 미디어 스트림 닫기
      localStream.value?.getTracks().forEach((track) => track.stop())
      remoteStream.value?.getTracks().forEach((track) => track.stop())
    } catch (error) {
      window.$message.error('일부 리소스 정리 실패!')
      console.error('리소스 정리 실패:', error)
    } finally {
      // 상태 초기화
      rtcMsg.value = {
        roomId: undefined,
        callType: undefined,
        senderId: undefined
      }
      pendingCandidates.value = []
      audioDevices.value = []
      videoDevices.value = []
      selectedAudioDevice.value = null
      selectedVideoDevice.value = null
      localStream.value = null
      remoteStream.value = null
      connectionStatus.value = undefined
      rtcStatus.value = undefined
      isScreenSharing.value = false
      isLinker.value = false
      // 연결 닫기
      peerConnection.value = null
      channel.value = null
      channelStatus.value = undefined
    }
  }

  // ICE 후보 전송
  const sendIceCandidate = async (candidate: RTCIceCandidate) => {
    try {
      info('ICE 후보 전송')
      const signalData = {
        roomId: roomId,
        signal: JSON.stringify(candidate),
        signalType: 'candidate',
        targetUid: remoteUserId,
        mediaType: callType === CallTypeEnum.VIDEO ? 'VideoSignal' : 'AudioSignal'
      }

      await rustWebSocketClient.sendMessage({
        type: WsRequestMsgType.WEBRTC_SIGNAL,
        data: signalData
      })
    } catch (error) {
      console.error('Failed to send ICE candidate:', error)
    }
  }

  // 수신된 offer 처리 - 수신자
  const handleOffer = async (signal: RTCSessionDescriptionInit, video: boolean, roomId: string) => {
    try {
      console.log('offer 처리')
      connectionStatus.value = RTCCallStatus.CALLING
      await nextTick()

      await getDevices()
      const hasLocalStream = await getLocalStream(video ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO)

      // 벨소리 중지
      stopBell()

      // 로컬 미디어 스트림 획득 성공 여부 확인
      if (!hasLocalStream || !localStream.value) {
        // 3초 대기
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await handleCallResponse(0)
        return false
      }

      // 2. RTCPeerConnection 생성
      await nextTick() // 한 프레임 대기
      createPeerConnection(roomId)
      rtcStatus.value = 'new'

      // 3. 원격 설명 설정
      info('원격 설명 설정')
      await peerConnection.value!.setRemoteDescription(signal)

      // 4. answer 생성 및 전송
      const answer = await peerConnection.value!.createAnswer()
      await peerConnection.value!.setLocalDescription(answer)

      if (!roomId) {
        window.$message.error('방 번호가 존재하지 않습니다. 다시 연결해 주세요!')
        return false
      }

      isLinker.value = true // 대화 참여자로 표시
      // 6. 원격으로 answer 시그널 전송
      await sendAnswer(answer)
      connectionStatus.value = RTCCallStatus.ACCEPT
      info('offer 처리 종료')
    } catch (e) {
      error(`offer 처리 실패: ${e}`)
      await endCall()
    }
  }

  // SDP answer 전송
  const sendAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo!.uid,
        roomId: roomId,
        signal: JSON.stringify(answer),
        signalType: SignalTypeEnum.ANSWER,
        targetUid: remoteUserId,
        video: callType === CallTypeEnum.VIDEO
      }

      console.log('SDP answer 전송', signalData)
      await rustWebSocketClient.sendMessage({
        type: WsRequestMsgType.WEBRTC_SIGNAL,
        data: signalData
      })

      console.log('SDP answer sent via WebSocket:', answer)
    } catch (error) {
      console.error('Failed to send SDP answer:', error)
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit, roomId: string) => {
    try {
      info('answer 메시지 처리')
      if (peerConnection.value) {
        // 타임아웃 타이머 지우기
        if (callTimer.value) {
          clearTimeout(callTimer.value)
          callTimer.value = null
        }

        // 2. 벨소리 중지
        stopBell()

        // 3. 서버에 통화 연결 알림
        if (!isReceiver) {
          if (!roomId) {
            window.$message.error('방 번호가 존재하지 않습니다. 다시 연결해 주세요!')
            await endCall()
            return
          }
          // 4. 발신자 - 원격 설명 설정
          console.log('발신자 - 원격 설명 설정', answer)
          await peerConnection.value.setRemoteDescription(answer)
        }
      }
    } catch (error) {
      console.error('answer 처리 실패:', error)
      connectionStatus.value = RTCCallStatus.ERROR
      await endCall()
    }
  }

  // ICE candidate 처리
  const handleCandidate = async (signal: RTCIceCandidateInit) => {
    try {
      if (peerConnection.value && peerConnection.value.remoteDescription) {
        info('candidate 추가')
        await peerConnection.value!.addIceCandidate(signal)
      }
    } catch (error) {
      console.error('candidate 처리 실패:', error)
    }
  }

  // 비디오 트랙 상태
  const isVideoEnabled = ref(callType === CallTypeEnum.VIDEO)

  // 음소거 전환
  const toggleMute = () => {
    if (localStream.value) {
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  }

  // 비디오 전환
  const toggleVideo = async () => {
    if (localStream.value) {
      const videoTrack = localStream.value.getVideoTracks()[0]
      if (videoTrack) {
        // 비디오 트랙 활성화 상태 전환
        videoTrack.enabled = !videoTrack.enabled
        isVideoEnabled.value = videoTrack.enabled

        console.log(`비디오 트랙 ${videoTrack.enabled ? '켜짐' : '꺼짐'}`)

        // 비디오를 끄는 경우 상대방에게 알림
        if (!videoTrack.enabled) {
          console.log('로컬 비디오가 꺼졌습니다. 상대방이 비디오를 볼 수 없습니다')
        } else {
          console.log('로컬 비디오가 켜졌습니다. 상대방이 비디오를 볼 수 있습니다')
        }
      } else if (callType === CallTypeEnum.VIDEO) {
        // 비디오 트랙이 없지만 영상 통화인 경우 다시 가져오기 시도
        try {
          const constraints = {
            audio: false,
            video: videoDevices.value.length > 0 ? { deviceId: selectedVideoDevice.value || undefined } : true
          }

          const newStream = await navigator.mediaDevices.getUserMedia(constraints)
          const newVideoTrack = newStream.getVideoTracks()[0]

          if (newVideoTrack && peerConnection.value) {
            // 새 비디오 트랙 추가
            peerConnection.value.addTrack(newVideoTrack, localStream.value!)
            localStream.value!.addTrack(newVideoTrack)
            isVideoEnabled.value = true

            console.log('비디오 트랙 다시 가져오기 성공')
          }
        } catch (error) {
          console.error('비디오 트랙 다시 가져오기 실패:', error)
          window.$message.error('카메라를 켤 수 없습니다')
        }
      }
    }
  }

  // 오디오 장치 전환
  const switchAudioDevice = async (deviceId: string) => {
    try {
      selectedAudioDevice.value = deviceId
      if (localStream.value) {
        const newStream = await navigator?.mediaDevices?.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
          video:
            rtcMsg.value.callType === CallTypeEnum.VIDEO
              ? selectedVideoDevice.value
                ? { deviceId: { exact: selectedVideoDevice.value || undefined } }
                : false
              : false
        })
        // 기존 트랙 교체
        const newAudioTrack = newStream.getAudioTracks()[0]
        const oldAudioTrack = localStream.value.getAudioTracks()[0]

        if (newAudioTrack) {
          if (!oldAudioTrack) {
            localStream.value.addTrack(newAudioTrack)
            peerConnection.value?.addTrack(newAudioTrack, localStream.value)
            return
          }
          peerConnection.value?.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === 'audio') {
              sender?.replaceTrack?.(newAudioTrack)
            }
          })
          oldAudioTrack && localStream.value.removeTrack(oldAudioTrack)
          localStream.value.addTrack(newAudioTrack)
        } else {
          window.$message.error('전환할 장치가 존재하지 않거나 지원되지 않습니다. 다시 선택해 주세요!')
        }
      }
    } catch (error) {
      window.$message.error('오디오 장치 전환 실패!')
      console.error('오디오 장치 전환 실패:', error)
    }
  }

  // 전면 및 후면 카메라 장치 가져오기
  const getFrontAndBackCameras = () => {
    const frontCamera = videoDevices.value.find(
      (device) =>
        device.label.toLowerCase().includes('front') ||
        device.label.toLowerCase().includes('전면') ||
        device.label.toLowerCase().includes('user')
    )

    const backCamera = videoDevices.value.find(
      (device) =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('후면') ||
        device.label.toLowerCase().includes('environment') ||
        device.label.toLowerCase().includes('rear')
    )

    return { frontCamera, backCamera }
  }

  // 전면/후면 카메라 전환 (모바일 전용)
  const switchCameraFacing = async () => {
    if (!isMobile) {
      console.warn('카메라 전환 기능은 모바일에서만 사용할 수 있습니다')
      return
    }

    try {
      const { frontCamera, backCamera } = getFrontAndBackCameras()

      if (!frontCamera || !backCamera) {
        // 장치 이름으로 식별할 수 없는 경우 facingMode 제약 조건 사용
        await switchVideoDevice('user')
        return
      }

      // 전면 및 후면 카메라를 식별할 수 있는 경우 직접 전환
      const currentDevice = selectedVideoDevice.value
      const targetDevice = currentDevice === frontCamera.deviceId ? backCamera : frontCamera
      await switchVideoDevice(targetDevice.deviceId)
    } catch (error) {
      window.$message.error('카메라 전환 실패!')
      console.error('카메라 전환 실패:', error)
    }
  }

  // 비디오 장치 전환
  const switchVideoDevice = async (deviceId: string) => {
    try {
      // 사전 검증
      selectedVideoDevice.value = deviceId
      if (localStream.value && localStream.value.getVideoTracks().length > 0) {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioDevice.value ? { deviceId: { exact: selectedAudioDevice.value || undefined } } : false,
          video: { deviceId: { exact: deviceId } }
        })

        // 기존 트랙 교체
        const newVideoTrack = newStream.getVideoTracks()[0]
        const oldVideoTrack = localStream.value.getVideoTracks()[0]
        // console.log(oldVideoTrack, newVideoTrack);

        if (newVideoTrack) {
          if (!oldVideoTrack) {
            localStream.value.addTrack(newVideoTrack)
            peerConnection.value?.addTrack(newVideoTrack, localStream.value)
            return
          }
          peerConnection.value?.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === 'video') {
              sender.replaceTrack(newVideoTrack)
            }
          })
          oldVideoTrack && localStream.value.removeTrack(oldVideoTrack)
          localStream.value.addTrack(newVideoTrack)
        } else {
          window.$message.error('전환할 장치가 존재하지 않거나 지원되지 않습니다. 다시 선택해 주세요!')
        }
      }
    } catch (error) {
      window.$message.error('비디오 장치 전환 실패!')
      console.error('비디오 장치 전환 실패:', error)
    }
  }

  // 화면 공유 중지
  const stopScreenShare = () => {
    if (isScreenSharing.value) {
      isScreenSharing.value = false
      // 현재 로컬 스트림 중지
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
      }
      if (!selectedVideoDevice.value || !rtcMsg.value.callType) {
        return false
      }
      // 기본 장치로 전환
      getLocalStream(rtcMsg.value.callType)
      // 원래 비디오 트랙 전환
      selectedVideoDevice.value && switchVideoDevice(selectedVideoDevice.value)
      return true
    }
    return false
  }

  // 화면 공유 시작
  const startScreenShare = async () => {
    try {
      if (!navigator?.mediaDevices?.getDisplayMedia) {
        window.$message.warning('현재 장치는 화면 공유 기능을 지원하지 않습니다!')
        return
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true // 오디오 공유가 필요한 경우
      })
      if (!screenStream) {
        return
      }

      // 현재 로컬 스트림 중지
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => track.stop())
      }

      // 로컬 스트림을 화면 공유 스트림으로 교체
      localStream.value = screenStream
      // 연결에 새 비디오 트랙 추가
      screenStream.getTracks().forEach((track) => {
        if (localStream.value) {
          peerConnection.value?.addTrack(track, localStream.value)
        }
      })
      // 원격을 화면 공유 스트림으로 교체
      const newVideoTrack = screenStream.getVideoTracks()[0]
      const oldVideoTrack = localStream.value.getVideoTracks()[0]
      if (!newVideoTrack) {
        window.$message.error('화면 공유 실패, 권한 설정을 확인하세요!')
        return
      }
      newVideoTrack.onended = () => {
        window.$message.warning('화면 공유가 종료되었습니다 ~')
        stopScreenShare()
      }
      peerConnection.value?.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          sender.replaceTrack(newVideoTrack)
        }
      })
      oldVideoTrack && localStream.value.removeTrack(oldVideoTrack)
      localStream.value.addTrack(newVideoTrack)
      isScreenSharing.value = true // 화면 공유 시작
    } catch (error: any) {
      console.error('화면 공유 시작 실패:', error)
      isScreenSharing.value = false
      stopScreenShare()
      if (error?.name === 'NotAllowedError') {
        window.$message.warning('화면 공유가 취소되었습니다...')
        return
      }
      window.$message.error('화면 공유 실패, 권한 설정을 확인하세요!')
    }
  }

  const lisendCandidate = async () => {
    if (!peerConnection.value) {
      return
    }

    info('첫 번째 ICE candidate 교환...')
    if (pendingCandidates.value.length > 0) {
      pendingCandidates.value.forEach(async (candidate) => {
        await sendIceCandidate(candidate)
      })
    }

    pendingCandidates.value = []

    peerConnection.value.onicecandidate = async (event) => {
      if (event.candidate) {
        info('두 번째 ICE candidate 교환...')
        await sendIceCandidate(event.candidate)
      }
    }
  }

  // 수신된 시그널링 메시지 처리
  const handleSignalMessage = async (data: WSRtcCallMsg) => {
    try {
      info('시그널링 메시지 처리')
      const signal = JSON.parse(data.signal)

      switch (data.signalType) {
        case SignalTypeEnum.OFFER:
          await handleOffer(signal, true, roomId)
          await lisendCandidate()
          break

        case SignalTypeEnum.ANSWER:
          await handleAnswer(signal, roomId)
          // offer candidate 전송
          await lisendCandidate()
          break

        case SignalTypeEnum.CANDIDATE:
          if (signal.candidate) {
            info('candidate 시그널 수신')
            await handleCandidate(signal)
          }
          break

        default:
          console.log('알 수 없는 시그널링 유형:', data.signalType)
      }
    } catch (error) {
      console.error('시그널링 메시지 처리 오류:', error)
    }
  }

  // WebRTC 시그널링 메시지 수신 대기 (등록 및 언로드 함수 저장)
  // useMitt.on(WsResponseMessageType.WEBRTC_SIGNAL, handleSignalMessage)
  void (async () => {
    await addListener(
      listen('ws-webrtc-signal', (event: any) => {
        info(`시그널링 메시지 수신: ${JSON.stringify(event.payload)}`)
        handleSignalMessage(event.payload)
      }),
      `${roomId}-ws-webrtc-signal`
    )
    await addListener(
      listen('ws-call-accepted', (event: any) => {
        info(`통화 수락됨: ${JSON.stringify(event.payload)}`)
        // // 수신자, 수락 여부 전송
        // info(`CallAccepted 메시지 수신 ${isReceiver}`)
        if (!isReceiver) {
          sendOffer(offer.value!)
          // 상대방이 연결하면 발신자 창을 맨 앞으로 가져오고 포커스
          void focusCurrentWindow()
        }
      }),
      `${roomId}-ws-call-accepted`
    )
    await addListener(
      listen('ws-room-closed', (event: any) => {
        info(`방이 닫힘: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-room-closed`
    )
    await addListener(
      listen('ws-dropped', (_: any) => {
        endCall()
      }),
      `${roomId}-ws-dropped`
    )
    await addListener(
      listen('ws-call-rejected', (event: any) => {
        info(`통화 거절됨: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-call-rejected`
    )
    await addListener(
      listen('ws-cancel', (event: any) => {
        info(`통화 취소됨: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-cancel`
    )
    await addListener(
      listen('ws-timeout', (event: any) => {
        info(`통화 취소됨: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-timeout`
    )
  })()

  onMounted(async () => {
    await loadIceServers()
    if (!isReceiver) {
      console.log(`발신자가 ${callType === CallTypeEnum.VIDEO ? '영상' : '음성'} 통화 요청을 보냄`)
      await startCall(roomId, callType, [remoteUserId])
    }
  })

  onUnmounted(() => {
    // WebRTC 시그널링 메시지 리스너 제거
    useMitt.off(WsResponseMessageType.WEBRTC_SIGNAL, handleSignalMessage)
  })

  return {
    startCallTimer,
    stopScreenShare,
    startScreenShare,
    toggleVideo,
    switchVideoDevice,
    switchCameraFacing,
    switchAudioDevice,
    isScreenSharing,
    selectedVideoDevice,
    selectedAudioDevice,
    localStream,
    remoteStream,
    peerConnection,
    getLocalStream,
    startCall,
    handleCallResponse,
    callDuration,
    connectionStatus,
    toggleMute,
    sendRtcCall2VideoCallResponse,
    isVideoEnabled,
    stopBell,
    startBell,
    pauseBell,
    playBell
  }
}
