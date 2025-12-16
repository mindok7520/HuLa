import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { StoresEnum } from '@/enums'
import {
  feedList as getFeedListApi,
  feedDetail as getFeedDetailApi,
  pushFeed,
  delFeed,
  editFeed,
  feedLikeToggle,
  feedLikeList,
  feedLikeCount,
  feedLikeHasLiked,
  feedCommentAdd,
  feedCommentDelete,
  feedCommentAll,
  feedCommentCount
} from '@/utils/ImRequestUtils'

/**
 * 타임라인/피드 Store
 * 피드 목록, 게시, 삭제, 편집 등 기능 관리
 */

// 좋아요 사용자 정보
export interface LikeUser {
  uid: string | number
  userName: string
  userAvatar: string
}

// 댓글 정보
export interface CommentItem {
  id: string | number
  uid: string | number
  userName: string
  content: string
  createTime?: number
  replyCommentId?: string | number // 답장된 댓글 ID
  replyUid?: string | number // 답장받는 사람의 uid
  replyUserName?: string // 답장받는 사람의 이름
}

// 타임라인 항목 유형 정의
export interface FeedItem {
  id: string
  content: string
  urls?: string[] | null // 이미지 URL 목록
  videoUrl?: string
  createTime?: number
  createBy?: string // 작성자 ID
  uid: string // 사용자 ID
  commentCount?: number
  likeCount?: number // 좋아요 수
  likeList?: LikeUser[] // 좋아요 사용자 목록
  commentList?: CommentItem[] // 댓글 목록
  hasLiked?: boolean // 좋아요 여부
  mediaType?: 0 | 1 | 2 // 0-일반 텍스트, 1-이미지, 2-비디오
  userName?: string
  userAvatar?: string
  permission?: 'privacy' | 'open' | 'partVisible' | 'notAnyone'
}

// 피드 게시 매개변수
export interface PublishFeedParams {
  content: string
  mediaType: 0 | 1 | 2
  urls?: string[]
  videoUrl?: string
  permission: 'privacy' | 'open' | 'partVisible' | 'notAnyone'
  uidList?: number[]
  targetIds?: number[]
}

// 피드 편집 매개변수
export interface EditFeedParams {
  id: number
  content: string
  mediaType: 0 | 1 | 2
  urls?: string[]
  videoUrl?: string
  permission: 'privacy' | 'open' | 'partVisible' | 'notAnyone'
  uidList?: number[]
  targetIds?: number[]
}

