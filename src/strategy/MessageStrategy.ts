import { BaseDirectory, readFile, remove, writeFile } from '@tauri-apps/plugin-fs'
import DOMPurify from 'dompurify'
import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { MessageStatusEnum, MsgEnum, UploadSceneEnum } from '@/enums'
import { parseInnerText } from '@/hooks/useCommon.ts'
import { type UploadOptions, UploadProviderEnum, useUpload } from '@/hooks/useUpload'
import type { MessageType } from '@/services/types.ts'
import { fixFileMimeType, isVideoUrl } from '@/utils/FileType'
import { getMimeTypeFromExtension, removeTag } from '@/utils/Formatting'
import { getImageDimensions } from '@/utils/ImageUtils'
import { isMobile } from '@/utils/PlatformConstants'
import { generateVideoThumbnail } from '@/utils/VideoThumbnail'
import { useGroupStore } from '../stores/group'

interface MessageStrategy {
  getMsg: (msgInputValue: string, replyValue: any, fileList?: File[]) => any
  buildMessageBody: (msg: any, reply: any) => any
  buildMessageType: (messageId: string, messageBody: any, globalStore: any, userUid: Ref<any>) => MessageType
  uploadFile: (
    path: string,
    options?: { provider?: UploadProviderEnum }
  ) => Promise<{ uploadUrl: string; downloadUrl: string; config?: any }>
  doUpload: (path: string, uploadUrl: string, options?: any) => Promise<{ qiniuUrl?: string } | void>
  uploadThumbnail?: (
    thumbnailFile: File,
    options?: { provider?: UploadProviderEnum }
  ) => Promise<{ uploadUrl: string; downloadUrl: string; config?: any }>
  doUploadThumbnail?: (thumbnailFile: File, uploadUrl: string, options?: any) => Promise<{ qiniuUrl?: string } | void>
  getUploadProgress?: () => { progress: any; onChange: any }
}

/**
 * 메시지 전략 추상 클래스, 모든 메시지 전략은 이 인터페이스를 구현해야 함
 */
abstract class AbstractMessageStrategy implements MessageStrategy {
  public readonly msgType: MsgEnum

  constructor(msgType: MsgEnum) {
    this.msgType = msgType
  }

  buildMessageType(messageId: string, messageBody: any, globalStore: any, userUid: Ref<any>): MessageType {
    const currentTime = new Date().getTime()
    const groupStore = useGroupStore()
    return {
      fromUser: {
        uid: userUid.value || 0,
        username: groupStore.getUserInfo(userUid.value)?.name || '',
        avatar: groupStore.getUserInfo(userUid.value)?.avatar || '',
        locPlace: groupStore.getUserInfo(userUid.value)?.locPlace || ''
      },
      message: {
        id: messageId,
        roomId: globalStore.currentSessionRoomId,
        sendTime: currentTime,
        status: MessageStatusEnum.PENDING,
        type: this.msgType,
        body: messageBody,
        messageMarks: {}
      },
      sendTime: Date.now(),
      loading: false
    }
  }

  abstract buildMessageBody(msg: any, reply: any): any

  abstract getMsg(msgInputValue: string, replyValue: any, fileList?: File[]): any

  uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string }> {
    console.log('Base uploadFile method called with:', path, options)
    throw new AppException('해당 메시지 유형은 파일 업로드를 지원하지 않음')
  }

  doUpload(path: string, uploadUrl: string, options?: any): Promise<{ qiniuUrl?: string } | void> {
    console.log('Base doUpload method called with:', path, uploadUrl, options)
    throw new AppException('해당 메시지 유형은 파일 업로드를 지원하지 않음')
  }
}

/**
 * 텍스트 메시지 처리
 */
class TextMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.TEXT)
  }

  getMsg(msgInputValue: string, replyValue: any): any {
    // &nbsp;를 공백으로 처리
    let content = removeTag(msgInputValue)
    if (content && typeof content === 'string') {
      content = content.replace(/&nbsp;/g, ' ')
    }

    const msg = {
      type: this.msgType,
      content: content,
      reply: replyValue.content
        ? {
          content: replyValue.content,
          key: replyValue.key
        }
        : undefined
    }
    // 답장 내용 처리
    if (replyValue.content) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = DOMPurify.sanitize(msg.content)
      const replyDiv = tempDiv.querySelector('#replyDiv')
      if (replyDiv) {
        replyDiv.parentNode?.removeChild(replyDiv)
      }
      tempDiv.innerHTML = DOMPurify.sanitize(removeTag(tempDiv.innerHTML), { RETURN_DOM: false })

      // 모든 &nbsp;가 공백으로 교체되도록 보장
      msg.content = tempDiv.innerHTML
        .replace(/&nbsp;/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }
    // 메시지 길이 검증
    if (msg.content.length > 500) {
      throw new AppException('메시지 내용이 제한 500자를 초과했습니다. 분할하여 전송하세요')
    }
    return msg
  }

  buildMessageBody(msg: any, reply: any): any {
    return {
      content: msg.content,
      replyMsgId: msg.reply?.key || void 0,
      reply: reply.value.content
        ? {
          body: reply.value.content,
          id: reply.value.key,
          username: reply.value.accountName,
          type: msg.type
        }
        : void 0
    }
  }
}

