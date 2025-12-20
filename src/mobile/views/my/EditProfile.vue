<template>
  <div class="flex flex-1 flex-col">
    <img src="@/assets/mobile/chat-home/background.webp" class="w-100% fixed z-0 top-0" alt="hula" />
    <AutoFixHeightPage :show-footer="false" class="z-1">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          :hidden-right="true"
          :enable-default-background="false"
          :enable-shadow="false"
          room-name="프로필 편집" />
      </template>

      <template #container>
        <div class="flex flex-col gap-1 overflow-auto h-full">
          <div class="flex flex-col p-[0px_20px_20px_20px] gap-15px">
            <!-- 프로필 사진 -->
            <div class="flex justify-center">
              <div class="rounded-full relative bg-white w-86px h-86px overflow-hidden" @click="openAvatarCropper">
                <n-avatar
                  class="absolute"
                  :size="86"
                  :src="AvatarUtils.getAvatarUrl(localUserInfo.avatar!)"
                  fallback-src="/logo.png"
                  round />
                <div
                  class="absolute h-50% w-full bottom-0 bg-[rgb(50,50,50)] bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-15 backdrop-saturate-100 backdrop-contrast-100"></div>
                <div class="absolute bottom-25% text-center w-full text-12px text-white">프로필 사진 변경</div>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="handleFileChange" />
              <AvatarCropper
                ref="cropperRef"
                v-model:show="showCropper"
                :image-url="localImageUrl"
                @crop="handleCrop" />
            </div>
            <!-- 개인 정보 -->
            <van-form @submit="saveEditInfo">
              <van-cell-group class="shadow" inset>
                <!-- 닉네임 -->
                <van-field
                  :disabled="true"
                  v-model="localUserInfo.name"
                  name="닉네임"
                  label="닉네임"
                  placeholder="닉네임 입력"
                  :rules="[{ required: true, message: '닉네임을 입력해주세요' }]" />

                <!-- 성별 -->
                <van-field
                  v-model="genderText"
                  is-link
                  readonly
                  name="picker"
                  label="성별"
                  placeholder="성별 선택"
                  @click="pickerState.gender = true" />

                <van-popup v-model:show="pickerState.gender" position="bottom">
                  <van-picker
                    :columns="pickerColumn.gender"
                    @confirm="pickerConfirm.gender"
                    @cancel="pickerState.gender = false" />
                </van-popup>

                <!-- 생일 -->
                <van-field
                  v-model="birthday"
                  name="생일"
                  label="생일"
                  placeholder="생일 선택"
                  is-link
                  readonly
                  @click="toEditBirthday" />

                <!-- 지역 -->
                <van-field
                  v-model="region"
                  is-link
                  readonly
                  name="area"
                  label="지역 선택"
                  placeholder="시/도/구/군 선택"
                  @click="pickerState.region = true" />
                <van-popup v-model:show="pickerState.region" position="bottom">
                  <van-area
                    :area-list="areaList"
                    @confirm="pickerConfirm.region"
                    @cancel="pickerState.region = false" />
                </van-popup>

                <!-- 휴대폰 번호 -->
                <van-field
                  :disabled="true"
                  v-model="localUserInfo.phone"
                  type="tel"
                  name="휴대폰 번호"
                  label="휴대폰 번호"
                  placeholder="휴대폰 번호 입력"
                  :rules="[{ required: false, message: '휴대폰 번호를 입력해주세요' }]" />

                <!-- 자기소개 -->
                <van-field
                  v-model="localUserInfo.resume"
                  name="자기소개"
                  label="자기소개"
                  type="textarea"
                  placeholder="자기소개를 입력해주세요"
                  rows="3"
                  autosize
                  @click="toEditBio" />
              </van-cell-group>

              <div class="flex justify-center mt-20px">
                <button
                  class=""
                  style="
                    background: linear-gradient(145deg, #7eb7ac, #6fb0a4, #5fa89c);
                    border-radius: 30px;
                    padding: 10px 30px;
                    color: white;
                    font-weight: 500;
                    border: none;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                    text-align: center;
                    display: inline-block;
                  "
                  type="submit">
                  저장
                </button>
              </div>
            </van-form>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>
  </div>
</template>

<script setup lang="ts">
import { areaList } from '@vant/area-data'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import router from '@/router'
import type { ModifyUserInfoType, UserInfoType } from '@/services/types.ts'
import { useGroupStore } from '@/stores/group'
import { useLoginHistoriesStore } from '@/stores/loginHistory'
import { useUserStore } from '@/stores/user.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { ModifyUserInfo } from '@/utils/ImRequestUtils'

const genderText = computed(() => {
  const item = pickerColumn.value.gender.find((i) => i.value === localUserInfo.value.sex)
  return item ? item.text : ''
})

const region = ref('')

const birthday = ref('')

const pickerColumn = ref({
  gender: [
    { text: '남', value: 1 },
    { text: '여', value: 2 }
  ]
})

const pickerConfirm = {
  gender: (data: { selectedOptions: any }) => {
    const selected = data.selectedOptions[0].value
    localUserInfo.value.sex = selected
    pickerState.value.gender = false
  },
  region: (data: { selectedOptions: any }) => {
    const selected = data.selectedOptions
    region.value = selected.map((item: { text: any }) => item.text).join('/')
    pickerState.value.region = false
  }
}

const pickerState = ref({
  gender: false,
  region: false,
  date: false
})

const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (downloadUrl) => {
    // 편집 정보 업데이트
    localUserInfo.value.avatar = downloadUrl
    // 사용자 정보 업데이트
    userStore.userInfo!.avatar = downloadUrl
    // 프로필 사진 업데이트 시간 업데이트
    userStore.userInfo!.avatarUpdateTime = Date.now()
    // 로그인 기록 업데이트
    loginHistoriesStore.loginHistories.filter((item) => item.uid === userStore.userInfo!.uid)[0].avatar = downloadUrl
    // 캐시 내 사용자 정보 업데이트
    updateCurrentUserCache('avatar', downloadUrl)
  }
})