export const useFeedStore = defineStore(
  StoresEnum.FEED,
  () => {
    // 피드 목록
    const feedList = ref<FeedItem[]>([])

    // 페이징 옵션
    const feedOptions = reactive({
      isLast: false,
      isLoading: false,
      cursor: ''
    })

    // 통계 정보
    const feedStats = reactive({
      total: 0,
      followCount: 0,
      fansCount: 0
    })

    // 읽지 않은 메시지 수
    const unreadCount = ref(0)

    // 타임라인 읽지 않은 상태 (전역 알림 처리에 사용)
    const feedUnreadStatus = reactive({
      hasUnread: false, // 읽지 않은 알림 여부
      unreadCount: 0 // 읽지 않은 알림 수
    })

    /**
     * 피드 목록 가져오기
     * @param isFresh 목록 새로 고침 여부, true이면 다시 로드, false이면 더 보기 로드
     */
    const getFeedList = async (isFresh = false) => {
      // 비-새로 고침 모드에서 이미 로드가 완료되었거나 로드 중인 경우 바로 반환
      if (!isFresh) {
        if (feedOptions.isLast || feedOptions.isLoading) return
      }

      feedOptions.isLoading = true

      try {
        const response = await getFeedListApi({
          pageSize: 20,
          cursor: isFresh ? '' : feedOptions.cursor
        })

        if (!response) return

        const data = response

        // 새로 고침 모드에서는 전체 목록 교체, 그렇지 않으면 목록 끝에 추가
        if (isFresh) {
          feedList.value.splice(0, feedList.value.length, ...data.list)
        } else {
          feedList.value.push(...data.list)
        }

        // 페이징 정보 업데이트
        feedOptions.cursor = data.cursor
        feedOptions.isLast = data.isLast

        // 통계 정보 업데이트
        feedStats.total = data.total || feedList.value.length
      } catch (error) {
        console.error('피드 목록 가져오기 실패:', error)
        throw error
      } finally {
        feedOptions.isLoading = false
      }
    }

    /**
     * 피드 게시
     * @param params 게시 매개변수
     */
    const publishFeed = async (params: PublishFeedParams) => {
      try {
        const response = await pushFeed(params)

        // 게시 성공 후 목록 새로 고침
        await getFeedList(true)

        return response
      } catch (error) {
        console.error('동태 발행 실패:', error)
        throw error
      }
    }

    /**
     * 피드 삭제
     * @param feedId 피드 ID
     */
    const deleteFeed = async (feedId: string) => {
      try {
        await delFeed({ feedId })

        // 목록에서 삭제된 피드 제거
        const index = feedList.value.findIndex((item: any) => item.id === feedId)
        if (index > -1) {
          feedList.value.splice(index, 1)
          feedStats.total = Math.max(0, feedStats.total - 1)
        }
      } catch (error) {
        console.error('동태 삭제 실패:', error)
        throw error
      }
    }

    /**
     * 피드 편집
     * @param params 편집 매개변수
     */
    const updateFeed = async (params: EditFeedParams) => {
      try {
        await editFeed(params)

        // 최신 데이터를 가져오기 위해 목록 새로 고침
        await getFeedList(true)
      } catch (error) {
        console.error('동태 편집 실패:', error)
        throw error
      }
    }

    /**
     * 피드 더 보기 로드
     */
    const loadMore = async () => {
      await getFeedList(false)
    }

    /**
     * 피드 목록 새로 고침
     */
    const refresh = async () => {
      await getFeedList(true)
    }

    /**
     * 피드 목록 지우기
     */
    const clearFeedList = () => {
      feedList.value = []
      feedOptions.cursor = ''
      feedOptions.isLast = false
      feedStats.total = 0
    }

    /**
     * 통계 정보 업데이트
     */
    const updateStats = (stats: Partial<typeof feedStats>) => {
      Object.assign(feedStats, stats)
    }

    /**
     * 읽지 않은 메시지 수 증가
     */
    const increaseUnreadCount = (count = 1) => {
      unreadCount.value += count
    }

    /**
     * 읽지 않은 메시지 수 감소
     */
    const decreaseUnreadCount = (count = 1) => {
      unreadCount.value = Math.max(0, unreadCount.value - count)
    }

    /**
     * 읽지 않은 메시지 수 지우기
     */
    const clearUnreadCount = () => {
      unreadCount.value = 0
      feedUnreadStatus.unreadCount = 0
      feedUnreadStatus.hasUnread = false
    }

    /**
     * 읽지 않은 메시지 수 설정
     */
    const setUnreadCount = (count: number) => {
      unreadCount.value = count
    }

    // ==================== 좋아요 관련 메서드 ====================
    /**
     * 좋아요 또는 좋아요 취소
     */
    const toggleLike = async (feedId: string, actType: number) => {
      try {
        await feedLikeToggle({ feedId, actType })
        // 로컬 상태 업데이트
        const feed = feedList.value.find((f: any) => f.id === feedId)
        if (feed) {
          if (actType === 1) {
            feed.hasLiked = true
            try {
              const likeListResult = await getLikeList(feedId)
              if (Array.isArray(likeListResult)) {
                feed.likeList = likeListResult
                feed.likeCount = likeListResult.length
              }
            } catch (_error) {
              feed.likeCount = (feed.likeCount || 0) + 1
            }
          } else if (actType === 2) {
            feed.hasLiked = false
            try {
              const likeListResult = await getLikeList(feedId)
              if (Array.isArray(likeListResult)) {
                feed.likeList = likeListResult
                feed.likeCount = likeListResult.length
              }
            } catch (_error) {
              feed.likeCount = Math.max(0, (feed.likeCount || 1) - 1)
            }
          }
        }
        return true
      } catch (error) {
        console.error('좋아요 실패:', error)
        throw error
      }
    }

    /**
     * 좋아요 목록 가져오기
     */
    const getLikeList = async (feedId: string) => {
      try {
        return await feedLikeList({ feedId })
      } catch (error) {
        console.error('좋아요 목록 가져오기 실패:', error)
        throw error
      }
    }

    /**
     * 좋아요 수 가져오기
     */
    const getLikeCount = async (feedId: string) => {
      try {
        return await feedLikeCount({ feedId })
      } catch (error) {
        console.error('좋아요 수 가져오기 실패:', error)
        throw error
      }
    }

    /**
     * 좋아요 여부 확인
     */
    const checkHasLiked = async (feedId: string) => {
      try {
        return await feedLikeHasLiked({ feedId })
      } catch (error) {
        console.error('좋아요 상태 확인 실패:', error)
        throw error
      }
    }

    // ==================== 댓글 관련 메서드 ====================

    /**
     * 댓글 작성
     */
    const addComment = async (feedId: string, content: string, replyCommentId?: string, replyUid?: string) => {
      try {
        await feedCommentAdd({ feedId, content, replyCommentId, replyUid })
        const feed = feedList.value.find((f: any) => f.id === feedId)
        if (feed) {
          // 최신 댓글 목록 가져오기
          try {
            const commentListResult = await getCommentList(feedId)
            if (Array.isArray(commentListResult)) {
              feed.commentList = commentListResult
              feed.commentCount = commentListResult.length
            }
          } catch (_error) {
            // 가져오기 실패 시 로컬 카운트 사용
            feed.commentCount = (feed.commentCount || 0) + 1
          }
        }
        return true
      } catch (error) {
        console.error('댓글 작성 실패:', error)
        throw error
      }
    }

    /**
     * 댓글 삭제
     */
    const deleteComment = async (commentId: string, feedId?: string) => {
      try {
        await feedCommentDelete({ commentId })
        // 댓글 수 업데이트
        if (feedId) {
          const feed = feedList.value.find((f: any) => f.id === feedId)
          if (feed && feed.commentCount) {
            feed.commentCount = Math.max(0, feed.commentCount - 1)
          }
        }
        return true
      } catch (error) {
        console.error('댓글 삭제 실패:', error)
        throw error
      }
    }

    /**
     * 댓글 목록 가져오기 (페이징 없음, 댓글 작성 후 업데이트용)
     */
    const getCommentList = async (feedId: string) => {
      try {
        return await feedCommentAll({ feedId })
      } catch (error) {
        console.error('댓글 목록 가져오기 실패:', error)
        throw error
      }
    }

    /**
     * 댓글 수 가져오기
     */
    const getCommentCount = async (feedId: string) => {
      try {
        return await feedCommentCount({ feedId })
      } catch (error) {
        console.error('댓글 수 가져오기 실패:', error)
        throw error
      }
    }

    /**
     * 단일 피드 상세 정보 가져오기
     */
    const getFeedDetail = async (feedId: string) => {
      try {
        const result = await getFeedDetailApi({ feedId })
        console.log('피드 상세 정보 가져오기 성공:', result)
      } catch (error) {
        console.error('피드 상세 정보 가져오기 실패:', error)
        throw error
      }
    }

    /**
     * 타임라인 알림 처리 (전역 처리)
     * WebSocket 알림 수신 시 읽지 않은 상태 업데이트에 사용
     */
    const handleFeedNotification = (_data: any) => {
      // 읽지 않은 상태 업데이트
      feedUnreadStatus.hasUnread = true
      feedUnreadStatus.unreadCount++

      // 동시에 총 읽지 않은 수 업데이트
      increaseUnreadCount(1)

      console.log('피드 알림이 처리됨, 미읽 수:', feedUnreadStatus.unreadCount)
    }

    /**
     * 타임라인 읽지 않은 상태 지우기
     */
    const clearFeedUnreadStatus = () => {
      feedUnreadStatus.hasUnread = false
      feedUnreadStatus.unreadCount = 0
    }

    return {
      feedList,
      feedOptions,
      feedStats,
      unreadCount,
      feedUnreadStatus,
      getFeedList,
      publishFeed,
      deleteFeed,
      updateFeed,
      loadMore,
      refresh,
      clearFeedList,
      updateStats,
      increaseUnreadCount,
      decreaseUnreadCount,
      clearUnreadCount,
      setUnreadCount,
      // 좋아요 관련
      toggleLike,
      getLikeList,
      getLikeCount,
      checkHasLiked,
      // 댓글 관련
      addComment,
      deleteComment,
      getCommentList,
      getCommentCount,
      // 상세 정보 관련
      getFeedDetail,
      // 알림 처리
      handleFeedNotification,
      clearFeedUnreadStatus
    }
  },
  {
    // 상태 공유 활성화
    share: {
      enable: true,
      initialize: true
    }
  }
)