/** 이미지 메시지 처리 */
class ImageMessageStrategyImpl extends AbstractMessageStrategy {
  // 최대 업로드 이미지 크기 2MB
  private readonly MAX_UPLOAD_SIZE = 2 * 1024 * 1024
  // 지원되는 이미지 유형
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  private _uploadHook: ReturnType<typeof useUpload> | null = null

  constructor() {
    super(MsgEnum.IMAGE)
  }

  private get uploadHook() {
    if (!this._uploadHook) {
      this._uploadHook = useUpload()
    }
    return this._uploadHook
  }

  /**
   * 이미지 파일이 업로드 조건을 충족하는지 검증
   * @param file 이미지 파일
   * @returns 검증된 이미지 파일
   */
  private async validateImage(file: File): Promise<File> {
    // 먼저 누락되거나 잘못된 MIME 유형 수정
    const fixedFile = fixFileMimeType(file)

    // 파일 유형 확인
    if (!this.ALLOWED_TYPES.includes(fixedFile.type)) {
      throw new AppException('JPEG, PNG, WebP 형식의 이미지만 지원합니다')
    }

    // 파일 크기 확인
    if (fixedFile.size > this.MAX_UPLOAD_SIZE) {
      throw new AppException('이미지 크기는 2MB를 초과할 수 없습니다', { showError: true })
    }

    return fixedFile
  }

  /**
   * 이미지 정보 가져오기 (너비, 높이, 미리보기 주소)
   * @param file 이미지 파일
   * @returns 이미지 정보
   */
  private async getImageInfo(file: File): Promise<{ width: number; height: number; previewUrl: string }> {
    try {
      const result = await getImageDimensions(file, { includePreviewUrl: true })
      return {
        width: result.width,
        height: result.height,
        previewUrl: result.previewUrl!
      }
    } catch (_error) {
      throw new AppException('이미지 로드 실패')
    }
  }

  /**
   * 유효한 이미지 URL인지 확인
   * @param url 이미지 주소
   * @returns 유효한 이미지 URL 여부
   */
  private isImageUrl(url: string): boolean {
    // 유효한 URL인지 확인
    try {
      new URL(url)
      // 일반적인 이미지 확장자로 끝나는지 확인
      return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
    } catch {
      return false
    }
  }

  /**
   * 이모티콘 이미지 정보 가져오기 (너비, 높이, 크기)
   * @param url 이미지 주소
   * @returns 이미지 정보
   */
  private async getRemoteImageInfo(url: string): Promise<{ width: number; height: number; size: number }> {
    try {
      const result = await getImageDimensions(url, { includeSize: true })
      return {
        width: result.width,
        height: result.height,
        size: result.size || 0
      }
    } catch (_error) {
      throw new AppException('이미지 로드 실패')
    }
  }

  /**
   * 이미지 메시지 처리
   * @param msgInputValue 이미지 메시지 내용
   * @param replyValue 답장 메시지
   * @param fileList 첨부 파일 목록
   * @returns 처리된 메시지
   */
  async getMsg(msgInputValue: string, replyValue: any, fileList?: File[]): Promise<any> {
    // fileList의 파일을 우선 처리
    if (fileList && fileList.length > 0) {
      const file = fileList[0]

      // 이미지 검증
      await this.validateImage(file)

      // 이미지 정보 (너비, 높이) 및 미리보기 URL 가져오기
      const { width, height, previewUrl } = await this.getImageInfo(file)

      // 파일을 캐시 디렉터리에 저장
      const tempPath = `temp-image-${Date.now()}-${file.name}`
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, uint8Array, { baseDir })

      return {
        type: this.msgType,
        path: tempPath, // 업로드용
        url: previewUrl, // 미리보기 표시용
        imageInfo: {
          width, // 원본 이미지 너비
          height, // 원본 이미지 높이
          size: file.size // 원본 파일 크기
        },
        reply: replyValue.content
          ? {
            content: replyValue.content,
            key: replyValue.key
          }
          : undefined
      }
    }

    // 이미지 URL인지 확인
    if (this.isImageUrl(msgInputValue)) {
      try {
        // 원격 이미지 정보 가져오기
        const { width, height, size } = await this.getRemoteImageInfo(msgInputValue)

        return {
          type: this.msgType,
          url: msgInputValue, // 원본 URL 직접 사용
          path: msgInputValue, // 일관성을 위해 path도 설정
          imageInfo: {
            width,
            height,
            size
          },
          reply: replyValue.content
            ? {
              content: replyValue.content,
              key: replyValue.key
            }
            : undefined
        }
      } catch (error) {
        console.error('이미지 URL 처리 실패:', error)
        if (error instanceof AppException) {
          throw error
        }
        throw new AppException('이미지 미리보기 실패')
      }
    }

