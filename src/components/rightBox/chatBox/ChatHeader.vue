<template>
  <!-- 상단 작업 바 및 사용자 이름 표시 -->
  <main
    v-if="activeItem"
    data-tauri-drag-region
    class="z-999 flex-y-center flex-shrink-0 border-b-(1px solid [--right-chat-footer-line-color]) select-none cursor-default justify-between p-[6px_22px_10px]">
    <n-flex align="center">
      <Transition name="loading" mode="out-in">
        <n-flex align="center">
          <n-avatar
            :class="[
              'rounded-8px select-none',
              { grayscale: activeItem?.type === RoomTypeEnum.SINGLE && !isOnline && !isBotUser }
            ]"
            :size="28"
            :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
            :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
            :src="currentUserAvatar" />
          <label class="flex-y-center gap-6px">
            <p class="text-(16px [--text-color])">{{ groupStore.countInfo?.remark || activeItem?.name }}</p>
            <p
              v-if="activeItem?.type === RoomTypeEnum.GROUP && groupStore.countInfo?.memberNum"
              class="text-(11px #808080)">
              [{{ groupStore.countInfo?.memberNum }}]
            </p>
            <!-- 봇 사용자 태그 -->
            <div
              v-if="isBotUser"
              class="dark:bg-[#13987f40] bg-[#e8f4f1] dark:border-(1px solid #13987f) border-(1px solid #13987f) flex-center px-8px py-4px rounded-6px">
              <p class="text-(11px #13987f)">{{ t('home.chat_header.bot_tag') }}</p>
            </div>
          </label>
          <svg
            v-if="activeItem?.hotFlag === IsAllUserEnum.Yes"
            class="size-20px color-#13987f select-none outline-none">
            <use href="#auth"></use>
          </svg>
          <n-flex v-else-if="activeItem?.type === RoomTypeEnum.SINGLE && !isBotUser" align="center">
            <template v-if="shouldShowDeleteFriend">
              <n-flex align="center" :size="6">
                <!-- 상태 아이콘 -->
                <img v-if="hasCustomState && statusIcon" :src="statusIcon" class="size-18px rounded-50%" alt="" />
                <n-badge v-else :color="isOnline ? '#1ab292' : '#909090'" dot />

                <!-- 상태 텍스트 -->
                <p class="text-(12px [--text-color])">
                  {{ statusTitle }}
                </p>
              </n-flex>
            </template>

            <template v-else>
              <n-flex align="center" :size="4">
                <svg class="size-16px color-#d03553">
                  <use href="#close"></use>
                </svg>
                <p class="text-(12px [--text-color])">{{ t('home.chat_header.status_abnormal') }}</p>
              </n-flex>
            </template>
          </n-flex>
        </n-flex>
      </Transition>
    </n-flex>
    <!-- 상단 우측 옵션 바 -->
    <nav v-if="shouldShowDeleteFriend || chatStore.isGroup" class="options flex-y-center gap-20px color-[--icon-color]">
      <div v-if="!isChannel && !isBotUser" class="options-box">
        <n-popover trigger="hover" :show-arrow="false" placement="bottom">
          <template #trigger>
            <svg @click="startRtcCall(CallTypeEnum.AUDIO)">
              <use href="#phone-telephone"></use>
            </svg>
          </template>
          <span>{{ t('home.chat_header.toolbar.audio_call') }}</span>
        </n-popover>
      </div>

      <div v-if="!isChannel && !isBotUser" class="options-box">
        <n-popover trigger="hover" :show-arrow="false" placement="bottom">
          <template #trigger>
            <svg @click="startRtcCall(CallTypeEnum.VIDEO)">
              <use href="#video-one"></use>
            </svg>
          </template>
          <span>{{ t('home.chat_header.toolbar.video_call') }}</span>
        </n-popover>
      </div>

      <div v-if="!isChannel && !isBotUser" class="options-box">
        <n-popover trigger="hover" :show-arrow="false" placement="bottom">
          <template #trigger>
            <svg @click="handleMedia">
              <use href="#screen-sharing"></use>
            </svg>
          </template>
          <span>{{ t('home.chat_header.toolbar.screen_share') }}</span>
        </n-popover>
      </div>

      <div v-if="!isChannel && !isBotUser" class="options-box">
        <n-popover trigger="hover" :show-arrow="false" placement="bottom">
          <template #trigger>
            <svg @click="handleAssist">
              <use href="#remote-control"></use>
            </svg>
          </template>
          <span>{{ t('home.chat_header.toolbar.remote_assist') }}</span>
        </n-popover>
      </div>

      <div
        v-if="!isChannel && !isBotUser && currentSessionRoomId !== '1'"
        class="options-box"
        @click="handleCreateGroupOrInvite">
        <n-popover trigger="hover" :show-arrow="false" placement="bottom">
          <template #trigger>
            <svg>
              <use href="#launch"></use>
            </svg>
          </template>
          <span v-if="activeItem?.type === RoomTypeEnum.GROUP">
            {{ t('home.chat_header.toolbar.invite_to_group') }}
          </span>
          <span v-else>{{ t('home.chat_header.toolbar.start_group_chat') }}</span>
        </n-popover>
      </div>

      <div class="options-box" @click="sidebarShow = !sidebarShow">
        <svg>
          <use href="#more"></use>
        </svg>
      </div>
    </nav>

    <!-- 사이드바 옵션 -->
    <Transition v-if="shouldShowDeleteFriend || chatStore.isGroup" name="sidebar">
      <div v-if="sidebarShow" style="border: 1px solid rgba(90, 90, 90, 0.1)" class="sidebar">
        <n-scrollbar style="height: calc(100vh / var(--page-scale, 1) - 24px)" class="p-22px box-border">
          <!-- 단일 채팅 사이드바 옵션 -->
          <template v-if="!chatStore.isGroup">
            <div class="box-item flex-col-y-center">
              <div class="flex-between-center">
                <p>{{ t('home.chat_header.sidebar.single.pin') }}</p>
                <n-switch size="small" :value="activeItem?.top" @update:value="handleTop" />
              </div>
              <div class="h-1px bg-[--setting-item-line] m-[10px_0]"></div>
              <div class="flex-between-center">
                <p>{{ t('home.chat_header.sidebar.single.mute') }}</p>
                <n-switch
                  size="small"
                  :value="activeItem?.muteNotification === NotificationTypeEnum.NOT_DISTURB"
                  @update:value="handleNotification" />
              </div>
            </div>

            <div class="box-item">
              <div class="flex-between-center">
                <p>{{ t('home.chat_header.sidebar.single.shield') }}</p>
                <n-switch size="small" :value="activeItem?.shield" @update:value="handleShield" />
              </div>
            </div>

            <div class="box-item cursor-pointer" @click="handleDelete(RoomActEnum.DELETE_RECORD)">
              <p>{{ t('home.chat_header.sidebar.single.delete_history') }}</p>
            </div>

            <div
              v-if="!isBotUser"
              class="box-item flex-x-center cursor-pointer"
              @click="handleDelete(RoomActEnum.DELETE_FRIEND)">
              <p class="color-#d03553">{{ t('home.chat_header.sidebar.single.delete_friend') }}</p>
            </div>

            <p v-if="!isBotUser" class="m-[0_auto] text-(12px #13987f center) mt-20px cursor-pointer">
              {{ t('home.chat_header.sidebar.single.report') }}
            </p>
          </template>

          <!-- 그룹 채팅 사이드바 옵션 -->
          <template v-else>
            <div class="box-item cursor-default">
              <n-flex
                align="center"
                :justify="groupStore.countInfo!.allowScanEnter ? 'space-between' : ''"
                :size="groupStore.countInfo!.allowScanEnter ? 0 : 12">
                <!-- 그룹 아바타 -->
                <div class="relative group">
                  <!-- 그룹장은 프로필 이미지를 편집할 수 있습니다 -->
                  <div v-if="isGroupOwner" class="avatar-wrapper relative" @click="handleUploadAvatar">
                    <n-avatar round :size="40" :src="AvatarUtils.getAvatarUrl(activeItem?.avatar || '')" />
                    <div class="avatar-hover absolute size-full rounded-50% flex-center">
                      <svg class="size-14px color-#fefefe">
                        <use href="#Export"></use>
                      </svg>
                    </div>
                  </div>

                  <n-avatar v-else round :size="40" :src="AvatarUtils.getAvatarUrl(activeItem?.avatar || '')" />
                </div>

                <n-flex vertical :size="6">
                  <!-- 그룹 이름 -->
                  <n-flex :size="10" align="center">
                    <div v-if="isGroupOwner && isEditingGroupName">
                      <n-input
                        ref="groupNameInputRef"
                        v-model:value="editingGroupName"
                        @blur.stop="handleGroupNameChange"
                        @keydown.enter.stop="handleGroupNameChange"
                        size="tiny"
                        style="width: 100px; height: 22px"
                        maxlength="12"
                        spellCheck="false"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        class="border-(solid 1px [--line-color])"
                        :placeholder="t('home.chat_header.sidebar.group.name_placeholder')" />
                    </div>
                    <div
                      v-else
                      class="text-(14px --text-color) leading-loose cursor-default h-22px flex-center"
                      :class="{ 'cursor-pointer': isGroupOwner }"
                      @click="isGroupOwner && startEditGroupName()">
                      <p :title="activeItem?.name" class="max-w-100px truncate">{{ activeItem?.name }}</p>
                      <!-- 편집 아이콘 표시 -->
                      <svg v-if="isGroupOwner" class="size-14px ml-1 inline-block color-[--icon-color]">
                        <use href="#edit"></use>
                      </svg>
                    </div>

                    <n-popover trigger="hover" v-if="activeItem?.hotFlag === IsAllUserEnum.Yes && !isEditingGroupName">
                      <template #trigger>
                        <svg class="size-20px select-none outline-none cursor-pointer color-#13987f">
                          <use href="#auth"></use>
                        </svg>
                      </template>
                      <span>{{ t('home.chat_header.sidebar.group.official_badge') }}</span>
                    </n-popover>
                  </n-flex>

                  <n-flex align="center" :size="8">
                    <!-- 훌라 번호 -->
                    <p
                      class="text-(12px center [--chat-text-color]) rounded-4px w-100px py-2px bg-[#e3e3e3] dark:bg-[#505050]">
                      {{ activeItem?.account }}
                    </p>

                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <svg
                          class="size-12px cursor-pointer hover:color-#909090 hover:transition-colors"
                          @click="handleCopy">
                          <use href="#copy"></use>
                        </svg>
                      </template>
                      <span>{{ t('home.chat_header.sidebar.group.copy') }}</span>
                    </n-tooltip>
                  </n-flex>
                </n-flex>

                <div
                  v-if="groupStore.countInfo!.allowScanEnter"
                  class="flex-center cursor-pointer bg-#e3e3e380 dark:bg-#303030 border-(1px solid #90909080) gap-6px px-4px py-6px rounded-6px"
                  @click="showQRCodeModal = true">
                  <svg class="size-16px"><use href="#pay-code-one"></use></svg>
                  <p class="text-(12px [--chat-text-color])">{{ t('home.chat_header.sidebar.group.qr') }}</p>
                </div>
              </n-flex>
            </div>

            <!-- 그룹 채팅 멤버 목록 -->
            <div class="box-item cursor-default">
              <n-flex vertical justify="center" :size="16">
                <p class="text-(14px --text-color)">
                  {{
                    activeItem?.hotFlag !== IsAllUserEnum.Yes
                      ? t('home.chat_header.sidebar.group.members')
                      : t('home.chat_header.sidebar.group.channel_members')
                  }}
                </p>

                <n-flex align="center" justify="start" :size="[24, 20]">
                  <template v-for="(item, _index) in userList" :key="_index">
                    <n-flex vertical justify="center" align="center" :size="10">
                      <n-avatar round :size="30" :src="AvatarUtils.getAvatarUrl(item.avatar)" />

                      <p class="text-(10px --text-color center) w-30px truncate">{{ item.name }}</p>
                    </n-flex>
                  </template>
                </n-flex>
              </n-flex>
            </div>

            <!-- 이 그룹에서의 내 닉네임 -->
            <p class="text-(12px [--chat-text-color]) mt-20px mb-10px">
              {{ t('home.chat_header.sidebar.group.my_name') }}
            </p>
            <n-input
              class="border-(solid 1px [--line-color]) custom-shadow"
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              :maxlength="12"
              clearable
              v-model:value="localMyName"
              @blur.stop="handleGroupInfoChange" />
            <!-- 그룹 비고 -->
            <p class="flex-start-center gap-10px text-(12px [--chat-text-color]) mt-20px mb-10px">
              {{ t('home.chat_header.sidebar.group.remark') }}
              <span class="text-(10px #909090)">{{ t('home.chat_header.sidebar.group.remark_desc') }}</span>
            </p>
            <n-input
              class="border-(solid 1px [--line-color]) custom-shadow"
              v-model:value="localRemark"
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              clearable
              @blur.stop="handleGroupInfoChange" />

            <!-- 그룹 설정 옵션 -->
            <div class="box-item cursor-default">
              <n-flex vertical justify="center" :size="4">
                <p class="text-(12px #909090) pb-14px">{{ t('home.chat_header.sidebar.group.settings.title') }}</p>

                <div class="flex-between-center">
                  <p>{{ t('home.chat_header.sidebar.group.settings.pin') }}</p>
                  <n-switch size="small" :value="activeItem?.top" @update:value="handleTop" />
                </div>

                <div class="h-1px bg-[--setting-item-line] m-[10px_0]"></div>

                <div class="flex-between-center">
                  <p>{{ t('home.chat_header.sidebar.group.settings.mute') }}</p>
                  <n-switch
                    size="small"
                    :value="activeItem?.muteNotification === NotificationTypeEnum.NOT_DISTURB"
                    @update:value="handleNotification" />
                </div>
                <template v-if="groupStore.isAdminOrLord()">
                  <div class="h-1px bg-[--setting-item-line] m-[10px_0]"></div>

                  <div class="flex-between-center">
                    <p>{{ t('home.chat_header.sidebar.group.settings.scan') }}</p>
                    <n-switch
                      size="small"
                      :value="groupStore.countInfo!.allowScanEnter"
                      @update:value="
                        (val: any) => {
                          updateRoomInfo({
                            id: groupStore.countInfo!.roomId,
                            allowScanEnter: val
                          })
                        }
                      " />
                  </div>
                </template>
              </n-flex>
            </div>

            <!-- 그룹 메시지 설정 (방해 금지 모드에서만 표시) -->
            <div
              v-if="activeItem?.muteNotification === NotificationTypeEnum.NOT_DISTURB"
              class="box-item cursor-default">
              <n-flex vertical justify="center" :size="4">
                <p class="text-(12px #909090) pb-14px">
                  {{ t('home.chat_header.sidebar.group.message_settings.title') }}
                </p>

                <div class="flex-between-center">
                  <n-select
                    v-model:value="messageSettingType"
                    :options="messageSettingOptions"
                    @update:value="handleMessageSetting" />
                </div>
              </n-flex>
            </div>

            <!-- 그룹 멤버 관리 (관리자 및 그룹장만 볼 수 있음) -->
            <div
              v-if="
                groupStore.isAdminOrLord() && activeItem?.hotFlag !== IsAllUserEnum.Yes && currentSessionRoomId !== '1'
              "
              class="box-item cursor-pointer mb-20px"
              @click="handleManageGroupMember">
              <p>{{ t('home.chat_header.sidebar.group.manage_members') }}</p>
            </div>

            <div class="box-item cursor-pointer mb-20px" @click="handleDelete(RoomActEnum.DELETE_RECORD)">
              <p>{{ t('home.chat_header.sidebar.group.delete_history') }}</p>
            </div>

            <div
              v-if="activeItem?.hotFlag !== IsAllUserEnum.Yes"
              class="box-item flex-x-center cursor-pointer mb-20px"
              @click="
                handleDelete(
                  activeItem?.operate === SessionOperateEnum.DISSOLUTION_GROUP
                    ? RoomActEnum.DISSOLUTION_GROUP
                    : RoomActEnum.EXIT_GROUP
                )
              ">
              <p class="color-#d03553">
                {{
                  activeItem?.operate === SessionOperateEnum.DISSOLUTION_GROUP
                    ? t('home.chat_header.sidebar.group.dissolve')
                    : t('home.chat_header.sidebar.group.exit')
                }}
              </p>
            </div>

            <p
              v-if="activeItem?.hotFlag !== IsAllUserEnum.Yes"
              class="text-(12px #13987f center) my-20px cursor-pointer">
              {{ t('home.chat_header.sidebar.group.report') }}
            </p>
          </template>
        </n-scrollbar>
      </div>
    </Transition>
  </main>

  <!-- 팝업 -->
  <n-modal v-model:show="modalShow" class="w-350px rounded-8px">
    <div class="bg-[--bg-popover] w-360px h-full p-6px box-border flex flex-col">
      <div
        v-if="isMac()"
        @click="modalShow = false"
        class="mac-close z-999 size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none absolute left-6px">
        <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
          <use href="#close"></use>
        </svg>
      </div>

      <svg v-if="isWindows()" @click="modalShow = false" class="size-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <div class="flex flex-col gap-30px p-[22px_10px_10px_22px] select-none">
        <span class="text-14px">{{ tips }}</span>

        <n-flex justify="end">
          <n-button @click="handleConfirm" class="w-78px" color="#13987f">
            {{ t('home.chat_header.modal.confirm') }}
          </n-button>
          <n-button @click="handleCancel" class="w-78px" secondary>{{ t('home.chat_header.modal.cancel') }}</n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>

  <!-- 그룹 QR 코드 공유 팝업 -->
  <n-modal v-model:show="showQRCodeModal" class="w-400px rounded-8px">
    <div class="bg-[--bg-popover] w-400px p-6px box-border flex flex-col">
      <div
        v-if="isMac()"
        @click="showQRCodeModal = false"
        class="mac-close z-999 size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none absolute left-6px">
        <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
          <use href="#close"></use>
        </svg>
      </div>

      <svg v-if="isWindows()" @click="showQRCodeModal = false" class="size-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>

      <div class="flex flex-col gap-20px p-[22px_20px_20px_22px] select-none">
        <div class="flex flex-col items-center gap-16px">
          <n-qr-code
            style="border-radius: 16px"
            :value="JSON.stringify({ type: 'scanEnterGroup', roomId: currentSessionRoomId })"
            :size="200"
            :color="themes.content === ThemeEnum.DARK ? '#202020' : '#000000'"
            :background-color="themes.content === ThemeEnum.DARK ? '#e3e3e3' : '#e3e3e382'"
            :icon-src="AvatarUtils.getAvatarUrl(activeItem?.avatar || '')" />

          <div class="text-center">
            <p class="text-(16px [--text-color]) font-bold pb-24px">{{ activeItem?.name }}</p>
            <p class="text-(12px [--chat-text-color])">{{ t('home.chat_header.qr.tip') }}</p>
          </div>
        </div>
      </div>
    </div>
  </n-modal>

  <!-- 그룹 멤버 관리 팝업 -->
  <n-modal v-model:show="showManageGroupMemberModal" class="w-600px rounded-8px" :mask-closable="false">
    <div class="bg-[--bg-popover] w-600px p-6px box-border flex flex-col">
      <div
        v-if="isMac()"
        @click="showManageGroupMemberModal = false"
        class="mac-close z-999 size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none absolute left-6px">
        <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
          <use href="#close"></use>
        </svg>
      </div>

      <svg
        v-if="isWindows()"
        @click="showManageGroupMemberModal = false"
        class="size-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>

      <div class="flex flex-col h-600px">
        <ManageGroupMember @close="showManageGroupMemberModal = false" />
      </div>
    </div>
  </n-modal>

  <!-- 자르기 구성 요소 및 파일 입력 상자 추가 -->
  <input
    ref="fileInput"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    class="hidden"
    @change="handleFileChange" />
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ErrorType } from '@/common/exception'
import { useDisplayMedia } from '@vueuse/core'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import ManageGroupMember from '@/views/ManageGroupMember.vue'
import {
  CallTypeEnum,
  MittEnum,
  NotificationTypeEnum,
  RoleEnum,
  RoomActEnum,
  RoomTypeEnum,
  SessionOperateEnum,
  ThemeEnum,
  TauriCommand,
  UserType
} from '@/enums'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useMyRoomInfoUpdater } from '@/hooks/useMyRoomInfoUpdater'
import { useMitt } from '@/hooks/useMitt'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useWindow } from '@/hooks/useWindow'
import { IsAllUserEnum, type UserItem, type FriendItem } from '@/services/types'
import { WsResponseMessageType } from '@/services/wsType'
import { useChatStore } from '@/stores/chat'
import { useContactStore } from '@/stores/contacts'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { notification, setSessionTop, shield, updateRoomInfo } from '@/utils/ImRequestUtils'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { isMac, isWindows, isMobile } from '@/utils/PlatformConstants'

