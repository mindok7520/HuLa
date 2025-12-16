import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { save } from '@tauri-apps/plugin-dialog'
import { BaseDirectory } from '@tauri-apps/plugin-fs'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import type { FileTypeResult } from 'file-type'
import { computed, onUnmounted, type InjectionKey } from 'vue'
import { ErrorType } from '@/common/exception'
import {
  MergeMessageType,
  MittEnum,
  MsgEnum,
  PowerEnum,
  CallTypeEnum,
  RoleEnum,
  RoomTypeEnum,
  TauriCommand
} from '@/enums'
import { useCommon } from '@/hooks/useCommon.ts'
import { useDownload } from '@/hooks/useDownload'
import { useMitt } from '@/hooks/useMitt.ts'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import { translateTextStream } from '@/services/translate'
import type { FilesMeta, MessageType, RightMouseMessageItem } from '@/services/types.ts'
import { useCachedStore } from '@/stores/cached'
import { useChatStore } from '@/stores/chat.ts'
import { useContactStore } from '@/stores/contacts'
import { useEmojiStore } from '@/stores/emoji'
import { type FileDownloadStatus, useFileDownloadStore } from '@/stores/fileDownload'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { isDiffNow } from '@/utils/ComputedTime.ts'
import { extractFileName, removeTag } from '@/utils/Formatting'
import { detectImageFormat, imageUrlToUint8Array, isImageUrl } from '@/utils/ImageUtils'
import { recallMsg, removeGroupMember, updateMyRoomInfo } from '@/utils/ImRequestUtils'
import { detectRemoteFileType, getFilesMeta } from '@/utils/PathUtil'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useWindow } from './useWindow'
import { useI18n } from 'vue-i18n'

type UseChatMainOptions = {
  enableGroupNicknameModal?: boolean
  disableHistoryActions?: boolean
}

type GroupNicknameModalPayload = {
  roomId: string
  currentUid: string
  originalNickname: string
}