    // 기존 로컬 이미지 처리 로직 (HTML에서 파싱)
    const doc = new DOMParser().parseFromString(msgInputValue, 'text/html')
    const imgElement = doc.getElementById('temp-image')
    if (!imgElement) {
      throw new AppException('파일이 존재하지 않습니다')
    }

    const path = imgElement.getAttribute('data-path')
    if (!path) {
      throw new AppException('파일이 존재하지 않습니다')
    }

    // 경로 표준화
    const normalizedPath = path.replace(/\\/g, '/')
    console.log('표준화된 경로:', normalizedPath)

    try {
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(normalizedPath, { baseDir })

      const fileName = path.split('/').pop() || 'image.png'
      const fileType = getMimeTypeFromExtension(fileName)

      // 파일 객체 생성
      const originalFile = new File([new Uint8Array(fileData)], fileName, {
        type: fileType
      })

      // 이미지 검증
      await this.validateImage(originalFile)

      // 이미지 정보 (너비, 높이) 및 미리보기 URL 가져오기
      const { width, height, previewUrl } = await this.getImageInfo(originalFile)

      return {
        type: this.msgType,
        path: normalizedPath, // 업로드용
        url: previewUrl, // 미리보기 표시용
        imageInfo: {
          width, // 원본 이미지 너비
          height, // 원본 이미지 높이
          size: originalFile.size // 원본 파일 크기
        },
        reply: replyValue.content
          ? {
            content: replyValue.content,
            key: replyValue.key
          }
          : undefined
      }
    } catch (error) {
      console.error('이미지 처리 실패:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('이미지 미리보기 실패')
    }
  }

  /**
   * 파일 업로드
   * @param path 파일 경로
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: any }> {
    // URL인 경우, 동일한 URL을 다운로드 링크로 직접 반환
    if (this.isImageUrl(path)) {
      return {
        uploadUrl: '', // 업로드 URL 불필요
        downloadUrl: path // 원본 URL 직접 사용
      }
    }

    // useUpload hook을 사용하여 업로드 및 다운로드 URL 가져오기
    console.log('이미지 업로드 시작:', path)
    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT
      }

      const result = await this.uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      return result
    } catch (error) {
      console.error('업로드 링크 가져오기 실패:', error)
      throw new AppException('업로드 링크 가져오기 실패, 다시 시도하세요')
    }
  }

  /**
   * 실제 파일 업로드 실행
   * @param path 파일 경로
   * @param uploadUrl 업로드 URL
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async doUpload(path: string, uploadUrl: string, options?: any): Promise<{ qiniuUrl?: string } | void> {
    // URL인 경우, 업로드 건너뛰기
    if (this.isImageUrl(path)) {
      return
    }

    try {
      // enableDeduplication 파일 중복 제거 활성화
      const result = await this.uploadHook.doUpload(path, uploadUrl, { ...options, enableDeduplication: true })
      // Qiniu 클라우드 업로드인 경우, qiniuUrl 반환
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (error) {
      console.error('파일 업로드 실패:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('파일 업로드 실패, 다시 시도하세요')
    }
  }

  buildMessageBody(msg: any, reply: any): any {
    return {
      url: msg.url,
      path: msg.path,
      width: msg.imageInfo.width,
      height: msg.imageInfo.height,
      size: msg.imageInfo.size,
      replyMsgId: msg.reply?.key || void 0,
      reply: reply.value.content
        ? {
          body: reply.value.content,
          id: reply.value.key,
          username: reply.value.accountName,
          type: msg.type
        }
        : void 0
    }
  }
}

/**
 * 위치 메시지 처리 전략
 */
class LocationMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.LOCATION)
  }

  /**
   * 위치 메시지 객체 생성
   * @param msgInputValue 위치 데이터 JSON 문자열
   * @param replyValue 답장 정보
   * @returns 위치 메시지 객체
   */
  getMsg(msgInputValue: string, replyValue: any): any {
    try {
      // 위치 데이터 파싱
      const locationData = JSON.parse(msgInputValue)

      // 필수 필드 검증
      if (!locationData.latitude || !locationData.longitude || !locationData.address) {
        throw new AppException('유효하지 않은 위치 데이터, 필수 필드 누락')
      }

      return {
        type: this.msgType,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        precision: locationData.precision || '고정밀도',
        timestamp: locationData.timestamp || Date.now(),
        reply: replyValue.content
          ? {
            content: replyValue.content,
            key: replyValue.key
          }
          : undefined
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppException('위치 데이터 형식 오류, 유효한 JSON이어야 합니다')
      }
      throw error
    }
  }

  /**
   * 메시지 본문 생성
   * @param msg 위치 메시지 객체
   * @param reply 답장 정보
   * @returns 메시지 본문
   */
  buildMessageBody(msg: any, reply: any): any {
    return {
      latitude: msg.latitude,
      longitude: msg.longitude,
      address: msg.address,
      precision: msg.precision,
      timestamp: msg.timestamp,
      replyMsgId: msg.reply?.key || undefined,
      reply: reply.value.content
        ? {
          body: reply.value.content,
          id: reply.value.key,
          username: reply.value.accountName,
          type: msg.type
        }
        : undefined
    }
  }

  /**
   * 완전한 위치 메시지 생성
   * @param messageId 메시지 ID
   * @param messageBody 메시지 본문
   * @param globalStore 전역 저장소
   * @param userUid 사용자 UID
   * @returns 완전한 메시지 객체
   */
  buildMessageType(messageId: string, messageBody: any, globalStore: any, userUid: Ref<any>): MessageType {
    const groupStore = useGroupStore()
    const userInfo = groupStore.getUserInfo(userUid.value)

    return {
      fromUser: {
        uid: userUid.value || 0,
        username: userInfo?.name || '',
        avatar: userInfo?.avatar || '',
        locPlace: userInfo?.locPlace || ''
      },
      message: {
        id: messageId,
        roomId: globalStore.currentSessionRoomId,
        sendTime: Date.now(),
        status: MessageStatusEnum.PENDING,
        type: this.msgType,
        body: messageBody,
        messageMarks: {}
      },
      sendTime: Date.now(),
      loading: false
    }
  }
}