const { t } = useI18n()
const { createModalWindow, startRtcCall } = useWindow()
// 화면 공유 미디어 스트림을 얻기 위해 useDisplayMedia 사용
const { stream, stop } = useDisplayMedia()
const chatStore = useChatStore()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const contactStore = useContactStore() as any
const userStore = useUserStore()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
/** 알림 상자 제목 */
const tips = ref()
const optionsType = ref<RoomActEnum>()
const modalShow = ref(false)
const sidebarShow = ref(false)
const showQRCodeModal = ref(false)
const showManageGroupMemberModal = ref(false)
const { currentSession: activeItem, currentSessionRoomId } = storeToRefs(globalStore)
const { persistMyRoomInfo, resolveMyRoomNickname } = useMyRoomInfoUpdater()

// 채널 여부 (더보기 버튼만 표시)
const isChannel = computed(() => activeItem.value?.hotFlag === IsAllUserEnum.Yes || currentSessionRoomId.value === '1')
// 봇 사용자 여부
const isBotUser = computed(() => activeItem.value?.account === UserType.BOT)
// 그룹장 여부
const isGroupOwner = computed(() => {
  const session = activeItem.value
  if (!session || currentSessionRoomId.value === '1' || session.hotFlag === IsAllUserEnum.Yes) {
    return false
  }

  // groupStore.userList에서 현재 사용자의 역할 확인
  const currentUser = groupStore.userList.find((user) => user.uid === userStore.userInfo!.uid)
  return currentUser?.roleId === RoleEnum.LORD
})

