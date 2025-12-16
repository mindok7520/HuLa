// 효율적인 요청 큐 클래스
export class RequestQueue {
  private readonly maxSize: number = 100 // 큐 최대 용량
  private readonly maxConcurrent: number = 5 // 최대 동시 실행 수
  private queue: Array<{
    resolve: (token: string) => void
    timestamp: number
    priority?: number
  }> = []
  private processing: number = 0

  enqueue(resolve: (token: string) => void, priority: number = 0): void {
    if (this.queue.length >= this.maxSize) {
      console.warn('요청 큐가 가득 찼습니다. 새 요청을 버림니다')
      return
    }

    // 우선순위와 타임스탬프로 정렬하여 삽입
    const request = {
      resolve,
      timestamp: Date.now(),
      priority
    }

    const insertIndex = this.queue.findIndex((item) => item.priority! < priority)

    if (insertIndex === -1) {
      this.queue.push(request)
    } else {
      this.queue.splice(insertIndex, 0, request)
    }
  }

  async processQueue(token: string): Promise<void> {
    console.log(`큐에 있는 ${this.queue.length}개의 요청 처리 시작`)

    while (this.queue.length > 0 && this.processing < this.maxConcurrent) {
      this.processing++

      const request = this.queue.shift()
      if (request) {
        try {
          console.log(`요청 처리 - 남은 요청 ${this.queue.length}개`)
          await request.resolve(token)
        } catch (error) {
          console.error('요청 처리 실패:', error)
        } finally {
          this.processing--
        }
      }

      // 요청 간격 제어
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  clear(): void {
    this.queue = []
    this.processing = 0
  }

  get size(): number {
    return this.queue.length
  }
}