/**
 * 파일 메시지 처리
 */
class FileMessageStrategyImpl extends AbstractMessageStrategy {
  // 최대 업로드 파일 크기 100MB
  private readonly MAX_UPLOAD_SIZE = 100 * 1024 * 1024
  private _uploadHook: ReturnType<typeof useUpload> | null = null

  constructor() {
    super(MsgEnum.FILE)
  }

  private get uploadHook() {
    if (!this._uploadHook) {
      this._uploadHook = useUpload()
    }
    return this._uploadHook
  }

  /**
   * 파일이 업로드 조건을 충족하는지 검증
   * @param file 파일 객체
   * @returns 검증된 파일
   */
  private async validateFile(file: File): Promise<File> {
    // 파일 크기 확인
    if (file.size > this.MAX_UPLOAD_SIZE) {
      throw new AppException('파일 크기는 100MB를 초과할 수 없습니다')
    }
    return file
  }

  /**
   * 파일 경로에서 파일 정보 읽기
   * @param path 파일 경로
   * @returns 파일 정보
   */
  private async getFileFromPath(path: string): Promise<File> {
    try {
      const normalizedPath = path.replace(/\\/g, '/')
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(normalizedPath, { baseDir })

      const fileName = normalizedPath.split('/').pop() || 'unknown'
      const fileType = getMimeTypeFromExtension(fileName)

      return new File([new Uint8Array(fileData)], fileName, { type: fileType })
    } catch (error) {
      console.error('파일 읽기 실패:', error)
      throw new AppException('파일을 읽을 수 없습니다. 파일이 존재하는지 확인하세요')
    }
  }

  async getMsg(msgInputValue: string, replyValue: any, fileList?: File[]): Promise<any> {
    console.log('파일 메시지 처리 시작:', msgInputValue, replyValue, fileList?.length ? '첨부 파일 있음' : '첨부 파일 없음')

    let file: File | null = null

    // fileList의 파일을 우선 사용
    if (fileList && fileList.length > 0) {
      file = fileList[0]
    } else {
      // msgInputValue에서 파일 경로 파싱 시도
      const path = parseInnerText(msgInputValue, 'temp-file')
      if (!path) {
        throw new AppException('전송할 파일을 선택하세요')
      }
      file = await this.getFileFromPath(path)
    }

    // 파일 검증
    const validatedFile = await this.validateFile(file)

    // 업로드용 임시 경로 생성
    const tempPath = `temp-file-${Date.now()}-${validatedFile.name}`

    // 파일을 임시 위치에 저장
    const arrayBuffer = await validatedFile.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    await writeFile(tempPath, uint8Array, { baseDir })

    return {
      type: this.msgType,
      path: tempPath,
      fileName: validatedFile.name,
      size: validatedFile.size,
      mimeType: validatedFile.type,
      reply: replyValue.content
        ? {
          content: replyValue.content,
          key: replyValue.key
        }
        : undefined
    }
  }

  buildMessageBody(msg: any, reply: any): any {
    return {
      url: '', // 업로드 후 설정됨
      path: msg.path,
      fileName: msg.fileName,
      size: msg.size,
      mimeType: msg.mimeType,
      replyMsgId: msg.reply?.key || undefined,
      reply: reply.value.content
        ? {
          body: reply.value.content,
          id: reply.value.key,
          username: reply.value.accountName,
          type: msg.type
        }
        : undefined
    }
  }