// 그룹 이름 편집 중 여부
const isEditingGroupName = ref(false)
// 편집 중인 그룹 이름
const editingGroupName = ref('')
// 그룹 이름 입력 필드 참조
const groupNameInputRef = useTemplateRef<HTMLInputElement | null>('groupNameInputRef')
// 저장할 그룹 정보
const pendingGroupInfo = ref<{
  groupName?: string
  myName?: string
  remark?: string
} | null>(null)
// 로컬에 임시 저장된 그룹 닉네임 및 그룹 비고 (실시간 store 수정 방지)
const localMyName = ref('')
const localRemark = ref('')

// 로컬 변수 초기화
const initLocalValues = () => {
  localMyName.value = resolveMyRoomNickname({
    roomId: currentSessionRoomId.value,
    myName: groupStore.myNameInCurrentGroup || ''
  })
  localRemark.value = groupStore.countInfo?.remark || ''
}

watch(
  () => groupStore.myNameInCurrentGroup,
  (newName) => {
    const normalized = resolveMyRoomNickname({
      roomId: currentSessionRoomId.value,
      myName: newName || ''
    })
    if (localMyName.value !== normalized) {
      localMyName.value = normalized
    }
  }
)
// 현재 세션 변경 감지, 로컬 변수 재초기화
watch(
  () => currentSessionRoomId.value,
  () => {
    if (currentSessionRoomId.value) {
      nextTick(() => {
        initLocalValues()
      })
    }
  }
)