// 자르기 처리, hook 메서드 호출
const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

const groupStore = useGroupStore()
const userStore = useUserStore()
const loginHistoriesStore = useLoginHistoriesStore()
const localUserInfo = ref<Partial<ModifyUserInfoType>>({
  name: '',
  sex: 1,
  phone: '',
  avatar: '',
  resume: '',
  modifyNameChance: 0
} as ModifyUserInfoType)

const toEditBirthday = () => {
  router.push('/mobile/mobileMy/editBirthday')
}

const toEditBio = () => {
  router.push('/mobile/mobileMy/editBio')
}

const updateCurrentUserCache = (key: 'name' | 'wearingItemId' | 'avatar', value: any) => {
  const currentUser = userStore.userInfo!.uid && groupStore.getUserInfo(userStore.userInfo!.uid)
  if (currentUser) {
    currentUser[key] = value // 캐시 내 사용자 정보 업데이트
  }
}

const saveEditInfo = () => {
  if (!localUserInfo.value.name || localUserInfo.value.name.trim() === '') {
    window.$message.error('닉네임은 비워둘 수 없습니다')
    return
  }
  // if (localUserInfo.value.modifyNameChance === 0) {
  //   window.$message.error('이름 변경 횟수 부족')
  //   return
  // }

  ModifyUserInfo({
    name: localUserInfo.value.name!,
    sex: localUserInfo.value.sex!,
    phone: localUserInfo.value.phone ?? '',
    avatar: localUserInfo.value.avatar ?? '',
    resume: localUserInfo.value.resume ?? '',
    modifyNameChance: localUserInfo.value.modifyNameChance!
  }).then(() => {
    // 로컬 캐시 사용자 정보 업데이트
    userStore.userInfo!.name = localUserInfo.value.name!
    userStore.userInfo!.sex = localUserInfo.value.sex!
    userStore.userInfo!.phone = localUserInfo.value.phone!
    loginHistoriesStore.updateLoginHistory(<UserInfoType>userStore.userInfo) // 로그인 기록 업데이트
    updateCurrentUserCache('name', localUserInfo.value.name) // 캐시 내 사용자 정보 업데이트
    if (!localUserInfo.value.modifyNameChance) return
    localUserInfo.value.modifyNameChance -= 1
    window.$message.success('수정 성공')
  })
}

onMounted(async () => {
  localUserInfo.value = { ...userStore.userInfo! }
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/form-item.scss';

@use 'vant/lib/index.css';

.custom-border-b-1 {
  border-bottom: 1px solid;
  border-color: #d9d9d9;
}
</style>