  /**
   * 파일 업로드
   * @param path 파일 경로
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: any }> {
    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT
      }

      const result = await this.uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      return result
    } catch (error) {
      console.error('파일 업로드 링크 가져오기 실패:', error)
      throw new AppException('파일 업로드 링크 가져오기 실패, 다시 시도하세요')
    }
  }

  /**
   * 실제 파일 업로드 실행
   * @param path 파일 경로
   * @param uploadUrl 업로드 URL
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async doUpload(path: string, uploadUrl: string, options?: any): Promise<{ qiniuUrl?: string } | void> {
    try {
      // enableDeduplication 파일 중복 제거 활성화
      const result = await this.uploadHook.doUpload(path, uploadUrl, { ...options, enableDeduplication: true })

      // Qiniu 클라우드 업로드인 경우, qiniuUrl 반환
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (error) {
      console.error('파일 업로드 실패:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('파일 업로드 실패, 다시 시도하세요')
    }
  }

  /**
   * 업로드 진행률 리스너 노출
   */
  getUploadProgress() {
    return {
      progress: this.uploadHook.progress,
      onChange: this.uploadHook.onChange
    }
  }
}

/**
 * 이모티콘 메시지 처리
 */
class EmojiMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.EMOJI)
  }

  // 유효한 이모티콘 URL인지 검증
  private isValidEmojiUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  getMsg(msgInputValue: string, replyValue: any): any {
    // URL인지 확인
    if (!this.isValidEmojiUrl(msgInputValue)) {
      throw new AppException('유효하지 않은 이모티콘 URL')
    }

    return {
      type: this.msgType,
      url: msgInputValue,
      path: msgInputValue,
      reply: replyValue.content
        ? {
          content: replyValue.content,
          key: replyValue.key
        }
        : undefined
    }
  }

  buildMessageBody(msg: any, reply: any): any {
    return {
      url: msg.url,
      replyMsgId: msg.reply?.key || void 0,
      reply: reply.value.content
        ? {
          body: reply.value.content,
          id: reply.value.key,
          username: reply.value.accountName,
          type: msg.type
        }
        : void 0
    }
  }

  // 이모티콘은 실제 업로드가 필요 없음, 원본 URL 직접 반환
  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string }> {
    console.log('이모티콘은 원본 URL 사용:', path, options)
    return {
      uploadUrl: '', // 업로드 URL 불필요
      downloadUrl: path // 원본 URL 직접 사용
    }
  }

  // 이모티콘은 실제 업로드가 필요 없음, 이 메서드는 빈 구현
  async doUpload(path?: string, uploadUrl?: string, options?: any): Promise<void> {
    console.log('이모티콘은 업로드가 필요 없음, 업로드 단계 건너뛰기', path, uploadUrl, options)
    return Promise.resolve()
  }
}

/**
 * 비디오 메시지 처리
 */
class VideoMessageStrategyImpl extends AbstractMessageStrategy {
  // 최대 업로드 파일 크기 50MB
  private readonly MAX_UPLOAD_SIZE = 50 * 1024 * 1024
  // 지원되는 비디오 유형
  private readonly ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv']
  private _uploadHook: ReturnType<typeof useUpload> | null = null

  constructor() {
    super(MsgEnum.VIDEO)
  }

  private get uploadHook() {
    if (!this._uploadHook) {
      this._uploadHook = useUpload()
    }
    return this._uploadHook
  }

  // 업로드 진행률 리스너 노출
  getUploadProgress() {
    return {
      progress: this.uploadHook.progress,
      onChange: this.uploadHook.onChange
    }
  }