const messageSettingType = computed(() => {
  // 그룹 메시지 설정은 방해 금지 모드에서만 의미가 있음
  if (activeItem.value?.muteNotification === NotificationTypeEnum.NOT_DISTURB) {
    return activeItem.value?.shield ? 'shield' : 'notification'
  }
  // 방해 금지 모드가 아니면 기본적으로 notification 반환
  return 'notification'
})
const messageSettingOptions = computed(() => [
  { label: t('home.chat_header.message_setting.receive_no_alert'), value: 'notification' },
  { label: t('home.chat_header.message_setting.shield'), value: 'shield' }
])

const chatTargetUid = computed(() => {
  const session = activeItem.value
  if (!session || session.type === RoomTypeEnum.GROUP) return undefined
  return session.detailId
})
const { isOnline, statusIcon, statusTitle, hasCustomState } = useOnlineStatus(chatTargetUid)

/** 아직 친구인지 여부 */
const shouldShowDeleteFriend = computed(() => {
  const session = activeItem.value
  if (!session || session.type === RoomTypeEnum.GROUP) return false
  return contactStore.contactsList.some((item: FriendItem) => item.uid === session.detailId)
})
const groupUserList = computed(() => groupStore.userList)
const userList = computed(() => {
  return groupUserList.value
    .map((item: UserItem) => {
      const { uid, ...userInfo } = item // uid 제외, 나머지 내용 가져오기
      return {
        ...userInfo,
        ...groupStore.getUserInfo(item.uid)!,
        uid
      }
    })
    .sort((a, b) => {
      // uid를 숫자로 변환하여 비교
      return Number(a.uid) - Number(b.uid)
    })
    .slice(0, 10)
})

