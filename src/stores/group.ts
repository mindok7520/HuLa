import { defineStore } from 'pinia'
import { OnlineEnum, RoleEnum, RoomTypeEnum, StoresEnum } from '@/enums'
import type { GroupDetailReq, UserItem } from '@/services/types'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import * as ImRequestUtils from '@/utils/ImRequestUtils'
import { useChatStore } from './chat'

export const useGroupStore = defineStore(
  StoresEnum.GROUP,
  () => {
    const globalStore = useGlobalStore()
    const userStore = useUserStore()
    const chatStore = useChatStore()

    // 없는 그룹 동적 로드 [동시 충돌 로드 방지]
    const groupDetailsCache = ref<Record<string, GroupDetailReq>>({})
    const loadingGroups = ref<Set<string>>(new Set())

    // 그룹 관련 상태
    const currentSessionState = ref({
      roomId: '',
      loading: false,
      lastLoadedRoomId: ''
    })

    type InternalUserItem = UserItem & { __order?: number }

    const userListMap = reactive<Record<string, UserItem[]>>({})
    const memberOrderCounters = reactive<Record<string, number>>({})
    const onlineCountMap = reactive<Record<string, number>>({})

    const getRoleSortWeight = (roleId?: number) => {
      switch (roleId) {
        case RoleEnum.LORD:
          return 0
        case RoleEnum.ADMIN:
          return 1
        case RoleEnum.NORMAL:
          return 2
        default:
          return 3
      }
    }

    const ensureMemberOrder = (roomId: string, members: InternalUserItem[]) => {
      if (!memberOrderCounters[roomId]) {
        memberOrderCounters[roomId] = 0
      }

      members.forEach((member) => {
        if (member.__order === undefined) {
          member.__order = memberOrderCounters[roomId]++
        }
      })
    }

    const sortMembersByRole = (roomId: string, members: InternalUserItem[]) => {
      ensureMemberOrder(roomId, members)

      return [...members].sort((a, b) => {
        // 역할별 정렬 (방장 > 관리자 > 일반 멤버)
        const roleDiff = getRoleSortWeight(a.roleId) - getRoleSortWeight(b.roleId)
        if (roleDiff !== 0) {
          return roleDiff
        }

        // 마지막으로 가입 순서대로 정렬
        return (a.__order ?? Number.MAX_SAFE_INTEGER) - (b.__order ?? Number.MAX_SAFE_INTEGER)
      })
    }

    const setRoomMemberList = (roomId: string, members: UserItem[]) => {
      if (!Array.isArray(members) || members.length === 0) {
        userListMap[roomId] = []
        memberOrderCounters[roomId] = 0
        onlineCountMap[roomId] = 0
        return
      }

      const sortedMembers = sortMembersByRole(roomId, members as InternalUserItem[])
      userListMap[roomId] = sortedMembers
      onlineCountMap[roomId] = sortedMembers.filter((m) => m.activeStatus === OnlineEnum.ONLINE).length
    }
    const groupDetails = ref<GroupDetailReq[]>([])
    const userListOptions = reactive({ isLast: false, loading: true, cursor: '' }) // 페이징 로드 관련 상태
    const myNameInCurrentGroup = computed({
      get() {
        const user = getCurrentUser()
        return user?.myName || user?.name || ''
      },
      set(value: string) {
        // 여기에 닉네임 설정 로직 추가 가능
        const user = getCurrentUser()
        if (user) {
          user.myName = value
        }
      }
    })

    const myRoleIdInCurrentGroup = computed({
      get() {
        return getCurrentUser()?.roleId || RoleEnum.NORMAL
      },
      set(value: number) {
        // 여기에 역할 설정 로직 추가 가능
        const user = getCurrentUser()
        if (user) {
          user.roleId = value
        }
      }
    })

    // 현재 세션 상태 가져오기 메서드 추가
    const getCurrentSessionState = () => {
      return {
        ...currentSessionState.value,
        isCurrentRoom: (roomId: string) => currentSessionState.value.roomId === roomId
      }
    }

    // 멤버 캐시 관리 메서드 추가
    const getCachedMembers = (roomId: string) => {
      return userListMap[roomId] || []
    }

    const updateMemberCache = (roomId: string, members: UserItem[]) => {
      setRoomMemberList(roomId, members)
    }

    /**
     * 세션 전환 메서드 추가
     */
    const switchSession = async (newSession: any, _oldSession?: any) => {
      if (!newSession?.roomId || newSession.roomId === currentSessionState.value.roomId) {
        return
      }

      // 현재 로드 중인 방 ID 설정
      currentSessionState.value.roomId = newSession.roomId
      currentSessionState.value.loading = true

      try {
        // 캐시 우선 표시
        const cachedMembers = getCachedMembers(newSession.roomId)
        if (cachedMembers && Array.isArray(cachedMembers)) {
          // 공백 방지를 위해 캐시 데이터 먼저 설정
          setRoomMemberList(newSession.roomId, cachedMembers)
        }

        // 그룹 재설정 및 새 그룹 멤버 데이터 로드
        resetGroupData()
        await getGroupUserList(newSession.roomId, true)

        // 캐시 업데이트
        const currentMembers = userListMap[newSession.roomId] || []
        updateMemberCache(newSession.roomId, currentMembers)
        currentSessionState.value.lastLoadedRoomId = newSession.roomId

        // 처리된 데이터 반환
        return {
          success: true,
          members: currentMembers,
          roomId: newSession.roomId
        }
      } catch (error) {
        console.error('세션 전환 실패:', error)
        currentSessionState.value.loading = false
        throw error
      } finally {
        currentSessionState.value.loading = false
      }
    }

    // 현재 방의 사용자 목록 가져오기 계산 속성
    const userList = computed(() => {
      if (!globalStore.currentSessionRoomId) return []
      return userListMap[globalStore.currentSessionRoomId] || []
    })

    const setGroupDetails = async () => {
      const data = await ImRequestUtils.groupList()
      groupDetails.value = data
    }

    const addGroupDetail = async (roomId: string) => {
      if (groupDetails.value.find((item) => item.roomId === roomId)) {
        return
      }
      const data = await ImRequestUtils.getGroupDetail(roomId)
      groupDetails.value.push(data)
    }

    const userMapByRoomId = computed(() => {
      const map = new Map<string, Map<string, UserItem>>()
      Object.entries(userListMap).forEach(([roomId, list]) => {
        const roomMap = new Map<string, UserItem>()
        list.forEach((item) => {
          roomMap.set(item.uid, item)
        })
        map.set(roomId, roomMap)
      })
      return map
    })

    const allUserMap = computed(() => {
      const map = new Map<string, UserItem>()
      Object.values(userListMap)
        .flat()
        .forEach((item) => {
          map.set(item.uid, item)
        })
      return map
    })

    const getUserInfo = computed(() => (uid: string, roomId?: string) => {
      const targetRoomId = roomId ?? globalStore.currentSessionRoomId
      if (targetRoomId) {
        const userInRoom = userMapByRoomId.value.get(targetRoomId)?.get(uid)
        if (userInRoom) {
          return userInRoom
        }
      }

      return allUserMap.value.get(uid)
    })

    const userDisplayNameMap = computed(() => {
      const map = new Map<string, string>()
      userList.value.forEach((item) => {
        map.set(item.uid, item.myName || item.name || '')
      })
      return map
    })

    const getUserDisplayName = computed(() => (uid: string) => {
      return userDisplayNameMap.value.get(uid) || ''
    })

    const allUserInfo = computed(() => {
      const set = new Set<UserItem>()
      Object.values(userListMap)
        .flat()
        .forEach((user) => {
          set.add(user)
        })
      return Array.from(set)
    })

    const updateGroupDetail = async (roomId: string, detail: Partial<GroupDetailReq>) => {
      const targetGroup = groupDetails.value.find((item) => item.roomId === roomId)!
      const newData = {
        ...targetGroup,
        ...detail
      }
      Object.assign(targetGroup, newData)
    }

    const updateOnlineNum = (options: { uid?: string; roomId?: string; onlineNum?: number; isAdd?: boolean }) => {
      const { uid, roomId, onlineNum, isAdd } = options

      if (roomId) {
        // roomId가 전달된 경우 해당 방의 onlineNum만 수정
        const groupDetail = groupDetails.value.find((detail) => detail.roomId === roomId)
        if (groupDetail) {
          if (onlineNum) {
            groupDetail.onlineNum = onlineNum
          } else {
            if (isAdd) {
              groupDetail.onlineNum++
            } else {
              groupDetail.onlineNum--
            }
          }
        }
      } else {
        // roomId가 전달되지 않은 경우 전역 업데이트
        const roomIds = getRoomIdsByUid(uid!)

        // 찾은 모든 방 ID를 순회하며 해당 그룹의 온라인 인원수 업데이트
        roomIds.forEach((roomId) => {
          const groupDetail = groupDetails.value.find((detail) => detail.roomId === roomId)
          if (groupDetail) {
            if (isAdd) {
              groupDetail.onlineNum++
            } else {
              groupDetail.onlineNum--
            }
          }
        })
      }
    }

    /**
     * 현재 방장 ID 가져오기
     * 멤버 목록에서 역할이 방장인 사용자 필터링
     */
    const currentLordId = computed(() => {
      const list = userList.value.filter((member: UserItem) => member.roleId === RoleEnum.LORD)
      if (list.length) {
        return list[0]?.uid
      }
      return -99
    })

    const isCurrentLord = computed(() => (uid: string) => {
      return chatStore.isGroup && currentLordId.value === uid
    })

    /**
     * 현재 관리자 ID 목록 가져오기
     * 멤버 목록에서 모든 관리자의 uid 필터링
     */
    const adminUidList = computed(() => {
      return userList.value
        .filter((member: UserItem) => member.roleId === RoleEnum.ADMIN)
        .map((member: UserItem) => member.uid)
    })

    /**
     * 관리자 상태 업데이트
     * @param roomId 방 ID
     * @param uids 관리자로 설정/취소할 사용자 ID 목록
     * @param isAdmin 관리자 여부
     */
    const updateAdminStatus = (roomId: string, uids: string[], isAdmin: boolean) => {
      const currentUserList = userListMap[roomId]
      if (!currentUserList) {
        console.warn(`방 ${roomId}의 사용자 목록을 찾을 수 없음`)
        return
      }

      // 사용자 역할 업데이트
      const updatedUserList = currentUserList.map((user) => {
        if (uids.includes(user.uid)) {
          return {
            ...user,
            roleId: isAdmin ? RoleEnum.ADMIN : RoleEnum.NORMAL
          }
        }
        return user
      })

      // 사용자 목록 업데이트
      setRoomMemberList(roomId, updatedUserList)
    }

    /**
     * 사용자가 관리자인지 확인
     * @param uid 사용자 ID
     * @returns 관리자 여부
     */
    const isAdmin = computed(() => (uid: string) => {
      return chatStore.isGroup && adminUidList.value.includes(uid)
    })

    /**
     * 관리자 기본 정보 목록 가져오기
     * 관리자 ID 목록을 기반으로 상세 정보 가져오기
     */
    const adminList = computed<UserItem[]>(() => {
      return userList.value.filter((member: UserItem) => adminUidList.value.includes(member.uid))
    })

    const getCurrentUser = (): UserItem => {
      return userList.value.find((member: UserItem) => member.uid === userStore.userInfo!.uid)!
    }

    const removeGroupDetail = (roomId: string) => {
      groupDetails.value = groupDetails.value.filter((item) => item.roomId !== roomId)
    }

    const isAdminOrLord = () => {
      const currentUser = getCurrentUser()
      return isAdmin.value(currentUser.uid) || isCurrentLord.value(currentUser.uid)
    }

    /**
     * 모든 멤버의 기본 정보 목록 가져오기
     * 역할 정보 포함 (방장/관리자/일반 멤버)
     */
    const memberList = computed(() => {
      const memberInfoList = userList.value
      return memberInfoList.map((member: UserItem) => {
        if (adminUidList.value.includes(member.uid)) {
          return {
            ...member,
            account: member.account,
            roleId: RoleEnum.ADMIN
          }
        } else if (member.uid === currentLordId.value) {
          return {
            ...member,
            account: member.account,
            roleId: RoleEnum.LORD
          }
        }
        return member
      })
    })

    // 그룹 기본 정보
    const countInfo = computed(() => {
      return groupDetails.value.find((item: GroupDetailReq) => item.roomId === globalStore.currentSessionRoomId)
    })

    const getGroupDetailByRoomId = computed(() => (roomId: string) => {
      return groupDetails.value.find((item: GroupDetailReq) => item.roomId === roomId)
    })

    // 상태 정의: 진행 중인 요청을 관리하기 위한 Map 추가
    const fetchPromisesMap = ref<Record<string, Promise<GroupDetailReq>>>({})

    /**
     * 스마트 그룹 상세 정보 가져오기: 로컬에 있으면 직접 반환, 없으면 원격에서 가져와 캐시
     * @param roomId 그룹 ID
     */
    const fetchGroupDetailSafely = async (roomId: string, forceRefresh: boolean = false): Promise<GroupDetailReq> => {
      // 1. 로컬 캐시 확인 (강제 새로 고침 제외)
      const existingDetail = getGroupDetailByRoomId.value(roomId)
      if (existingDetail && !forceRefresh) {
        return existingDetail
      }

      // 2. 동시 중복 요청 방지
      try {
        // 3. 새 요청 Promise 생성 및 캐시
        fetchPromisesMap.value[roomId] = (async () => {
          try {
            // 기존 원격 가져오기 메서드 호출
            await addGroupDetail(roomId)

            const finalDetail = getGroupDetailByRoomId.value(roomId)
            if (!finalDetail) {
              throw new Error(`그룹 ${roomId} 데이터 가져오기 실패`)
            }
            return finalDetail
          } finally {
            // 현재 요청의 캐시 정리
            delete fetchPromisesMap.value[roomId]
          }
        })()

        // 4. 요청 완료 대기 및 결과 반환
        return await fetchPromisesMap.value[roomId]
      } catch (error) {
        console.error(`그룹 ${roomId} 상세 정보 가져오기 실패:`, error)
        throw error
      }
    }

    /**
     * 로컬 방 정보 가져오기
     */
    const getGroupDetail = computed(() => (roomId: string) => {
      return groupDetailsCache.value[roomId] || getGroupDetailByRoomId.value(roomId)
    })

    const loadGroupDetails = async (roomIds: string[]) => {
      const uniqueRoomIds = [...new Set(roomIds.filter((id) => id))]

      for (const roomId of uniqueRoomIds) {
        if (groupDetailsCache.value[roomId] || loadingGroups.value.has(roomId)) {
          continue
        }

        loadingGroups.value.add(roomId)
        try {
          const detail = await fetchGroupDetailSafely(roomId)
          groupDetailsCache.value[roomId] = detail
        } catch (_error) {
        } finally {
          loadingGroups.value.delete(roomId)
        }
      }
    }

    const updateGroupNumber = (roomId: string, totalNum: number, onlineNum: number) => {
      const group = groupDetails.value.find((item) => item.roomId === roomId)
      if (group) {
        group.memberNum = totalNum
        group.onlineNum = onlineNum
        if (typeof onlineNum === 'number') {
          onlineCountMap[roomId] = onlineNum
        }
      }
    }

    /**
     * 그룹 멤버 목록 가져오기
     * @param roomId 그룹 채팅 방 ID
     * @param forceRefresh 강제 새로 고침 여부, 기본값 false
     */
    const getGroupUserList = async (roomId: string, forceRefresh = false) => {
      if (!roomId) {
        console.warn('[group] skip member refresh, invalid room id:', roomId)
        return []
      }

      const cachedList = userListMap[roomId]

      if (!forceRefresh && Array.isArray(cachedList) && cachedList.length > 0) {
        return cachedList
      }

      if (!Array.isArray(cachedList)) {
        setRoomMemberList(roomId, [])
      }

      const data = await ImRequestUtils.groupListMember(roomId)
      if (!data) {
        userListOptions.loading = false
        return []
      }

      userListOptions.loading = false

      const list = Array.isArray(data) ? [...data] : []
      updateMemberCache(roomId, list)

      return userListMap[roomId]
    }

    const cleanupSession = () => {
      currentSessionState.value = {
        roomId: '',
        loading: false,
        lastLoadedRoomId: ''
      }
    }

    /**
     * 더 많은 그룹 멤버 로드
     * 페이징 로드, 중복 로드 방지
     */
    const loadMoreGroupMembers = async () => {
      if (userListOptions.isLast || userListOptions.loading) return
      userListOptions.loading = true
      await getGroupUserList(globalStore.currentSessionRoomId)
      userListOptions.loading = false
    }

    /**
     * userListMap에서 특정 사용자 정보 업데이트
     * @param uid 사용자 ID
     * @param updates 업데이트할 사용자 정보 (일부 필드)
     * @param roomId 그룹 채팅 방 ID, 선택 사항, 기본값은 현재 방; 'all'을 전달하면 모든 방의 해당 사용자 업데이트
     * @returns 업데이트 성공 여부
     */
    const updateUserItem = (uid: string, updates: Partial<UserItem>, roomId: string | 'all' = 'all'): boolean => {
      if (!uid || typeof uid !== 'string') {
        console.warn('[updateUserItem] invalid uid:', uid)
        return false
      }

      if (!updates || typeof updates !== 'object') {
        console.warn('[updateUserItem] invalid update payload:', updates)
        return false
      }

      const refreshTargets = new Set<string>()

      if (roomId === 'all') {
        getRoomIdsByUid(uid).forEach((room) => {
          refreshTargets.add(room)
        })
      } else {
        const targetRoomId = roomId || globalStore.currentSessionRoomId
        if (!targetRoomId) {
          return false
        }
        refreshTargets.add(targetRoomId)
      }

      if (refreshTargets.size === 0) {
        return false
      }

      refreshTargets.forEach((validRoomId) => {
        getGroupUserList(validRoomId, true).catch((error) => {
          console.error('[group] refresh members failed:', error)
        })
      })

      return true
    }

    /**
     * userListMap에 새 사용자 추가
     * @param userItem 추가할 사용자 정보
     * @param roomId 그룹 채팅 방 ID, 선택 사항, 기본값은 현재 방; 'all'을 전달하면 모든 방에 추가
     * @param allowDuplicate 중복 추가 허용 여부, 기본값 false
     * @returns 추가 성공 여부
     */
    const addUserItem = (userItem: UserItem, roomId?: string): boolean => {
      if (!userItem || typeof userItem !== 'object' || !userItem.uid) {
        console.warn('[addUserItem] invalid user info:', userItem)
        return false
      }

      const targetRoomId = roomId || globalStore.currentSessionRoomId
      if (!targetRoomId) {
        console.warn('[addUserItem] 대상 방 ID를 확인할 수 없습니다')
        return false
      }

      getGroupUserList(targetRoomId, true).catch((error) => {
        console.error('[group] refresh members failed:', error)
      })

      return true
    }

    /**
     * userListMap에서 지정된 사용자 제거
     * @param uid 제거할 사용자 ID
     * @param roomId 그룹 채팅 방 ID, 선택 사항, 기본값은 현재 방; 'all'을 전달하면 모든 방에서 제거
     * @returns 제거 성공 여부
     */
    const removeUserItem = (uid: string, roomId?: string): boolean => {
      if (!uid || typeof uid !== 'string') {
        console.warn('[removeUserItem] invalid uid:', uid)
        return false
      }

      const targetRoomId = roomId || globalStore.currentSessionRoomId
      if (!targetRoomId) {
        console.warn('[removeUserItem] 대상 방 ID를 확인할 수 없습니다')
        return false
      }

      getGroupUserList(targetRoomId, true).catch((error) => {
        console.error('[group] refresh members failed:', error)
      })

      return true
    }

    /**
     * 특정 방의 모든 사용자 데이터 제거
     * @param roomId
     */
    const removeAllUsers = (roomId: string) => {
      setRoomMemberList(roomId, [])
    }

    /**
     * 그룹 관리자 추가
     * @param uidList 관리자로 추가할 사용자 ID 목록
     */
    const addAdmin = async (uidList: string[]) => {
      await ImRequestUtils.addAdmin({ roomId: globalStore.currentSessionRoomId, uidList })
      // 로컬 그룹 멤버 목록의 역할 정보 업데이트
      const targetRoomId = globalStore.currentSessionRoomId
      if (!targetRoomId) return

      const currentUserList = userListMap[targetRoomId] || []
      const updatedList = currentUserList.map((user: UserItem) => {
        if (uidList.includes(user.uid)) {
          return { ...user, roleId: RoleEnum.ADMIN }
        }
        return user
      })
      setRoomMemberList(targetRoomId, updatedList)
    }

    /**
     * 그룹 관리자 자격 취소
     * @param uidList 취소할 관리자 ID 목록
     */
    const revokeAdmin = async (uidList: string[]) => {
      await ImRequestUtils.revokeAdmin({ roomId: globalStore.currentSessionRoomId, uidList })
      // 로컬 그룹 멤버 목록의 역할 정보 업데이트
      const targetRoomId = globalStore.currentSessionRoomId
      if (!targetRoomId) return

      const currentUserList = userListMap[targetRoomId] || []
      const updatedList = currentUserList.map((user: UserItem) => {
        if (uidList.includes(user.uid)) {
          return { ...user, roleId: RoleEnum.NORMAL }
        }
        return user
      })
      setRoomMemberList(targetRoomId, updatedList)
    }

    /**
     * 그룹 멤버 추방
     * @param uidList 추방할 멤버 ID 목록
     * @param roomId 그룹 채팅 방 ID, 선택 사항, 기본값은 현재 방
     */
    const removeGroupMembers = async (uidList: string[], roomId?: string) => {
      const targetRoomId = roomId || globalStore.currentSessionRoomId
      if (!targetRoomId) {
        throw new Error('대상 방 ID를 확인할 수 없습니다')
      }

      // 추방 인터페이스 호출
      await ImRequestUtils.removeGroupMember({ roomId: targetRoomId, uidList })

      // 로컬 그룹 멤버 목록 업데이트, 추방된 멤버 제거
      const currentUserList = userListMap[targetRoomId] || []
      const updatedList = currentUserList.filter((user: UserItem) => !uidList.includes(user.uid))
      setRoomMemberList(targetRoomId, updatedList)
    }

    /**
     * 그룹 채팅 나가기 / 그룹 채팅 해산
     * @param roomId 나갈 그룹 채팅 ID
     */
    const exitGroup = async (roomId: string) => {
      if (!roomId) return

      await ImRequestUtils.exitGroup({ roomId })

      // 그룹 멤버 캐시 업데이트, 본인 제거
      const currentUserList = userListMap[roomId] || []
      const updatedList = currentUserList.filter((user: UserItem) => user.uid !== userStore.userInfo!.uid)
      setRoomMemberList(roomId, updatedList)

      // 해당 그룹 상세 캐시 삭제
      removeGroupDetail(roomId)

      // 대화 목록 업데이트, 전달된 roomId 사용
      chatStore.removeSession(roomId)

      // 현재 선택된 대화에서 나가는 경우 새로운 현재 대화로 전환
      if (globalStore.currentSessionRoomId === roomId) {
        const fallbackSession = chatStore.sessionList[0]
        globalStore.updateCurrentSessionRoomId(fallbackSession ? fallbackSession.roomId : '')
      }
    }

    /**
     * 온라인 상태 변경 시 그룹 멤버 목록 새로 고침 처리
     */
    const refreshGroupMembers = async () => {
      // 항상 채널 멤버 목록 새로 고침
      await getGroupUserList('1', true)

      // 현재 선택된 것이 그룹 채팅이고 채널이 아닌 경우, 현재 그룹 채팅의 멤버 목록도 동시에 새로 고침
      if (globalStore.currentSession?.type === RoomTypeEnum.GROUP && globalStore.currentSessionRoomId !== '1') {
        await getGroupUserList(globalStore.currentSessionRoomId, true)
      }
    }

    /**
     * 그룹 데이터 재설정
     * 세션 전환 시 현재 그룹 데이터 지우기
     * @param roomId 선택 사항, 정리할 방 ID 지정, 전달하지 않으면 모두 정리
     */
    const resetGroupData = () => {
      userListOptions.cursor = ''
      userListOptions.isLast = false
      userListOptions.loading = false
    }

    /**
     * 지정된 방의 사용자 목록 가져오기
     * @param roomId 방 ID
     * @returns 사용자 목록
     */
    const getUserListByRoomId = (roomId: string): UserItem[] => {
      return userListMap[roomId] || []
    }

    const getUser = (roomId: string, uid: string): UserItem | undefined => {
      const roomUserList = userListMap[roomId]
      if (!roomUserList) {
        return undefined
      }
      return roomUserList.find((item) => item.uid === uid)
    }

    /**
     * 사용자 ID를 기반으로 해당 사용자가 속한 모든 방 ID 찾기
     * @param uid 사용자 ID
     * @returns 해당 사용자를 포함하는 모든 방 ID 배열
     */
    const getRoomIdsByUid = (uid: string): string[] => {
      const roomIds: string[] = []

      // 모든 방의 사용자 목록 순회
      Object.keys(userListMap).forEach((roomId) => {
        const userList = userListMap[roomId]
        if (!Array.isArray(userList) || userList.length === 0) {
          return
        }
        // 현재 방에 지정된 사용자가 포함되어 있는지 확인
        const hasUser = userList.some((user) => user.uid === uid)
        if (hasUser) {
          roomIds.push(roomId)
        }
      })

      return roomIds
    }

    return {
      userList,
      userListMap,
      userListOptions,
      loadMoreGroupMembers,
      getGroupUserList,
      updateUserItem,
      addUserItem,
      removeUserItem,
      currentLordId,
      adminUidList,
      adminList,
      memberList,
      addAdmin,
      revokeAdmin,
      removeGroupMembers,
      exitGroup,
      refreshGroupMembers,
      resetGroupData,
      getUserListByRoomId,
      countInfo,
      getUser,
      getRoomIdsByUid,
      onlineCountMap,
      updateOnlineNum,
      removeAllUsers,
      getCurrentUser,
      myNameInCurrentGroup,
      myRoleIdInCurrentGroup,
      setGroupDetails,
      updateGroupDetail,
      groupDetails,
      getGroupDetailByRoomId,
      getGroupDetail,
      loadGroupDetails,
      updateGroupNumber,
      removeGroupDetail,
      addGroupDetail,
      updateAdminStatus,
      switchSession,
      getCurrentSessionState,
      getCachedMembers,
      updateMemberCache,
      getUserInfo,
      allUserInfo,
      getUserDisplayName,
      isCurrentLord,
      isAdmin,
      isAdminOrLord,
      cleanupSession
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