export const useChatMain = (isHistoryMode = false, options: UseChatMainOptions = {}) => {
  const { t } = useI18n()
  const { openMsgSession, userUid } = useCommon()
  const { createWebviewWindow, sendWindowPayload, startRtcCall } = useWindow()
  const { getLocalVideoPath, checkVideoDownloaded } = useVideoViewer()
  const fileDownloadStore = useFileDownloadStore()
  const settingStore = useSettingStore()
  const { chat } = storeToRefs(settingStore)
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const chatStore = useChatStore()
  const cachedStore = useCachedStore()
  const emojiStore = useEmojiStore()
  const userStore = useUserStore()
  const { downloadFile } = useDownload()
  const enableGroupNicknameModal = options.enableGroupNicknameModal ?? false
  const disableHistoryActions = options.disableHistoryActions ?? false
  /** 스크롤 바 위치 */
  const scrollTop = ref(-1)
  /** 알림 상자 제목 */
  const tips = ref()
  /** 메시지 삭제 팝업 표시 여부 */
  const modalShow = ref(false)
  /** 삭제할 메시지의 인덱스 */
  const delIndex = ref('')
  const delRoomId = ref('')
  /** 선택된 말풍선 메시지 */
  const activeBubble = ref('')
  /** 기록된 히스토리 메시지 인덱스 */
  const historyIndex = ref(0)
  /** 현재 클릭된 사용자의 키 */
  const selectKey = ref()

  /** 그룹 닉네임 수정 모달 표시 여부 */
  const groupNicknameModalVisible = ref(false)
  /** 그룹 닉네임 입력 값 */
  const groupNicknameValue = ref('')
  /** 그룹 닉네임 오류 팁 */
  const groupNicknameError = ref('')
  /** 그룹 닉네임 제출 상태 */
  const groupNicknameSubmitting = ref(false)
  /** 그룹 닉네임 컨텍스트 정보 */
  const groupNicknameContext = ref<{ roomId: string; currentUid: string; originalNickname: string } | null>(null)

  const handleGroupNicknameConfirm = async () => {
    if (!groupNicknameContext.value) {
      return
    }

    const trimmedName = groupNicknameValue.value.trim()
    if (!trimmedName) {
      groupNicknameError.value = '그룹 닉네임은 비워둘 수 없습니다'
      return
    }

    if (trimmedName === groupNicknameContext.value.originalNickname) {
      groupNicknameModalVisible.value = false
      return
    }

    const { roomId, currentUid } = groupNicknameContext.value
    if (!roomId) {
      window.$message?.error('현재 그룹 채팅 정보가 비정상적입니다')
      return
    }

    try {
      groupNicknameSubmitting.value = true
      const remark = groupStore.countInfo?.remark || ''
      const payload = {
        id: roomId,
        myName: trimmedName,
        remark
      }
      await cachedStore.updateMyRoomInfo(payload)
      await updateMyRoomInfo(payload)
      groupStore.updateUserItem(currentUid, { myName: trimmedName }, roomId)
      await groupStore.updateGroupDetail(roomId, { myName: trimmedName })
      if (currentUid === userUid.value) {
        groupStore.myNameInCurrentGroup = trimmedName
      }
      groupNicknameModalVisible.value = false
    } catch (error) {
      console.error('그룹 닉네임 수정 실패', error)
      groupNicknameSubmitting.value = false
    }
  }

  if (enableGroupNicknameModal) {
    useMitt.on(MittEnum.OPEN_GROUP_NICKNAME_MODAL, (payload: GroupNicknameModalPayload) => {
      groupNicknameContext.value = payload
      groupNicknameValue.value = payload.originalNickname || ''
      groupNicknameError.value = ''
      groupNicknameSubmitting.value = false
      groupNicknameModalVisible.value = true
    })
  }

  /** 일반 우클릭 메뉴 */
  const handleForward = async (item: MessageType) => {
    if (!item?.message?.id) return
    const target = chatStore.chatMessageList.find((msg) => msg.message.id === item.message.id)
    if (!target) {
      return
    }
    chatStore.clearMsgCheck()
    target.isCheck = true
    chatStore.setMsgMultiChoose(true, 'forward')
    await nextTick()
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: MergeMessageType.SINGLE
    })
  }

  // 복사 비활성화 유형
  const copyDisabledTypes: MsgEnum[] = [MsgEnum.NOTICE, MsgEnum.MERGE, MsgEnum.LOCATION, MsgEnum.VOICE]
  const shouldHideCopy = (item: MessageType) => copyDisabledTypes.includes(item.message.type)
  const isNoticeMessage = (item: MessageType) => item.message.type === MsgEnum.NOTICE
  const revealInDirSafely = async (targetPath?: string | null) => {
    if (!targetPath) {
      window.$message?.error('일시적으로 로컬 파일을 찾을 수 없습니다. 다운로드 후 다시 시도해주세요~')
      return
    }
    try {
      await revealItemInDir(targetPath)
    } catch (error) {
      console.error('폴더에서 파일 표시 실패:', error)
      window.$message?.error('폴더에서 이 파일을 표시할 수 없습니다')
    }
  }

  const commonMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.select'),
      icon: 'list-checkbox',
      click: () => {
        chatStore.setMsgMultiChoose(true)
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    {
      label: () => t('menu.add_sticker'),
      icon: 'add-expression',
      click: async (item: MessageType) => {
        const imageUrl = item.message.body.url || item.message.body.content
        if (!imageUrl) {
          window.$message.error('이미지 주소 가져오기 실패')
          return
        }
        await emojiStore.addEmoji(imageUrl)
      },
      visible: (item: MessageType) => {
        return item.message.type === MsgEnum.IMAGE || item.message.type === MsgEnum.EMOJI
      }
    },
    {
      label: () => t('menu.forward'),
      icon: 'share',
      click: (item: MessageType) => {
        if (isMobile()) {
          window.$message.warning('기능 개발 중')
          return
        }
        handleForward(item)
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    // {
    //   label: '즈겨찾기',
    //   icon: 'collection-files',
    //   click: () => {
    //     window.$message.warning('아직 구현되지 않음')
    //   }
    // },
    {
      label: () => t('menu.reply'),
      icon: 'reply',
      click: (item: any) => {
        useMitt.emit(MittEnum.REPLY_MEG, item)
      }
    },
    {
      label: () => t('menu.recall'),
      icon: 'corner-down-left',
      click: async (item: MessageType) => {
        const msg = { ...item }
        // API 호출 전 원본 유형 저장, WebSocket 메시지가 먼저 도착하여 type이 수정되는 것을 방지
        const originalType = item.message.type
        const originalContent = item.message.body.content
        const res = await recallMsg({ roomId: globalStore.currentSessionRoomId, msgId: item.message.id })
        if (res) {
          window.$message.error(res)
          return
        }
        chatStore.recordRecallMsg({
          recallUid: userStore.userInfo!.uid,
          msg,
          originalType,
          originalContent
        })
        await chatStore.updateRecallMsg({
          recallUid: userStore.userInfo!.uid,
          roomId: msg.message.roomId,
          msgId: msg.message.id
        })
      },
      visible: (item: MessageType) => {
        const isSystemAdmin = userStore.userInfo?.power === PowerEnum.ADMIN
        if (isSystemAdmin) {
          return true
        }

        const isGroupSession = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        const groupMembers = groupStore.userList
        const currentMember = isGroupSession ? groupMembers.find((member) => member.uid === userUid.value) : undefined
        const isGroupManager =
          isGroupSession &&
          (currentMember?.roleId === RoleEnum.LORD ||
            currentMember?.roleId === RoleEnum.ADMIN ||
            groupStore.currentLordId === userUid.value ||
            groupStore.adminUidList.includes(userUid.value))

        if (isGroupManager) {
          return true
        }

        const isCurrentUser = item.fromUser.uid === userUid.value
        if (!isCurrentUser) {
          return false
        }

        return !isDiffNow({ time: item.message.sendTime, unit: 'minute', diff: 2 })
      }
    }
  ])
  const videoMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: (item: MessageType) => {
        if (isMobile()) {
          window.$message.warning('기능 개발 중')
          return
        }
        handleCopy(item.message.body.url, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: MessageType) => {
        if (isMobile()) {
          window.$message.warning('기능 개발 중')
          return
        }
        await saveVideoAttachmentAs({
          url: item.message.body.url,
          downloadFile,
          defaultFileName: item.message.body.fileName
        })
      }
    },

    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: MessageType) => {
        try {
          const localPath = await getLocalVideoPath(item.message.body.url)

          // 비디오 다운로드 여부 확인
          const isDownloaded = await checkVideoDownloaded(item.message.body.url)

          if (!isDownloaded) {
            // 다운로드되지 않은 경우 먼저 비디오 다운로드
            const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
            await downloadFile(item.message.body.url, localPath, baseDir)
            // 관련 컴포넌트에 비디오 다운로드 상태 업데이트 알림
            useMitt.emit(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, { url: item.message.body.url, downloaded: true })
          }

          // 비디오 절대 경로 가져오기
          const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
          const absolutePath = await join(baseDirPath, localPath)
          await revealInDirSafely(absolutePath)
        } catch (error) {
          console.error('Failed to show video in folder:', error)
        }
      }
    }
  ])
  /** 우클릭 메시지 메뉴 목록 */
  const menuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: (item: MessageType) => {
        handleCopy(item.message.body.content, true, item.message.id)
      },
      visible: (item: MessageType) => !shouldHideCopy(item)
    },
    {
      label: () => t('menu.translate'),
      icon: 'translate',
      click: async (item: MessageType) => {
        const selectedText = getSelectedText(item.message.id)
        if (!selectedText && item.message.body.translatedText) {
          delete item.message.body.translatedText
          return
        }

        const content = selectedText || item.message.body.content
        if (!content) {
          window.$message?.warning('번역할 내용이 없습니다')
          return
        }

        item.message.body.translatedText = { provider: chat.value.translate || 'tencent', text: '' }
        await translateTextStream(content, chat.value.translate || 'tencent', (seg) => {
          const prev = item.message.body.translatedText?.text || ''
          item.message.body.translatedText = { provider: chat.value.translate || 'tencent', text: prev + seg }
        })
      },
      visible: (item: MessageType) => item.message.type === MsgEnum.TEXT
    },

    ...commonMenuList.value
  ])
  const specialMenuList = computed(() => {
    return (messageType?: MsgEnum): OPT.RightMenu[] => {
      if (isHistoryMode) {
        // 히스토리 모드: 기본 메뉴 (복사, 전달)
        const baseMenus: OPT.RightMenu[] = [
          {
            label: () => t('menu.copy'),
            icon: 'copy',
            click: (item: MessageType) => {
              const content = item.message.body.url || item.message.body.content
              handleCopy(content, true, item.message.id)
            }
          }
        ]

        if (!disableHistoryActions) {
          baseMenus.push(
            {
              label: () => t('menu.select'),
              icon: 'list-checkbox',
              click: () => {
                chatStore.setMsgMultiChoose(true)
              }
            },
            {
              label: () => t('menu.forward'),
              icon: 'share',
              click: (item: MessageType) => {
                handleForward(item)
              }
            }
          )
        }

        // 미디어 파일 추가 메뉴 (즐겨찾기, 다른 이름으로 저장, 파일에서 열기)
        if (
          messageType === MsgEnum.IMAGE ||
          messageType === MsgEnum.EMOJI ||
          messageType === MsgEnum.VIDEO ||
          messageType === MsgEnum.FILE
        ) {
          const mediaMenus: OPT.RightMenu[] = [
            // {
            //   label: '즈겨찾기',
            //   icon: 'collection-files',
            //   click: () => {
            //     window.$message.warning('아직 구현되지 않음')
            //   }
            // },
            {
              label: () => t('menu.save_as'),
              icon: 'Importing',
              click: async (item: MessageType) => {
                if (isMobile()) {
                  window.$message.warning('기능 개발 중')
                  return
                }
                const fileUrl = item.message.body.url
                const fileName = item.message.body.fileName
                if (item.message.type === MsgEnum.VIDEO) {
                  await saveVideoAttachmentAs({
                    url: fileUrl,
                    downloadFile,
                    defaultFileName: fileName
                  })
                } else {
                  await saveFileAttachmentAs({
                    url: fileUrl,
                    downloadFile,
                    defaultFileName: fileName
                  })
                }
              }
            },

            {
              label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
              icon: 'file2',
              click: async (item: RightMouseMessageItem) => {
                console.log('폴더 열기 item 항목:', item)

                const fileUrl = item.message.body.url
                const fileName = item.message.body.fileName || extractFileName(fileUrl)

                // 파일 다운로드 여부 확인
                const fileStatus = fileDownloadStore.getFileStatus(fileUrl)

                console.log('찾은 파일 상태:', fileStatus)
                const currentChatRoomId = globalStore.currentSessionRoomId // 이 ID는 그룹 ID일 수도 있고 사용자 UID일 수도 있으므로 사용자 UID만 사용할 수 없음
                const currentUserUid = userStore.userInfo!.uid as string

                const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
                let absolutePath = await join(resourceDirPath, fileName)

                const [fileMeta] = await getFilesMeta<FilesMeta>([fileStatus?.absolutePath || absolutePath || fileUrl])

                // 마지막으로 로컬에 파일이 없으면 다운로드
                if (!fileMeta.exists) {
                  // 로컬에 파일 없음
                  const downloadMessage = window.$message.info('파일이 다운로드되지 않았습니다~ 파일을 다운로드한 후 다시 열어주세요🚀...')
                  const _absolutePath = await fileDownloadStore.downloadFile(fileUrl, fileName)

                  if (_absolutePath) {
                    absolutePath = _absolutePath
                    downloadMessage.destroy()
                    window.$message.success('파일 다운로드 완료! 확인해주세요~')
                    await revealInDirSafely(_absolutePath)
                    await fileDownloadStore.refreshFileDownloadStatus({
                      fileUrl: item.message.body.url,
                      roomId: currentChatRoomId,
                      userId: currentUserUid,
                      fileName: item.message.body.fileName,
                      exists: true
                    })
                    return
                  } else {
                    absolutePath = ''
                    window.$message.error('파일 다운로드 실패, 다시 시도해주세요~')
                    return
                  }
                }

                await revealInDirSafely(absolutePath)
              }
            }
          ]
          return [...baseMenus, ...mediaMenus]
        }

        return baseMenus
      } else {
        // 일반 채팅 모드: 삭제만 표시
        return [
          {
            label: () => t('menu.del'),
            icon: 'delete',
            click: (item: any) => {
              tips.value = '삭제 후 메시지 기록에 나타나지 않습니다. 삭제하시겠습니까?'
              modalShow.value = true
              delIndex.value = item.message.id
              delRoomId.value = item.message.roomId
            }
          }
        ]
      }
    }
  })
  /** 파일 유형 우클릭 메뉴 */
  const fileMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.preview'),
      icon: 'preview-open',
      click: (item: RightMouseMessageItem) => {
        console.log('파일 미리보기 매개변수:', item)
        nextTick(async () => {
          const path = 'previewFile'
          const LABEL = 'previewFile'

          const fileStatus: FileDownloadStatus = fileDownloadStore.getFileStatus(item.message.body.url)

          const currentChatRoomId = globalStore.currentSessionRoomId // 이 ID는 그룹 ID일 수도 있고 사용자 UID일 수도 있으므로 사용자 UID만 사용할 수 없음
          const currentUserUid = userStore.userInfo!.uid as string

          /**
           * 파일 미리보기에 필요한 payload 데이터를 구성합니다.
           *
           * 사용자 ID, 방 ID, 메시지 ID, 파일 경로, 유형, 로컬 존재 여부 등을 포함합니다.
           * 로컬에 파일이 존재하면 url은 로컬 경로를 사용하고, 그렇지 않으면 원격 URL을 사용합니다.
           *
           * @param item - 우클릭한 메시지 항목, 파일의 메시지 구조와 사용자 정보를 포함합니다.
           * @param type - 파일 유형 정보 (확장자 및 MIME 유형), 비어 있을 수 있습니다.
           * @param localExists - 파일이 로컬에 존재하는지 여부, 경로 선택에 사용됩니다.
           * @returns 구성된 payload 객체.
           */
          const buildPayload = (
            item: RightMouseMessageItem,
            type: FileTypeResult | undefined,
            localExists: boolean
          ) => {
            const payload = {
              userId: currentUserUid,
              roomId: currentChatRoomId,
              messageId: item.message.id,
              resourceFile: {
                fileName: item.message.body.fileName,
                absolutePath: fileStatus?.absolutePath,
                nativePath: fileStatus?.nativePath,
                url: item.message.body.url,
                type,
                localExists
              }
            }
            return payload
          }

          /**
           * 로컬 파일이 없거나 메타데이터를 가져오지 못한 경우, 원격 파일 유형 감지를 수행하고 fallback payload를 구성합니다.
           *
           * 구성이 완료되면 창 통신 인터페이스를 통해 해당 payload를 전송하여 대상 창에서 사용할 수 있도록 합니다.
           *
           * @returns Promise<void>
           */
          const fallbackToRemotePayload = async () => {
            const remoteType = await detectRemoteFileType({
              url: item.message.body.url,
              fileSize: Number(item.message.body.size)
            })
            const fallbackPayload = buildPayload(item, remoteType, false)
            await sendWindowPayload(LABEL, fallbackPayload)
          }

          // 여기서 상태의 absolute를 사용하지 않는 이유는 상태의 절대 경로가 존재하는지 완전히 신뢰할 수 없기 때문입니다. 때로는 존재하지 않을 수 있습니다.
          const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
          const absolutePath = await join(resourceDirPath, item.message.body.fileName)

          // 파일 메타 정보 가져오기 (파일 다운로드/존재 여부 판단)
          const result = await getFilesMeta<FilesMeta>([
            fileStatus?.absolutePath || absolutePath || item.message.body.url
          ])
          const fileMeta = result[0]

          try {
            // 로컬에 해당 파일이 없으면 이전 다운로드 상태를 지우고 원격 링크를 읽을 준비를 합니다.
            if (!fileMeta.exists) {
              await fallbackToRemotePayload()
            } else {
              // 로컬에 파일이 존재하면 로컬 경로와 알려진 유형을 사용하여 payload 구성
              const payload = buildPayload(
                item,
                {
                  ext: fileMeta.file_type,
                  mime: fileMeta.mime_type
                },
                fileMeta.exists
              )

              await sendWindowPayload(LABEL, payload)
            }
          } catch (error) {
            // 로컬 정보 가져오기 실패, 경로가 잘못되었거나 RPC 예외일 수 있음, 원격 파싱으로 대체
            await fallbackToRemotePayload()
            console.error('파일 확인 오류:', error)
          }

          console.log('미리보기 시 다운로드 상태 새로 고침')
          await fileDownloadStore.refreshFileDownloadStatus({
            fileUrl: item.message.body.url,
            roomId: currentChatRoomId,
            userId: currentUserUid,
            fileName: item.message.body.fileName,
            exists: fileMeta.exists
          })

          // 마지막으로 파일 미리보기를 위한 WebView 창 생성
          await createWebviewWindow('파일 미리보기', path, 860, 720, '', true)
        })
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: RightMouseMessageItem) => {
        if (isMobile()) {
          window.$message.warning('기능 개발 중')
          return
        }
        await saveFileAttachmentAs({
          url: item.message.body.url,
          downloadFile,
          defaultFileName: item.message.body.fileName
        })
      }
    },

    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: RightMouseMessageItem) => {
        console.log('폴더 열기 item 항목:', item)

        const fileUrl = item.message.body.url
        const fileName = item.message.body.fileName || extractFileName(fileUrl)

        // 파일 다운로드 여부 확인
        const fileStatus = fileDownloadStore.getFileStatus(fileUrl)

        console.log('찾은 파일 상태:', fileStatus)
        const currentChatRoomId = globalStore.currentSessionRoomId // 이 ID는 그룹 ID일 수도 있고 사용자 UID일 수도 있으므로 사용자 UID만 사용할 수 없음
        const currentUserUid = userStore.userInfo!.uid as string

        const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
        let absolutePath = await join(resourceDirPath, fileName)

        const [fileMeta] = await getFilesMeta<FilesMeta>([fileStatus?.absolutePath || absolutePath || fileUrl])

        // 마지막으로 로컬에 파일이 없으면 다운로드
        if (!fileMeta.exists) {
          // 로컬에 파일 없음
          const downloadMessage = window.$message.info('파일이 다운로드되지 않았습니다, 파일을 다운로드한 후 다시 열어주세요')
          const _absolutePath = await fileDownloadStore.downloadFile(fileUrl, fileName)

          if (_absolutePath) {
            absolutePath = _absolutePath
            downloadMessage.destroy()
            window.$message.success('파일이 로컬에 저장되었습니다')
            await revealInDirSafely(_absolutePath)
            await fileDownloadStore.refreshFileDownloadStatus({
              fileUrl: item.message.body.url,
              roomId: currentChatRoomId,
              userId: currentUserUid,
              fileName: item.message.body.fileName,
              exists: true
            })
            return
          } else {
            absolutePath = ''
            window.$message.error('파일 다운로드 실패, 다시 시도해주세요')
            return
          }
        }

        await revealInDirSafely(absolutePath)
      }
    }
  ])
  /** 이미지 유형 우클릭 메뉴 */
  const imageMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: async (item: MessageType) => {
        // 이미지 메시지의 경우 url 필드를 우선 사용하고 content 필드로 대체
        const imageUrl = item.message.body.url || item.message.body.content
        await handleCopy(imageUrl, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: MessageType) => {
        if (isMobile()) {
          window.$message.warning('기능 개발 중')
          return
        }
        try {
          const imageUrl = item.message.body.url
          const suggestedName = imageUrl || 'image.png'

          // 여기서는 url 뒤의 파일 이름을 자동으로 자릅니다. 인쇄를 시도해 볼 수 있습니다.
          const savePath = await save({
            filters: [
              {
                name: '이미지',
                extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
              }
            ],
            defaultPath: suggestedName
          })

          if (savePath) {
            await downloadFile(imageUrl, savePath)
          }
        } catch (error) {
          console.error('이미지 저장 실패:', error)
          window.$message.error('이미지 저장 실패')
        }
      }
    },
    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: MessageType) => {
        const fileUrl = item.message.body.url || item.message.body.content
        const fileName = item.message.body.fileName || extractFileName(fileUrl)
        if (!fileUrl || !fileName) {
          window.$message.warning('일시적으로 해당 이미지를 찾을 수 없습니다~')
          return
        }

        const fileStatus = fileDownloadStore.getFileStatus(fileUrl)
        const currentChatRoomId = globalStore.currentSessionRoomId
        const currentUserUid = userStore.userInfo!.uid as string

        const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
        let absolutePath = await join(resourceDirPath, fileName)

        const [fileMeta] = await getFilesMeta<FilesMeta>([fileStatus?.absolutePath || absolutePath || fileUrl])

        if (!fileMeta.exists) {
          const downloadMessage = window.$message.info('이미지가 다운로드되지 않았습니다. 로컬에 저장 중입니다...')
          const _absolutePath = await fileDownloadStore.downloadFile(fileUrl, fileName)

          if (_absolutePath) {
            absolutePath = _absolutePath
            downloadMessage.destroy()
            window.$message.success('이미지가 로컬에 저장되었습니다')
            await revealInDirSafely(_absolutePath)
            await fileDownloadStore.refreshFileDownloadStatus({
              fileUrl,
              roomId: currentChatRoomId,
              userId: currentUserUid,
              fileName,
              exists: true
            })
            return
          } else {
            absolutePath = ''
            window.$message.error('이미지 다운로드 실패, 다시 시도해주세요~')
            return
          }
        }

        await revealInDirSafely(absolutePath)
      }
    }
  ])
  /** 우클릭 사용자 정보 메뉴 (그룹 채팅 시 표시) */
  const optionsList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.send_message'),
      icon: 'message-action',
      click: (item: any) => {
        openMsgSession(item.uid || item.fromUser.uid)
      },
      visible: (item: any) => checkFriendRelation(item.uid || item.fromUser.uid, 'friend')
    },
    {
      label: 'TA',
      icon: 'aite',
      click: (item: any) => {
        useMitt.emit(MittEnum.AT, item.uid || item.fromUser.uid)
      },
      visible: (item: any) => (item.uid ? item.uid !== userUid.value : item.fromUser.uid !== userUid.value)
    },
    {
      label: () => t('menu.get_user_info'),
      icon: 'notes',
      click: (item: any, type: string) => {
        // 채팅창 내부의 프로필인 경우 메시지의 key를 사용하고, 그룹 채팅 멤버의 프로필인 경우 uid를 사용
        const uid = item.uid || item.message.id
        useMitt.emit(`${MittEnum.INFO_POPOVER}-${type}`, { uid: uid, type: type })
      }
    },
    {
      label: () => t('menu.modify_group_nickname'),
      icon: 'edit',
      click: (item: any) => {
        const targetUid = item.uid || item.fromUser?.uid
        const currentUid = userUid.value
        const roomId = globalStore.currentSessionRoomId
        const isGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP

        if (!isGroup || targetUid !== currentUid) {
          return
        }

        const currentUserInfo = groupStore.getUserInfo(currentUid, roomId)
        const currentNickname = currentUserInfo?.myName || ''

        useMitt.emit(MittEnum.OPEN_GROUP_NICKNAME_MODAL, {
          roomId,
          currentUid,
          originalNickname: currentNickname
        } as GroupNicknameModalPayload)
      },
      visible: (item: any) => (item.uid ? item.uid === userUid.value : item.fromUser.uid === userUid.value)
    },
    {
      label: () => t('menu.add_friend'),
      icon: 'people-plus',
      click: async (item: any) => {
        await createWebviewWindow('친구 추가 신청', 'addFriendVerify', 380, 300, '', false, 380, 300)
        globalStore.addFriendModalInfo.show = true
        globalStore.addFriendModalInfo.uid = item.uid || item.fromUser.uid
      },
      visible: (item: any) => !checkFriendRelation(item.uid || item.fromUser.uid, 'all')
    },
    {
      label: () => t('menu.set_admin'),
      icon: 'people-safe',
      click: async (item: any) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await groupStore.addAdmin([targetUid])
          window.$message.success(t('menu.set_admin_success'))
        } catch (_error) {
          window.$message.error(t('menu.set_admin_fail'))
        }
      },
      visible: (item: any) => {
        // 1. 그룹 채팅 여부 확인
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 방 번호가 1(채널)인지 확인
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 대상 사용자 ID 가져오기
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 대상 사용자 역할 확인
        let targetRoleId = item.roleId

        // item에 roleId가 없으면 uid를 통해 그룹 멤버 목록에서 검색
        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        // 대상 사용자가 이미 관리자 또는 그룹 소유자인지 확인
        if (targetRoleId === RoleEnum.ADMIN || targetRoleId === RoleEnum.LORD) return false

        // 5. 현재 사용자가 그룹 소유자인지 확인
        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        return currentUser?.roleId === RoleEnum.LORD
      }
    },
    {
      label: () => t('menu.revoke_admin'),
      icon: 'reduce-user',
      click: async (item: any) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await groupStore.revokeAdmin([targetUid])
          window.$message.success(t('menu.revoke_admin_success'))
        } catch (_error) {
          window.$message.error(t('menu.revoke_admin_fail'))
        }
      },
      visible: (item: any) => {
        // 1. 그룹 채팅 여부 확인
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 방 번호가 1(채널)인지 확인
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 대상 사용자 ID 가져오기
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 대상 사용자 역할 확인
        let targetRoleId = item.roleId

        // item에 roleId가 없으면 uid를 통해 그룹 멤버 목록에서 검색
        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        // 대상 사용자가 관리자인지 확인 (관리자만 취소 가능, 그룹 소유자는 취소 불가)
        if (targetRoleId !== RoleEnum.ADMIN) return false

        // 5. 현재 사용자가 그룹 소유자인지 확인
        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        return currentUser?.roleId === RoleEnum.LORD
      }
    }
  ])
  /** 신고 옵션 */
  const report = ref([
    {
      label: () => t('menu.remove_from_group'),
      icon: 'people-delete-one',
      click: async (item: any) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await removeGroupMember({ roomId, uidList: [targetUid] })
          // 그룹 멤버 목록에서 해당 사용자 제거
          groupStore.removeUserItem(targetUid, roomId)
          window.$message.success(t('menu.remove_from_group_success'))
        } catch (_error) {
          window.$message.error(t('menu.remove_from_group_fail'))
        }
      },
      visible: (item: any) => {
        // 1. 그룹 채팅 여부 확인
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 방 번호가 1(채널)인지 확인
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 대상 사용자 ID 가져오기
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 대상 사용자 역할 확인
        let targetRoleId = item.roleId

        // item에 roleId가 없으면 uid를 통해 그룹 멤버 목록에서 검색
        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        // 대상 사용자가 그룹 소유자인지 확인 (그룹 소유자는 제거 불가)
        if (targetRoleId === RoleEnum.LORD) return false

        // 5. 현재 사용자에게 권한이 있는지 확인 (그룹 소유자 또는 관리자)
        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        const isLord = currentUser?.roleId === RoleEnum.LORD
        const isAdmin = currentUser?.roleId === RoleEnum.ADMIN

        // 6. 현재 사용자가 관리자인 경우 다른 관리자를 제거할 수 없음
        if (isAdmin && targetRoleId === RoleEnum.ADMIN) return false

        return isLord || isAdmin
      }
    },
    {
      label: () => t('menu.report'),
      icon: 'caution',
      click: () => { }
    }
  ])
  /** 이모지 메뉴 */
  const emojiList = computed(() => [
    {
      url: '/msgAction/like.png',
      value: 1,
      title: t('home.chat_reaction.like')
    },
    {
      url: '/msgAction/slightly-frowning-face.png',
      value: 2,
      title: t('home.chat_reaction.unsatisfied')
    },
    {
      url: '/msgAction/heart-on-fire.png',
      value: 3,
      title: t('home.chat_reaction.heart')
    },
    {
      url: '/msgAction/enraged-face.png',
      value: 4,
      title: t('home.chat_reaction.angry')
    },
    {
      url: '/emoji/party-popper.webp',
      value: 5,
      title: t('home.chat_reaction.party')
    },
    {
      url: '/emoji/rocket.webp',
      value: 6,
      title: t('home.chat_reaction.rocket')
    },
    {
      url: '/msgAction/face-with-tears-of-joy.png',
      value: 7,
      title: t('home.chat_reaction.lol')
    },
    {
      url: '/msgAction/clapping.png',
      value: 8,
      title: t('home.chat_reaction.clap')
    },
    {
      url: '/msgAction/rose.png',
      value: 9,
      title: t('home.chat_reaction.flower')
    },
    {
      url: '/msgAction/bomb.png',
      value: 10,
      title: t('home.chat_reaction.bomb')
    },
    {
      url: '/msgAction/exploding-head.png',
      value: 11,
      title: t('home.chat_reaction.question')
    },
    {
      url: '/msgAction/victory-hand.png',
      value: 12,
      title: t('home.chat_reaction.victory')
    },
    {
      url: '/msgAction/flashlight.png',
      value: 13,
      title: t('home.chat_reaction.light')
    },
    {
      url: '/msgAction/pocket-money.png',
      value: 14,
      title: t('home.chat_reaction.red_envelope')
    }
  ])

  /**
   * 사용자 관계 확인
   * @param uid 사용자 ID
   * @param type 확인 유형: 'friend' - 친구만, 'all' - 친구 또는 자신
   */
  const checkFriendRelation = (uid: string, type: 'friend' | 'all' = 'all') => {
    const contactStore = useContactStore()
    const userStore = useUserStore()
    const myUid = userStore.userInfo!.uid
    const isFriend = contactStore.contactsList.some((item) => item.uid === uid)
    return type === 'friend' ? isFriend && uid !== myUid : isFriend || uid === myUid
  }

  const extractMsgIdFromDataKey = (dataKey?: string | null) => {
    if (!dataKey) return ''
    return dataKey.replace(/^[A-Za-z]/, '')
  }

  const resolveSelectionMessageId = (selection: Selection): string => {
    const resolveElement = (node: Node | null) => {
      if (!node) return null
      return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    }

    const anchorElement = resolveElement(selection.anchorNode)
    const focusElement = resolveElement(selection.focusNode)

    if (!anchorElement || !focusElement) return ''

    const anchorKey = anchorElement.closest('[data-key]')?.getAttribute('data-key')
    const focusKey = focusElement.closest('[data-key]')?.getAttribute('data-key')

    if (!anchorKey || !focusKey || anchorKey !== focusKey) {
      return ''
    }

    const chatMainElement = document.getElementById('image-chat-main')
    if (chatMainElement && (!chatMainElement.contains(anchorElement) || !chatMainElement.contains(focusElement))) {
      return ''
    }

    return extractMsgIdFromDataKey(anchorKey)
  }

  /**
   * 사용자가 선택한 텍스트 가져오기 (채팅 말풍선 내의 선택만 반환하며, 메시지 ID 검증 가능)
   */
  const getSelectedText = (messageId?: string): string => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return ''
    }

    const text = selection.toString().trim()
    if (!text) {
      return ''
    }

    const selectedMessageId = resolveSelectionMessageId(selection)
    if (!selectedMessageId) {
      return ''
    }

    if (messageId && selectedMessageId !== messageId) {
      return ''
    }

    return text
  }

  /**
   * 텍스트가 선택되었는지 확인
   */
  const hasSelectedText = (messageId?: string): boolean => {
    return getSelectedText(messageId).length > 0
  }

  /**
   * 텍스트 선택 지우기
   */
  const clearSelection = (): void => {
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
    }
  }

  /**
   * 복사 이벤트 처리
   * @param content 복사할 내용 (대체용)
   * @param prioritizeSelection 선택된 텍스트를 우선 복사할지 여부
   */
  const handleCopy = async (content: string | undefined, prioritizeSelection: boolean = true, messageId?: string) => {
    try {
      let textToCopy = content || ''
      let isSelectedText = false

      // 우선 선택 모드가 활성화된 경우 선택된 텍스트가 있는지 확인
      if (prioritizeSelection) {
        const selectedText = getSelectedText(messageId)
        if (selectedText) {
          textToCopy = selectedText
          isSelectedText = true
        }
      }

      // 내용이 비어 있는지 확인
      if (!textToCopy) {
        window.$message?.warning('복사할 내용이 없습니다')
        return
      }

      // 이미지인 경우
      if (isImageUrl(textToCopy)) {
        try {
          const imageFormat = detectImageFormat(textToCopy)

          // 다른 형식의 이미지를 처리 중임을 사용자에게 알림
          if (imageFormat === 'GIF' || imageFormat === 'WEBP') {
            window.$message?.info(`${imageFormat} 형식의 이미지를 PNG로 변환하여 복사 중입니다...`)
          }

          // Tauri의 clipboard API를 사용하여 이미지 복사 (자동으로 PNG 형식으로 변환)
          const imageBytes = await imageUrlToUint8Array(textToCopy)
          await writeImage(imageBytes)

          const successMessage = imageFormat === 'PNG' ? '이미지가 클립보드에 복사되었습니다' : '이미지가 PNG 형식으로 변환되어 클립보드에 복사되었습니다'
          window.$message?.success(successMessage)
        } catch (imageError) {
          console.error('이미지 복사 실패:', imageError)
        }
      } else {
        // 일반 텍스트인 경우
        await writeText(removeTag(textToCopy))
        const message = isSelectedText ? '선택된 텍스트가 복사되었습니다' : '메시지 내용이 복사되었습니다'
        window.$message?.success(message)
      }
    } catch (error) {
      console.error('복사 실패:', error)
    }
  }

  /**
   * 메시지 유형에 따라 우클릭 메뉴 목록 가져오기
   * @param type 메시지 유형
   */
  const handleItemType = (type: MsgEnum) => {
    return type === MsgEnum.IMAGE || type === MsgEnum.EMOJI
      ? imageMenuList.value
      : type === MsgEnum.FILE
        ? fileMenuList.value
        : type === MsgEnum.VIDEO
          ? videoMenuList.value
          : menuList.value
  }

  /** 메시지 삭제 이벤트 */
  const handleConfirm = async () => {
    if (!delIndex.value) return
    const targetRoomId = delRoomId.value || globalStore.currentSessionRoomId
    if (!targetRoomId) {
      window.$message?.error('메시지가 속한 세션을 확인할 수 없습니다')
      return
    }
    try {
      await invokeWithErrorHandler(
        TauriCommand.DELETE_MESSAGE,
        {
          messageId: delIndex.value,
          roomId: targetRoomId
        },
        {
          customErrorMessage: '메시지 삭제 실패',
          errorType: ErrorType.Client
        }
      )
      chatStore.deleteMsg(delIndex.value)
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: targetRoomId })
      delIndex.value = ''
      delRoomId.value = ''
      modalShow.value = false
      window.$message?.success('메시지가 삭제되었습니다')
    } catch (error) {
      console.error('메시지 삭제 실패:', error)
    }
  }

  let activeKeyPressListener: ((e: KeyboardEvent) => void) | null = null

  const removeKeyPressListener = () => {
    if (activeKeyPressListener) {
      document.removeEventListener('keydown', activeKeyPressListener)
      activeKeyPressListener = null
    }
  }

  /** 말풍선 메시지 클릭 시 사용자가 ctrl+c를 눌러 내용을 복사하는지 감지 */
  const handleMsgClick = (item: MessageType) => {
    if (item.message.type === MsgEnum.VIDEO_CALL) {
      startRtcCall(CallTypeEnum.VIDEO)
      return
    } else if (item.message.type === MsgEnum.AUDIO_CALL) {
      startRtcCall(CallTypeEnum.AUDIO)
      return
    }

    // 모바일에서는 active 효과 트리거 안 함
    if (!isMobile()) {
      if (chatStore.msgMultiChooseMode === 'forward') {
        activeBubble.value = ''
      } else {
        activeBubble.value = item.message.id
      }
    }

    // 중복 바인딩을 방지하기 위해 잔여 리스너 제거
    removeKeyPressListener()

    // 키보드 리스너 활성화
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'c') || (e.metaKey && e.key === 'c')) {
        // 사용자가 선택한 텍스트를 우선 복사하고, 선택된 내용이 없으면 전체 메시지 내용 복사
        // 이미지 또는 기타 유형의 메시지의 경우 url 필드 우선 사용
        const contentToCopy = item.message.body.url || item.message.body.content
        handleCopy(contentToCopy, true, item.message.id)
        // 다중 바인딩을 방지하기 위해 키보드 이벤트 리스너 취소
        removeKeyPressListener()
      }
    }
    activeKeyPressListener = handleKeyPress
    // document에 키보드 이벤트 바인딩
    document.addEventListener('keydown', handleKeyPress)
  }

  onUnmounted(() => {
    removeKeyPressListener()
  })

  return {
    handleMsgClick,
    handleConfirm,
    handleItemType,
    handleCopy,
    videoMenuList,
    getSelectedText,
    hasSelectedText,
    clearSelection,
    historyIndex,
    tips,
    modalShow,
    specialMenuList,
    optionsList,
    report,
    selectKey,
    emojiList,
    commonMenuList,
    scrollTop,
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    handleGroupNicknameConfirm,
    activeBubble
  }
}

export type UseChatMainContext = ReturnType<typeof useChatMain>
export const chatMainInjectionKey = Symbol('chatMainInjectionKey') as InjectionKey<UseChatMainContext>