// 사용자의 최신 아바타 가져오기
const currentUserAvatar = computed(() => {
  const session = activeItem.value
  if (!session) return ''
  if (session.type === RoomTypeEnum.GROUP) {
    return AvatarUtils.getAvatarUrl(session.avatar)
  }
  if (session.detailId) {
    const detailUser = groupStore.getUserInfo(session.detailId)
    return AvatarUtils.getAvatarUrl(detailUser?.avatar || session.avatar)
  }
  return AvatarUtils.getAvatarUrl(session.avatar)
})
// 아바타 업로드 처리를 위한 사용자 정의 훅 사용
const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openFileSelector,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (downloadUrl) => {
    const session = activeItem.value
    if (!session) return
    await updateRoomInfo({
      id: currentSessionRoomId.value,
      avatar: downloadUrl
    })
  }
})

watchEffect(() => {
  stream.value?.getVideoTracks()[0]?.addEventListener('ended', () => {
    stop()
  })
})

// 계정 복사 처리
const handleCopy = () => {
  const session = activeItem.value
  if (!session?.account) return
  navigator.clipboard.writeText(session.account)
  window.$message.success(t('home.chat_header.toast.copy_success', { account: session.account }))
}

/** 그룹 채팅 생성 또는 그룹 초대 처리 */
const handleCreateGroupOrInvite = () => {
  const session = activeItem.value
  if (!session) return
  if (session.type === RoomTypeEnum.GROUP) {
    handleInvite()
  } else {
    handleCreateGroup()
  }
}