  /**
   * 비디오 파일 검증
   * @param file 비디오 파일
   */
  private async validateVideo(file: File): Promise<File> {
    // 파일 유형 확인
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      throw new AppException('MP4/MOV/AVI/WMV 형식의 비디오만 지원합니다')
    }
    // 파일 크기 확인
    if (file.size > this.MAX_UPLOAD_SIZE) {
      throw new AppException('비디오 크기는 50MB를 초과할 수 없습니다')
    }
    return file
  }

  async getMsg(msgInputValue: string, replyValue: any, fileList?: File[]): Promise<any> {
    // 1. fileList의 파일을 우선 처리
    if (fileList && fileList.length > 0) {
      const file = fileList[0]

      // 비디오 파일 검증
      const validatedFile = await this.validateVideo(file)
      const thumbnail = await generateVideoThumbnail(validatedFile)

      // 파일을 캐시 디렉터리에 저장
      const tempPath = `temp-video-${Date.now()}-${file.name}`
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, uint8Array, { baseDir })

      return {
        type: this.msgType,
        path: tempPath,
        url: '', // 업로드 후 업데이트됨
        thumbnail: thumbnail || '',
        size: validatedFile.size,
        duration: 0, // 실제 프로젝트에서는 비디오 길이 파싱 가능
        reply: replyValue.content ? { content: replyValue.content, key: replyValue.key } : undefined
      }
    }

    // 2. 원격 비디오 URL 처리
    if (isVideoUrl(msgInputValue)) {
      return {
        type: this.msgType,
        url: msgInputValue,
        path: msgInputValue,
        reply: replyValue.content ? { content: replyValue.content, key: replyValue.key } : undefined
      }
    }
    const actualFile = await this.convertToVideoFile(msgInputValue)

    // 4. 비디오 파일 검증
    const validatedFile = await this.validateVideo(actualFile)
    const thumbnail = await generateVideoThumbnail(validatedFile)
    const path = parseInnerText(msgInputValue, 'temp-video')
    if (!path) {
      throw new AppException('파일이 존재하지 않습니다')
    }
    const normalizedPath = path.replace(/\\/g, '/')
    return {
      type: this.msgType,
      path: normalizedPath,
      url: '', // 업로드 후 업데이트됨
      thumbnail: thumbnail || '',
      size: validatedFile.size,
      duration: 0, // 실제 프로젝트에서는 비디오 길이 파싱 가능
      reply: replyValue.content ? { content: replyValue.content, key: replyValue.key } : undefined
    }
  }

  // 비디오 파일로 변환
  private async convertToVideoFile(videoFile: string | File): Promise<File> {
    // 1. 이미 File 객체인 경우 직접 반환
    if (videoFile instanceof File) {
      return videoFile
    }
    // 2. HTML 태그인지 확인 (유효하지 않은 경로)
    if (videoFile.startsWith('<') || videoFile.includes('src="blob:')) {
      // Blob URL 추출
      const blobUrlMatch = videoFile.match(/src="(blob:[^"]+)"/)
      if (!blobUrlMatch) {
        throw new AppException('비디오 Blob URL을 추출할 수 없습니다')
      }
      const blobUrl = blobUrlMatch[1]

      // 3. fetch를 사용하여 Blob 데이터 가져오기
      try {
        const response = await fetch(blobUrl)
        const blob = await response.blob()

        // 4. File 객체로 변환
        const fileName = `video_${Date.now()}.mp4` // 기본 파일명
        return new File([blob], fileName, { type: blob.type || 'video/mp4' })
      } catch (error) {
        console.error('Blob 변환 실패:', error)
        throw new AppException('Blob URL에서 비디오 파일을 생성할 수 없습니다')
      }
    }

    // 5. 유효한 문자열 경로 처리
    try {
      const normalizedPath = videoFile.replace(/\\/g, '/')
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(normalizedPath, {
        baseDir
      })

      const fileName = normalizedPath.split('/').pop() || 'video.mp4'
      return new File([new Uint8Array(fileData)], fileName, {
        type: this.getVideoType(fileName)
      })
    } catch (error) {
      console.error('비디오 파일 읽기 실패:', error)
      throw new AppException('비디오 파일을 읽을 수 없습니다. 파일 경로가 올바른지 확인하세요')
    }
  }

  // 파일명에 따라 비디오 유형 가져오기
  private getVideoType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'mp4':
        return 'video/mp4'
      case 'mov':
        return 'video/quicktime'
      case 'avi':
        return 'video/x-msvideo'
      case 'wmv':
        return 'video/x-ms-wmv'
      default:
        return 'video/mp4' // 기본 유형
    }
  }

  /**
   * 섬네일 파일 업로드
   * @param thumbnailFile 섬네일 파일
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async uploadThumbnail(
    thumbnailFile: File,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: any }> {
    try {
      // 업로드용 임시 파일 경로 생성
      const tempPath = `temp-thumbnail-${Date.now()}-${thumbnailFile.name}`

      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT,
        enableDeduplication: true // 중복 제거 활성화, 해시 값 계산 사용
      }

      // 기존 getUploadAndDownloadUrl 메서드 사용
      const result = await this.uploadHook.getUploadAndDownloadUrl(tempPath, uploadOptions)
      return result
    } catch (error) {
      console.error('섬네일 업로드 링크 가져오기 실패:', error)
      throw new AppException('섬네일 업로드 링크 가져오기 실패, 다시 시도하세요')
    }
  }

  /**
   * 섬네일 업로드 실행
   * @param thumbnailFile 섬네일 파일
   * @param uploadUrl 업로드 URL
   * @param options 업로드 옵션
   * @returns 업로드 결과
   */
  async doUploadThumbnail(
    thumbnailFile: File,
    uploadUrl: string,
    options?: any
  ): Promise<{ qiniuUrl?: string } | void> {
    try {
      // File 객체를 임시 파일에 쓴 후 기존 doUpload 메서드 사용
      const tempPath = `temp-thumbnail-${Date.now()}-${thumbnailFile.name}`

      // File 객체를 ArrayBuffer로 변환한 후 임시 파일에 쓰기
      const arrayBuffer = await thumbnailFile.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // 임시 파일에 쓰기
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, uint8Array, { baseDir })

      // enableDeduplication 파일 중복 제거 활성화, 해시 값 계산 사용
      const result = await this.uploadHook.doUpload(tempPath, uploadUrl, { ...options, enableDeduplication: true })

      // 임시 파일 정리
      try {
        await remove(tempPath, { baseDir })
      } catch (cleanupError) {
        console.warn('임시 파일 정리 실패:', cleanupError)
      }

      // Qiniu 클라우드 업로드인 경우, qiniuUrl 반환
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (error) {
      console.error('섬네일 업로드 실패:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('섬네일 업로드 실패, 다시 시도하세요')
    }
  }

  buildMessageBody(msg: any, reply: any): any {
    // 섬네일용 로컬 미리보기 URL 생성
    let thumbUrl = ''
    if (msg.thumbnail instanceof File) {
      thumbUrl = URL.createObjectURL(msg.thumbnail)
    }

    return {
      url: msg.url,
      path: msg.path,
      thumbnail: msg.thumbnail,
      thumbUrl: thumbUrl, // 로컬 미리보기 URL, 업로드 완료 후 서버 URL로 교체됨
      thumbSize: msg.thumbnail?.size || 0,
      thumbWidth: 300,
      thumbHeight: 150,
      size: msg.size,
      duration: msg.duration,
      replyMsgId: msg.reply?.key || void 0,
      reply: reply.value.content
        ? {
          body: reply.value.content,
          id: reply.value.key,
          username: reply.value.accountName,
          type: msg.type
        }
        : void 0
    }
  }

  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: any }> {
    // 원격 비디오는 URL 직접 반환
    if (isVideoUrl(path)) {
      return { uploadUrl: '', downloadUrl: path }
    }

    try {
      const result = await this.uploadHook.getUploadAndDownloadUrl(path, {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT
      })
      return result
    } catch (_error) {
      throw new AppException('비디오 업로드 링크 가져오기 실패')
    }
  }
  async doUpload(path: string, uploadUrl: string, options?: any): Promise<{ qiniuUrl?: string } | void> {
    if (isVideoUrl(path)) {
      throw new AppException('유효한 비디오 URL인지 확인')
    }

    try {
      // enableDeduplication 파일 중복 제거 활성화
      const result = await this.uploadHook.doUpload(path, uploadUrl, { ...options, enableDeduplication: true })
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (error) {
      console.error('파일 업로드 실패:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('파일 업로드 실패, 다시 시도하세요')
    }
  }
}

class UnsupportedMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.UNKNOWN)
  }

  getMsg(msgInputValue: string, replyValue: any, fileList?: File[]): any {
    replyValue
    msgInputValue
    fileList
    throw new AppException('해당 유형의 메시지는 아직 지원되지 않습니다')
  }

  buildMessageBody(msg: any, reply: any): any {
    msg
    reply
    throw new AppException('메서드가 아직 구현되지 않았습니다')
  }

  buildMessageType(messageId: string, messageBody: any, globalStore: any, userUid: Ref<any>): MessageType {
    messageId
    messageBody
    globalStore
    userUid
    throw new AppException('메서드가 아직 구현되지 않았습니다')
  }
}

class VoiceMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.VOICE)
  }

  getMsg(): any {
    const voiceMessageDivs = document.querySelectorAll('.voice-message-placeholder')
    const lastVoiceDiv = voiceMessageDivs[voiceMessageDivs.length - 1] as HTMLElement

    // 상대 경로를 Tauri 리소스 경로로 변환
    const localPath = lastVoiceDiv.dataset.url
    const assetUrl = `asset://${localPath}`

    return {
      type: MsgEnum.VOICE,
      url: assetUrl,
      size: parseInt(lastVoiceDiv.dataset.size || '0', 10),
      duration: parseFloat(lastVoiceDiv.dataset.duration || '0'),
      filename: lastVoiceDiv.dataset.filename || 'voice.mp3'
    }
  }

  buildMessageBody(msg: any): any {
    return {
      url: msg.url,
      size: msg.size,
      second: Math.round(msg.duration)
    }
  }

  buildMessageType(messageId: string, messageBody: any, globalStore: any, userUid: Ref<any>): MessageType {
    const baseMessage = super.buildMessageType(messageId, messageBody, globalStore, userUid)
    return {
      ...baseMessage,
      message: {
        ...baseMessage.message,
        type: MsgEnum.VOICE,
        body: {
          url: messageBody.url,
          size: messageBody.size,
          second: messageBody.second
        }
      }
    }
  }

  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: any }> {
    const uploadHook = useUpload()

    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT
      }

      const result = await uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      return result
    } catch (_error) {
      throw new AppException('음성 업로드 링크 가져오기 실패, 다시 시도하세요')
    }
  }

  async doUpload(path: string, uploadUrl: string, options?: any): Promise<{ qiniuUrl?: string } | void> {
    const uploadHook = useUpload()

    try {
      // enableDeduplication 파일 중복 제거 활성화
      const result = await uploadHook.doUpload(path, uploadUrl, { ...options, enableDeduplication: true })

      // Qiniu 클라우드 업로드인 경우, qiniuUrl 반환
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (_error) {
      throw new AppException('음성 파일 업로드 실패, 다시 시도하세요')
    }
  }
}

/**
 * 비디오 통화 시스템 메시지 처리
 * 메시지 구조
 */
class VideoCallMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.VIDEO_CALL)
  }

  getMsg(_msgInputValue: string, callInfo: any): any {
    return {
      type: this.msgType,
      duration: callInfo.duration, // 통화 시간 (초)
      reason: callInfo.reason, // 종료 이유: 타임아웃/종료/오류
      startTime: callInfo.startTime, // 통화 시작 시간 (타임스탬프)
      endTime: callInfo.endTime, // 통화 종료 시간 (타임스탬프)
      creator: callInfo.creator, // 발신자 UID
      isGroup: callInfo.isGroup // 그룹 통화 여부
    }
  }

  buildMessageBody(msg: any): any {
    return {
      duration: msg.duration,
      reason: msg.reason,
      startTime: msg.startTime,
      endTime: msg.endTime,
      creator: msg.creator,
      isGroup: msg.isGroup
    }
  }

  // 시스템 메시지는 업로드 작업 불필요
  async uploadFile() {
    return { uploadUrl: '', downloadUrl: '' }
  }

  async doUpload() { }
}

/**
 * 오디오 통화 시스템 메시지 처리
 * 메시지 구조
 */
class AudioCallMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.AUDIO_CALL)
  }

  /**
   * 오디오 통화 메시지 생성
   * @param callInfo 통화 메타데이터
   * @returns 오디오 통화 메시지 객체
   */
  getMsg(_msgInputValue: string, callInfo: any): any {
    return {
      type: this.msgType,
      duration: callInfo.duration, // 통화 시간 (초)
      reason: callInfo.reason, // 종료 이유: 타임아웃/종료/오류
      startTime: callInfo.startTime, // 통화 시작 시간 (밀리초 타임스탬프)
      endTime: callInfo.endTime, // 통화 종료 시간 (밀리초 타임스탬프)
      creator: callInfo.creator, // 발신자 UID
      isGroup: callInfo.isGroup // 그룹 통화 여부
    }
  }

  buildMessageBody(msg: any): any {
    return {
      duration: msg.duration, // 통화 시간 (초)
      reason: msg.reason, // 종료 이유
      startTime: msg.startTime, // 시작 타임스탬프
      endTime: msg.endTime, // 종료 타임스탬프
      creator: msg.creator, // 발신자 UID
      isGroup: msg.isGroup // 그룹 채팅 식별자
    }
  }

  /**
   * 빈 구현 (시스템 메시지는 파일 업로드 불필요)
   * @returns 빈 업로드 정보 반환
   */
  async uploadFile(): Promise<{ uploadUrl: string; downloadUrl: string }> {
    return {
      uploadUrl: '',
      downloadUrl: ''
    }
  }

  /**
   * 빈 구현 (시스템 메시지는 업로드 작업 불필요)
   */
  async doUpload(): Promise<void> {
    return Promise.resolve()
  }
}

const textMessageStrategy = new TextMessageStrategyImpl()
const fileMessageStrategy = new FileMessageStrategyImpl()
const imageMessageStrategy = new ImageMessageStrategyImpl()
const emojiMessageStrategy = new EmojiMessageStrategyImpl()
const unsupportedMessageStrategy = new UnsupportedMessageStrategyImpl()
const videoMessageStrategy = new VideoMessageStrategyImpl()
const voiceMessageStrategy = new VoiceMessageStrategyImpl()
const videoCallMessageStrategy = new VideoCallMessageStrategyImpl()
const audioCallMessageStrategy = new AudioCallMessageStrategyImpl()
const locationMessageStrategy = new LocationMessageStrategyImpl()

export const messageStrategyMap: Record<MsgEnum, MessageStrategy> = {
  [MsgEnum.FILE]: fileMessageStrategy,
  [MsgEnum.IMAGE]: imageMessageStrategy,
  [MsgEnum.TEXT]: textMessageStrategy,
  [MsgEnum.NOTICE]: unsupportedMessageStrategy,
  [MsgEnum.MERGE]: unsupportedMessageStrategy,
  [MsgEnum.EMOJI]: emojiMessageStrategy,
  [MsgEnum.UNKNOWN]: unsupportedMessageStrategy,
  [MsgEnum.RECALL]: unsupportedMessageStrategy,
  [MsgEnum.VOICE]: voiceMessageStrategy,
  [MsgEnum.VIDEO]: videoMessageStrategy,
  [MsgEnum.SYSTEM]: unsupportedMessageStrategy,
  [MsgEnum.MIXED]: unsupportedMessageStrategy,
  [MsgEnum.AIT]: unsupportedMessageStrategy,
  [MsgEnum.REPLY]: unsupportedMessageStrategy,
  [MsgEnum.AI]: unsupportedMessageStrategy,
  [MsgEnum.BOT]: unsupportedMessageStrategy,
  [MsgEnum.VIDEO_CALL]: videoCallMessageStrategy,
  [MsgEnum.AUDIO_CALL]: audioCallMessageStrategy,
  [MsgEnum.LOCATION]: locationMessageStrategy
}