/** 그룹 채팅 생성 처리 */
const handleCreateGroup = () => {
  const session = activeItem.value
  if (!session) return
  useMitt.emit(MittEnum.CREATE_GROUP, { id: session.detailId })
}

/** 그룹 초대 처리 */
const handleInvite = async () => {
  const session = activeItem.value
  if (!session) return
  // 캡슐화된 createModalWindow 메서드를 사용하여 모달 창 생성 및 현재 세션의 roomId 전달
  await createModalWindow(t('home.chat_header.modal.invite_friends'), 'modal-invite', 600, 500, 'home', {
    roomId: currentSessionRoomId.value,
    type: session.type
  })
}

/** 그룹 멤버 관리 처리 */
const handleManageGroupMember = () => {
  // 그룹 멤버 관리 팝업 열기
  showManageGroupMemberModal.value = true
}

// 그룹 정보 저장
const saveGroupInfo = async () => {
  const session = activeItem.value
  if (!currentSessionRoomId.value || session?.type !== RoomTypeEnum.GROUP) return

  const pendingInfo = pendingGroupInfo.value
  if (!pendingInfo) return

  const myName = pendingInfo.myName ?? ''
  const remark = pendingInfo.remark ?? ''

  try {
    await persistMyRoomInfo({
      roomId: currentSessionRoomId.value,
      myName,
      remark
    })

    localMyName.value = resolveMyRoomNickname({
      roomId: currentSessionRoomId.value,
      myName
    })
    localRemark.value = remark

    window.$message.success(t('home.chat_header.toast.group_info_updated'))
    pendingGroupInfo.value = null
  } catch (error) {
    console.error('그룹 정보 업데이트 실패:', error)
    window.$message.error(t('home.chat_header.toast.group_info_update_failed'))
  }
}

const handleAssist = () => {
  window.$message.warning(t('home.chat_header.toast.todo'))
}

const handleMedia = () => {
  window.$message.warning(t('home.chat_header.toast.todo'))
}

// 상단 고정 처리
const handleTop = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  setSessionTop({ roomId: currentSessionRoomId.value, top: value })
    .then(() => {
      // 업데이트 로컬 채팅방 상태
      chatStore.updateSession(currentSessionRoomId.value, { top: value })
      window.$message.success(value ? t('home.chat_header.toast.pin_on') : t('home.chat_header.toast.pin_off'))
    })
    .catch(() => {
      window.$message.error(t('home.chat_header.toast.pin_failed'))
    })
}

// 방해 금지 모드 처리
const handleNotification = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  const newType = value ? NotificationTypeEnum.NOT_DISTURB : NotificationTypeEnum.RECEPTION
  // 만약 현재 차단 상태라면 먼저 차단 해제 필요
  if (session.shield) {
    handleShield(false)
  }
  notification({
    roomId: currentSessionRoomId.value,
    type: newType
  })
    .then(() => {
      // 로컬 세션 상태 업데이트
      chatStore.updateSession(currentSessionRoomId.value, {
        muteNotification: newType
      })

      // 방해 금지 모드에서 알림 허용으로 변경 시 전체 읽지 않은 메시지 수 다시 계산
      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
        chatStore.updateTotalUnreadCount()
      }

      // 방해 금지 모드로 설정 시에도 전체 읽지 않은 메시지 수 업데이트 (해당 세션 제외)
      if (newType === NotificationTypeEnum.NOT_DISTURB) {
        chatStore.updateTotalUnreadCount()
      }

      window.$message.success(value ? t('home.chat_header.toast.mute_on') : t('home.chat_header.toast.mute_off'))
    })
    .catch(() => {
      window.$message.error(t('home.chat_header.toast.action_failed'))
    })
}

// 차단 처리
const handleShield = (value: boolean) => {
  const session = activeItem.value
  if (!session) return
  shield({
    roomId: currentSessionRoomId.value,
    state: value
  })
    .then(() => {
      // 로컬 세션 상태 업데이트
      chatStore.updateSession(currentSessionRoomId.value, {
        shield: value
      })

      // 1. 먼저 현재 채팅방 ID 저장
      const tempRoomId = globalStore.currentSessionRoomId

      // 3. 다음 틱에서 원래 채팅방 ID 복원하여 메시지 다시 로드 트리거
      nextTick(() => {
        globalStore.updateCurrentSessionRoomId(tempRoomId)
      })

      window.$message.success(value ? t('home.chat_header.toast.shield_on') : t('home.chat_header.toast.shield_off'))
    })
    .catch(() => {
      window.$message.error(t('home.chat_header.toast.action_failed'))
    })
}

// 메시지 설정 처리 (방해 금지/차단)
const handleMessageSetting = (value: string) => {
  const session = activeItem.value
  if (!session) return
  if (value === 'shield') {
    // 메시지 차단으로 설정
    if (!session.shield) {
      handleShield(true)
    }
  } else if (value === 'notification') {
    // 메시지 수신하지만 알림은 끄기
    if (session.shield) {
      handleShield(false)
    }
  }
}

/** 그룹 이름 수정 시 포커스 해제 처리 */
const handleGroupNameChange = () => {
  const session = activeItem.value
  if (!session) return
  const trimmedName = editingGroupName.value.trim()

  // 이름 변경 여부 확인
  if (trimmedName !== session.name) {
    // 이름이 비어있거나 12자 초과인지 확인
    if (trimmedName === '') {
      window.$message.warning(t('home.chat_header.toast.group_name_empty'))
      return
    }
    if (trimmedName.length > 12) {
      window.$message.warning(t('home.chat_header.toast.group_name_too_long'))
      return
    }

    // 수정 대기 그룹 이름 저장 및 확인 팝업 표시
    pendingGroupInfo.value = { groupName: trimmedName }
    handleDelete(RoomActEnum.UPDATE_GROUP_NAME)
  } else {
    // 이름 변경 없으면 편집 모드 종료
    isEditingGroupName.value = false
  }
}

// 그룹 정보 수정 처리
const handleGroupInfoChange = () => {
  // 수정 여부 확인
  const originalMyName = groupStore.myNameInCurrentGroup || ''
  const originalRemark = groupStore.countInfo?.remark || ''

  if (localMyName.value !== originalMyName || localRemark.value !== originalRemark) {
    // 수정 대기 그룹 정보 저장 및 확인 팝업 표시
    pendingGroupInfo.value = {
      myName: localMyName.value,
      remark: localRemark.value
    }
    handleDelete(RoomActEnum.UPDATE_GROUP_INFO)
  }
}

const deleteRoomMessages = async (roomId: string) => {
  if (!roomId) return
  try {
    await invokeWithErrorHandler(
      TauriCommand.DELETE_ROOM_MESSAGES,
      { roomId },
      {
        customErrorMessage: t('home.chat_header.toast.delete_history_failed'),
        errorType: ErrorType.Client
      }
    )
    chatStore.clearRoomMessages(roomId)
    useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId })
    window.$message?.success(t('home.chat_header.toast.delete_history_success'))
    modalShow.value = false
    sidebarShow.value = false
  } catch (error) {
    console.error('채팅 기록 삭제 실패:', error)
  }
}

/** 삭제 작업 2차 확인 */
const handleDelete = (label: RoomActEnum) => {
  modalShow.value = true
  optionsType.value = label
  if (label === RoomActEnum.DELETE_FRIEND) {
    tips.value = t('home.chat_header.modal.tips.delete_friend')
  } else if (label === RoomActEnum.DISSOLUTION_GROUP) {
    tips.value = t('home.chat_header.modal.tips.dissolve_group')
  } else if (label === RoomActEnum.EXIT_GROUP) {
    tips.value = t('home.chat_header.modal.tips.exit_group')
  } else if (label === RoomActEnum.UPDATE_GROUP_NAME) {
    tips.value = t('home.chat_header.modal.tips.rename_group', {
      name: pendingGroupInfo.value?.groupName ?? ''
    })
  } else if (label === RoomActEnum.UPDATE_GROUP_INFO) {
    tips.value = t('home.chat_header.modal.tips.update_info')
  } else {
    tips.value = t('home.chat_header.modal.tips.delete_history')
    optionsType.value = RoomActEnum.DELETE_RECORD
  }
}

const handleConfirm = async () => {
  const currentOption = optionsType.value
  const targetRoomId = currentSessionRoomId.value
  const targetDetailId = activeItem.value?.detailId

  if (currentOption === undefined || currentOption === null || !targetRoomId) return

  if (currentOption === RoomActEnum.DELETE_FRIEND && targetDetailId) {
    try {
      await contactStore.onDeleteFriend(targetDetailId)
      useMitt.emit(MittEnum.DELETE_SESSION, targetRoomId)
      window.$message.success(t('home.chat_header.toast.delete_friend_success'))
      modalShow.value = false
      sidebarShow.value = false
    } catch (error) {
      console.error('친구 삭제 실패:', error)
    }
  } else if (currentOption === RoomActEnum.DISSOLUTION_GROUP) {
    if (targetRoomId === '1') {
      window.$message.warning(t('home.chat_header.toast.dissolve_not_allowed'))
      modalShow.value = false
      return
    }

    try {
      await groupStore.exitGroup(targetRoomId)
      window.$message.success(t('home.chat_header.toast.dissolve_success'))
      // 현재 세션 삭제
      useMitt.emit(MittEnum.DELETE_SESSION, targetRoomId)
      modalShow.value = false
      sidebarShow.value = false
    } catch (error) {
      console.error('그룹 해체 실패:', error)
    }
  } else if (currentOption === RoomActEnum.EXIT_GROUP) {
    if (targetRoomId === '1') {
      window.$message.warning(t('home.chat_header.toast.exit_not_allowed'))
      modalShow.value = false
      return
    }

    try {
      await groupStore.exitGroup(targetRoomId)
      window.$message.success(t('home.chat_header.toast.exit_success'))
      // 현재 세션 삭제
      useMitt.emit(MittEnum.DELETE_SESSION, targetRoomId)
      modalShow.value = false
      sidebarShow.value = false
    } catch (error) {
      console.error('그룹 나가기 실패:', error)
    }
  } else if (currentOption === RoomActEnum.DELETE_RECORD) {
    await deleteRoomMessages(targetRoomId)
  } else if (currentOption === RoomActEnum.UPDATE_GROUP_NAME) {
    // 그룹 이름 수정 확인
    await saveGroupName()
    modalShow.value = false
  } else if (currentOption === RoomActEnum.UPDATE_GROUP_INFO) {
    // 그룹 정보 수정 확인
    await saveGroupInfo()
    modalShow.value = false
  }
}

const handleCancel = () => {
  const session = activeItem.value
  // 그룹 정보 수정 취소 시 원래 값 복구
  if (optionsType.value === RoomActEnum.UPDATE_GROUP_NAME) {
    // 그룹 이름 수정 취소, 편집 모드 종료
    isEditingGroupName.value = false
    editingGroupName.value = session?.name || ''
  } else if (optionsType.value === RoomActEnum.UPDATE_GROUP_INFO) {
    // 그룹 정보 수정 취소, 로컬 변수를 원래 값으로 복구
    localMyName.value = groupStore.myNameInCurrentGroup || ''
    localRemark.value = groupStore.countInfo?.remark || ''
  }

  // 저장 대기 그룹 정보 초기화
  pendingGroupInfo.value = null
  modalShow.value = false
}

// 그룹 이름 편집 시작
const startEditGroupName = () => {
  if (!isGroupOwner.value) return

  editingGroupName.value = activeItem.value?.name || ''
  isEditingGroupName.value = true

  // 다음 이벤트 루프에서 입력 필드 포커스
  nextTick(() => {
    groupNameInputRef.value?.focus()
  })
}

// 그룹 이름 저장
const saveGroupName = async () => {
  if (!isGroupOwner.value || !currentSessionRoomId.value) return

  isEditingGroupName.value = false

  // pendingGroupInfo의 그룹 이름 사용
  const trimmedName = pendingGroupInfo.value?.groupName
  if (!trimmedName) return

  try {
    // 그룹 정보 업데이트 API 호출
    await updateRoomInfo({
      id: currentSessionRoomId.value,
      name: trimmedName
    })
    // 저장 대기 그룹 정보 초기화
    pendingGroupInfo.value = null
  } catch (error) {
    window.$message.error(t('home.chat_header.toast.group_name_update_failed'))
    console.error('그룹 이름 업데이트 실패:', error)
  }
}

// 아바타 업로드 처리
const handleUploadAvatar = () => {
  if (!isGroupOwner.value || !currentSessionRoomId.value) return

  openFileSelector()
}

// 크롭 처리, 훅 메서드 호출
const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

const closeMenu = (event: any) => {
  /** 사이드바 외 요소 클릭 시 사이드바 닫기 (팝업, 사이드바 아이콘, 사이드바 내부 요소 클릭 시 제외) */
  if (!event.target.matches('.sidebar, .sidebar *, .n-modal-mask, .options-box *, .n-modal *') && !modalShow.value) {
    sidebarShow.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', closeMenu, true)
  // 로컬 변수 초기화
  initLocalValues()
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  useMitt.off(WsResponseMessageType.VideoCallRequest, () => {})
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/chat-header';

.loading-enter-active,
.loading-leave-active {
  transition: opacity 0.3s ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}

.avatar-wrapper {
  cursor: pointer;

  .avatar-hover {
    opacity: 0;
    transition: opacity 0.4s ease-in-out;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    top: 0;
    left: 0;
  }

  &:hover .avatar-hover {
    opacity: 1;
  }
}

:deep(.n-scrollbar > .n-scrollbar-container > .n-scrollbar-content) {
  padding-left: 2px;
}
</style>
