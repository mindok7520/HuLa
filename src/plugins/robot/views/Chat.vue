<template>
  <!-- 메인 콘텐츠 -->
  <main class="chat-main-container">
    <div class="chat-content-area">
      <div
        data-tauri-drag-region
        class="chat-header flex truncate p-[8px_16px_10px_16px] justify-between items-center gap-50px">
        <n-flex :size="10" vertical class="truncate">
          <p
            v-if="!isEdit"
            @click="handleEdit"
            class="leading-6 text-(18px [--chat-text-color]) truncate font-500 hover:underline cursor-pointer">
            {{ currentChat.title || '새로운 대화' }}
          </p>
          <n-input
            v-else
            @blur="handleBlur"
            ref="inputInstRef"
            v-model:value="currentChat.title"
            clearable
            placeholder="제목 입력"
            type="text"
            size="small"
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            style="width: 200px; height: 28px"
            class="text-14px rounded-6px"></n-input>

          <!-- 현재 선택된 모델 표시 -->
          <n-flex align="center" :size="8" class="mt-4px">
            <div class="flex items-center gap-6px">
              <span class="text-(11px #909090)">현재 모델:</span>
              <n-tag
                v-if="selectedModel"
                size="small"
                :type="selectedModel.status === 0 ? 'success' : 'error'"
                class="cursor-pointer"
                @click="handleModelClick">
                {{ selectedModel.name }}
                <template #icon>
                  <Icon icon="mdi:robot" class="text-14px" />
                </template>
              </n-tag>
              <n-tag v-if="selectedModel && selectedModel.publicStatus === 0" size="small" type="info">공식 모델</n-tag>
              <n-tag v-else-if="selectedModel" size="small" type="warning">사용자 정의 모델</n-tag>
              <n-tag v-if="selectedModel && selectedModel.type === 1" size="small" type="info">텍스트</n-tag>
              <n-tag v-if="selectedModel && selectedModel.type === 2" size="small" type="success">이미지</n-tag>
              <n-tag v-if="selectedModel && selectedModel.type === 3" size="small" type="info">오디오</n-tag>
              <n-tag v-if="selectedModel && selectedModel.type === 4" size="small" type="warning">비디오</n-tag>
              <n-tag v-if="selectedModel && selectedModel.type === 7" size="small" type="warning">텍스트 투 비디오</n-tag>
              <n-tag v-if="selectedModel && selectedModel.type === 8" size="small" type="success">이미지 투 비디오</n-tag>
              <n-tag
                v-else-if="!selectedModel"
                size="small"
                type="warning"
                class="cursor-pointer"
                @click="handleModelClick">
                모델 선택 안 됨
                <template #icon>
                  <Icon icon="mdi:robot-off" class="text-14px" />
                </template>
              </n-tag>
            </div>
            <p class="text-(11px #707070)">총 {{ currentChat.messageCount }}개 대화</p>
          </n-flex>
        </n-flex>

        <n-flex class="min-w-fit">
          <!-- 새 대화 버튼 -->
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <div class="right-btn" @click="handleCreateNewChat">
                <svg><use href="#plus"></use></svg>
              </div>
            </template>
            <p>새 대화</p>
          </n-popover>

          <!-- 제목 편집 버튼 -->
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <div class="right-btn" @click="handleEdit">
                <svg><use href="#edit"></use></svg>
              </div>
            </template>
            <p>제목 편집</p>
          </n-popover>

          <!-- 대화 삭제 버튼 -->
          <n-popover
            v-model:show="showDeleteChatConfirm"
            trigger="click"
            placement="bottom"
            :show-arrow="true"
            style="padding: 16px; width: 280px">
            <template #trigger>
              <div class="right-btn right-btn-danger" title="대화 삭제">
                <svg><use href="#delete"></use></svg>
              </div>
            </template>
            <n-flex vertical :size="12">
              <p class="text-(14px [--chat-text-color]) font-500">현재 대화를 삭제하시겠습니까?</p>
              <p class="text-(12px #d5304f)">삭제 후에는 복구할 수 없습니다!</p>

              <!-- 메시지 동시 삭제 옵션 -->
              <n-checkbox v-model:checked="deleteWithMessages" size="small">
                <span class="text-(12px [--chat-text-color])">대화의 모든 메시지도 함께 삭제</span>
              </n-checkbox>

              <n-flex justify="end" :size="8">
                <n-button size="small" @click="showDeleteChatConfirm = false">취소</n-button>
                <n-button size="small" type="error" @click="handleDeleteChat">삭제</n-button>
              </n-flex>
            </n-flex>
          </n-popover>

          <!-- 공유 버튼 -->
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <div class="right-btn">
                <svg><use href="#Sharing"></use></svg>
              </div>
            </template>
            <p>공유</p>
          </n-popover>
        </n-flex>
      </div>
      <div class="h-1px bg-[--line-color]"></div>

      <!-- 채팅 메시지 상자 -->
      <div :class="{ 'shadow-inner': page.shadow }" class="chat-messages-container w-full box-border flex flex-col">
        <div
          ref="scrollContainerRef"
          class="chat-scrollbar flex-1 min-h-0 scrollbar-container"
          :class="{ 'hide-scrollbar': !showScrollbar }"
          @scroll="handleScroll"
          @mouseenter="showScrollbar = true"
          @mouseleave="showScrollbar = false">
          <div ref="messageContentRef" class="p-[16px_16px] box-border">
            <!-- 환영 메시지 -->
            <div class="flex gap-12px mb-12px">
              <n-avatar
                class="rounded-8px flex-shrink-0"
                :src="getModelAvatar(selectedModel)"
                :fallback-src="getDefaultAvatar()" />
              <n-flex vertical justify="space-between">
                <p class="text-(12px [--chat-text-color])">
                  {{ selectedModel ? selectedModel.name : 'GPT-4' }}
                  <n-tag
                    v-if="selectedModel"
                    :type="selectedModel.status === 0 ? 'success' : 'error'"
                    size="tiny"
                    class="ml-8px">
                    {{ selectedModel.status === 0 ? '사용 가능' : '사용 불가' }}
                  </n-tag>
                </p>
                <div class="bubble select-text text-14px">
                  <p>{{ `안녕하세요, 저는 ${selectedModel?.name || ''}입니다. 무엇을 도와드릴까요?` }}</p>
                </div>
              </n-flex>
            </div>

            <!-- 로딩 상태 -->
            <div v-if="loadingMessages" class="flex justify-center items-center py-20px text-(12px #909090)">
              <n-spin size="small" />
              <span class="ml-10px">메시지 로딩 중...</span>
            </div>

            <!-- 메시지 목록 -->
            <div
              v-for="(message, index) in messageList"
              class="message-row group flex flex-col mb-12px"
              :data-message-index="index"
              :data-message-id="message.id">
              <div class="flex items-start gap-10px" :class="message.type === 'user' ? 'flex-row-reverse' : ''">
                <n-avatar
                  v-if="message.type === 'user'"
                  :size="34"
                  class="select-none rounded-8px flex-shrink-0"
                  :class="message.type === 'user' ? 'ml-2px' : 'mr-2px'"
                  :src="userStore.userInfo?.avatar ? AvatarUtils.getAvatarUrl(userStore.userInfo.avatar) : ''"
                  :fallback-src="getDefaultAvatar()" />
                <n-avatar
                  v-else
                  :size="34"
                  class="select-none rounded-8px flex-shrink-0"
                  :class="message.type === 'assistant' ? 'mr-2px' : 'ml-2px'"
                  :src="getModelAvatar(selectedModel)"
                  :fallback-src="getDefaultAvatar()" />
                <n-flex
                  vertical
                  :size="6"
                  class="flex-1"
                  :class="message.type === 'user' ? 'items-end' : 'items-start'">
                  <n-flex
                    align="center"
                    :size="8"
                    class="select-none text-(12px #909090)"
                    :class="message.type === 'user' ? 'flex-row-reverse' : ''">
                    <p>
                      {{ message.type === 'user' ? '나' : selectedModel ? selectedModel.name : 'AI' }}
                    </p>
                    <n-popconfirm
                      v-if="message.id"
                      @positive-click="() => handleDeleteMessage(message.id!, index)"
                      positive-text="삭제"
                      negative-text="취소">
                      <template #trigger>
                        <div
                          class="delete-btn opacity-0 group-hover:opacity-100 cursor-pointer text-#909090 hover:text-#d5304f transition-all"
                          title="메시지 삭제">
                          <svg class="w-14px h-14px"><use href="#delete"></use></svg>
                        </div>
                      </template>
                      <p>이 메시지를 삭제하시겠습니까?</p>
                    </n-popconfirm>
                  </n-flex>
                  <div
                    :class="getMessageBubbleClass(message)"
                    class="select-text text-14px"
                    style="white-space: pre-wrap">
                    <template v-if="message.type === 'user'">
                      {{ message.content }}
                    </template>
                    <template v-else>
                      <!-- msgType: AiMsgContentTypeEnum 열거형 사용 -->
                      <template v-if="message.msgType === AiMsgContentTypeEnum.IMAGE">
                        <!-- 이미지 메시지 -->
                        <template v-if="isRenderableAiImage(message)">
                          <img
                            :src="message.content"
                            alt="생성된 이미지"
                            class="max-w-400px max-h-400px rounded-8px cursor-pointer"
                            @click="handleImagePreview(message.content)" />
                        </template>
                        <template v-else>
                          <div class="flex flex-col gap-8px">
                            <div class="bubble bubble-ai select-text text-14px" style="white-space: pre-wrap">
                              {{ getAiPlaceholderText(message) }}
                            </div>
                          </div>
                        </template>
                      </template>
                      <template v-else-if="message.msgType === AiMsgContentTypeEnum.VIDEO">
                        <!-- 비디오 메시지 -->
                        <template v-if="isLikelyMediaUrl(message.content)">
                          <video
                            :src="message.content"
                            controls
                            class="max-w-600px max-h-400px rounded-8px"
                            preload="metadata">
                            브라우저가 비디오 재생을 지원하지 않습니다
                          </video>
                        </template>
                        <template v-else>
                          <div class="bubble bubble-ai select-text text-14px" style="white-space: pre-wrap">
                            {{ getAiPlaceholderText(message) }}
                          </div>
                        </template>
                      </template>
                      <template v-else-if="message.msgType === AiMsgContentTypeEnum.AUDIO">
                        <!-- 오디오 메시지 -->
                        <template v-if="isLikelyMediaUrl(message.content)">
                          <audio :src="message.content" controls class="w-300px" preload="metadata">
                            브라우저가 오디오 재생을 지원하지 않습니다
                          </audio>
                        </template>
                        <template v-else>
                          <div class="bubble bubble-ai select-text text-14px" style="white-space: pre-wrap">
                            {{ getAiPlaceholderText(message) }}
                          </div>
                        </template>
                      </template>
                      <template v-else>
                        <!-- 텍스트 메시지 (msgType === 1 또는 설정되지 않음) -->
                        <div class="flex flex-col gap-8px">
                          <!-- 추론 과정 (있는 경우) -->
                          <div
                            v-if="message.reasoningContent"
                            class="reasoning-content p-12px rounded-8px bg-[#f5f5f5] dark:bg-[#2a2a2a] border-(1px solid #e0e0e0) dark:border-(1px solid #404040)">
                            <div class="flex items-center gap-6px mb-8px">
                              <Icon icon="mdi:brain" class="text-16px text-[#1890ff]" />
                              <span class="text-12px text-[#666] dark:text-[#aaa] font-500">생각 과정</span>
                            </div>
                            <div
                              class="code-block-wrapper"
                              :class="isDarkTheme ? 'code-block-dark' : 'code-block-light'">
                              <MarkdownRender
                                :content="message.reasoningContent"
                                :custom-id="markdownCustomId"
                                :is-dark="isDarkTheme"
                                :viewportPriority="false"
                                :themes="markdownThemes"
                                :code-block-props="markdownCodeBlockProps" />
                            </div>
                          </div>

                          <!-- 최종 답변 -->
                          <div class="code-block-wrapper" :class="isDarkTheme ? 'code-block-dark' : 'code-block-light'">
                            <MarkdownRender
                              :content="message.content"
                              :custom-id="markdownCustomId"
                              :is-dark="isDarkTheme"
                              :viewportPriority="false"
                              :themes="markdownThemes"
                              :code-block-props="markdownCodeBlockProps" />
                          </div>
                        </div>
                      </template>
                    </template>
                  </div>
                </n-flex>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="h-1px bg-[--line-color]"></div>
      <!-- 하단 입력 상자 및 기능 표시줄 -->
      <div class="chat-input-container min-h-180px">
        <n-flex vertical :size="6" class="p-[8px_16px] box-border">
          <n-flex align="center" :size="26" class="options">
            <!-- 역할 선택 -->
            <n-popover
              v-model:show="showRolePopover"
              trigger="click"
              placement="top-start"
              :show-arrow="false"
              style="padding: 0; width: 320px">
              <template #trigger>
                <div class="flex items-center gap-6px cursor-pointer" @click="showRolePopover = !showRolePopover">
                  <n-avatar
                    v-if="selectedRole"
                    :src="selectedRole.avatar"
                    :size="24"
                    round
                    :fallback-src="getDefaultAvatar()" />
                  <Icon v-else icon="mdi:account-circle" class="text-24px color-#909090" />
                  <span class="text-(12px [--chat-text-color])">
                    {{ selectedRole ? selectedRole.name : '역할 선택' }}
                  </span>
                  <Icon icon="mdi:chevron-down" class="text-16px color-#909090" />
                </div>
              </template>
              <div class="role-selector">
                <div class="role-header">
                  <span class="role-title">역할 선택</span>
                  <n-button size="small" @click="handleOpenRoleManagement">
                    <template #icon>
                      <Icon icon="mdi:cog" />
                    </template>
                    관리
                  </n-button>
                </div>

                <div class="role-list">
                  <div v-if="roleLoading" class="loading-container">
                    <n-spin size="small" />
                    <span class="loading-text">로딩 중...</span>
                  </div>

                  <div v-else-if="roleList.length === 0" class="empty-container">
                    <n-empty description="역할 데이터 없음" size="small">
                      <template #icon>
                        <Icon icon="mdi:account-off" class="text-24px color-#909090" />
                      </template>
                    </n-empty>
                  </div>

                  <div v-else class="roles-container">
                    <div
                      v-for="role in roleList"
                      :key="role.id"
                      class="role-item"
                      :class="{ active: selectedRole?.id === role.id }"
                      @click="handleSelectRole(role)">
                      <n-avatar :src="role.avatar" :size="32" round :fallback-src="getDefaultAvatar()" />
                      <n-flex vertical :size="2" class="flex-1 min-w-0">
                        <n-flex align="center" :size="8">
                          <span class="role-name">{{ role.name }}</span>
                          <n-tag v-if="role.status === 0" size="tiny" type="success">사용 가능</n-tag>
                        </n-flex>
                        <span class="role-desc">{{ role.description }}</span>
                      </n-flex>
                      <Icon
                        v-if="selectedRole?.id === role.id"
                        icon="mdi:check-circle"
                        class="text-18px color-[--primary-color]" />
                    </div>
                  </div>
                </div>
              </div>
            </n-popover>

            <!-- 모델 선택 -->
            <n-popover
              v-model:show="showModelPopover"
              trigger="click"
              placement="top-start"
              :show-arrow="false"
              style="padding: 0; width: 320px">
              <template #trigger>
                <div class="flex items-center gap-6px cursor-pointer" @click="handleModelClick">
                  <svg><use href="#model"></use></svg>
                  <span class="text-(12px [--chat-text-color])">
                    {{ selectedModel ? selectedModel.name : '모델 선택' }}
                  </span>
                </div>
              </template>
              <div class="model-selector">
                <div class="model-header">
                  <span class="model-title">모델 선택</span>
                  <n-flex :size="8">
                    <n-button size="small" @click="handleOpenModelManagement">
                      <template #icon>
                        <Icon icon="mdi:cog" />
                      </template>
                      관리
                    </n-button>
                    <n-input
                      v-model:value="modelSearch"
                      placeholder="모델 검색..."
                      clearable
                      size="small"
                      style="width: 140px">
                      <template #prefix>
                        <Icon icon="mdi:magnify" class="text-16px color-#909090" />
                      </template>
                    </n-input>
                  </n-flex>
                </div>

                <div class="model-list">
                  <div v-if="modelLoading" class="loading-container">
                    <n-spin size="small" />
                    <span class="loading-text">로딩 중...</span>
                  </div>

                  <div v-else-if="filteredModels.length === 0" class="empty-container">
                    <n-empty description="모델 데이터 없음" size="small">
                      <template #icon>
                        <Icon icon="mdi:package-variant-closed" class="text-24px color-#909090" />
                      </template>
                    </n-empty>
                  </div>

                  <div v-else class="models-container">
                    <div v-if="officialModels.length > 0">
                      <div class="model-section-title">공식 모델</div>
                      <div
                        v-for="model in officialModels"
                        :key="model.id"
                        :class="['model-item', { 'model-item-active': selectedModel?.id === model.id }]"
                        @click="selectModel(model)">
                        <n-avatar
                          round
                          :size="40"
                          :src="getModelAvatar(model)"
                          :fallback-src="getDefaultAvatar()"
                          class="mr-12px flex-shrink-0" />
                        <div class="model-info">
                          <div class="model-name">
                            {{ model.name }}
                            <n-tag v-if="model.type === 1" size="tiny" type="info" class="ml-4px">文字</n-tag>
                            <n-tag v-else-if="model.type === 2" size="tiny" type="success" class="ml-4px">图片</n-tag>
                            <n-tag v-else-if="model.type === 3" size="tiny" type="primary" class="ml-4px">音频</n-tag>
                            <n-tag v-else-if="model.type === 4" size="tiny" type="warning" class="ml-4px">视频</n-tag>
                            <n-tag v-else-if="model.type === 5" size="tiny" type="default" class="ml-4px">向量</n-tag>
                            <n-tag v-else-if="model.type === 6" size="tiny" type="default" class="ml-4px">重排序</n-tag>
                            <n-tag v-else-if="model.type === 7" size="tiny" type="warning" class="ml-4px">
                              文生视频
                            </n-tag>
                            <n-tag v-else-if="model.type === 8" size="tiny" type="error" class="ml-4px">图生视频</n-tag>
                          </div>
                          <div class="model-description">{{ model.description || '설명 없음' }}</div>
                          <div class="model-meta">
                            <span class="model-provider">{{ model.platform }}</span>
                            <span class="model-version">v{{ model.model }}</span>
                          </div>
                        </div>
                        <div class="model-status">
                          <n-tag v-if="model.status === 0" type="success" size="small">可用</n-tag>
                          <n-tag v-else type="error" size="small">不可用</n-tag>
                        </div>
                      </div>
                    </div>

                    <div v-if="officialModels.length > 0 && userModels.length > 0" class="model-divider"></div>

                    <div v-if="userModels.length > 0">
                      <div class="model-section-title">사용자 정의 모델</div>
                      <div
                        v-for="model in userModels"
                        :key="model.id"
                        :class="['model-item', { 'model-item-active': selectedModel?.id === model.id }]"
                        @click="selectModel(model)">
                        <n-avatar
                          round
                          :size="40"
                          :src="getModelAvatar(model)"
                          :fallback-src="getDefaultAvatar()"
                          class="mr-12px flex-shrink-0" />
                        <div class="model-info">
                          <div class="model-name">
                            {{ model.name }}
                            <n-tag v-if="model.type === 1" size="tiny" type="info" class="ml-4px">文字</n-tag>
                            <n-tag v-else-if="model.type === 2" size="tiny" type="success" class="ml-4px">图片</n-tag>
                            <n-tag v-else-if="model.type === 3" size="tiny" type="primary" class="ml-4px">音频</n-tag>
                            <n-tag v-else-if="model.type === 4" size="tiny" type="warning" class="ml-4px">视频</n-tag>
                            <n-tag v-else-if="model.type === 5" size="tiny" type="default" class="ml-4px">向量</n-tag>
                            <n-tag v-else-if="model.type === 6" size="tiny" type="default" class="ml-4px">重排序</n-tag>
                            <n-tag v-else-if="model.type === 7" size="tiny" type="warning" class="ml-4px">
                              文生视频
                            </n-tag>
                            <n-tag v-else-if="model.type === 8" size="tiny" type="error" class="ml-4px">图生视频</n-tag>
                          </div>
                          <div class="model-description">{{ model.description || '설명 없음' }}</div>
                          <div class="model-meta">
                            <span class="model-provider">{{ model.platform }}</span>
                            <span class="model-version">v{{ model.model }}</span>
                          </div>
                        </div>
                        <div class="model-status">
                          <n-tag v-if="model.status === 0" type="success" size="small">可用</n-tag>
                          <n-tag v-else type="error" size="small">不可用</n-tag>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="modelPagination.total > modelPagination.pageSize" class="model-pagination">
                  <n-pagination
                    v-model:page="modelPagination.pageNo"
                    :page-size="modelPagination.pageSize"
                    :page-count="Math.ceil(modelPagination.total / modelPagination.pageSize)"
                    size="small"
                    @update:page="handleModelPageChange" />
                </div>
              </div>
            </n-popover>

            <!-- 이미지/비디오 크기 선택 -->
            <n-select
              v-if="selectedModel && selectedModel.type === 2"
              v-model:value="imageParams.size"
              :options="imageSizeOptions"
              size="small"
              placeholder="이미지 크기"
              style="width: 150px" />
            <n-select
              v-if="selectedModel && (selectedModel.type === 4 || selectedModel.type === 7 || selectedModel.type === 8)"
              v-model:value="videoParams.size"
              :options="videoSizeOptions"
              size="small"
              placeholder="비디오 크기"
              style="width: 150px" />
            <n-select
              v-if="selectedModel && (selectedModel.type === 4 || selectedModel.type === 7 || selectedModel.type === 8)"
              v-model:value="videoParams.duration"
              :options="videoDurationOptions"
              size="small"
              placeholder="비디오 길이"
              style="width: 100px" />

            <!-- 오디오 음성 선택 -->
            <n-select
              v-if="selectedModel && selectedModel.type === 3"
              v-model:value="audioParams.voice"
              :options="audioVoiceOptions"
              size="small"
              placeholder="음성 선택"
              style="width: 150px" />

            <!-- 오디오 속도 선택 -->
            <n-select
              v-if="selectedModel && selectedModel.type === 3"
              v-model:value="audioParams.speed"
              :options="audioSpeedOptions"
              size="small"
              placeholder="재생 속도"
              style="width: 120px" />

            <!-- 비디오 참조 이미지 업로드 (type=8 이미지 투 비디오 모델만 표시) -->
            <n-popover
              v-if="selectedModel && selectedModel.type === 8"
              trigger="hover"
              :show-arrow="false"
              placement="top">
              <template #trigger>
                <div style="position: relative; display: inline-block">
                  <n-upload
                    ref="videoImageFileRef"
                    :show-file-list="false"
                    :custom-request="handleVideoImageUpload"
                    :disabled="isUploadingVideoImage"
                    accept="image/jpeg,image/jpg,image/png,image/webp">
                    <n-button
                      size="small"
                      :type="videoImagePreview ? 'success' : 'default'"
                      :loading="isUploadingVideoImage"
                      :disabled="isUploadingVideoImage"
                      style="margin-left: 8px">
                      <template #icon v-if="!isUploadingVideoImage">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </template>
                      {{ isUploadingVideoImage ? '업로드 중...' : videoImagePreview ? '업로드됨' : '참조 이미지' }}
                    </n-button>
                  </n-upload>
                  <!-- 지우기 버튼 -->
                  <n-button
                    v-if="videoImagePreview"
                    size="tiny"
                    circle
                    type="error"
                    @click="clearVideoImage"
                    style="
                      position: absolute;
                      top: -6px;
                      right: -6px;
                      width: 18px;
                      height: 18px;
                      padding: 0;
                      min-width: 18px;
                    ">
                    <template #icon>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </template>
                  </n-button>
                </div>
              </template>
              <div style="max-width: 300px">
                <div v-if="videoImagePreview" style="margin-bottom: 8px">
                  <img :src="videoImagePreview" style="max-width: 100%; border-radius: 4px" />
                </div>
                <div style="font-size: 12px; color: #666">
                  <div v-if="isUploadingVideoImage" style="color: #18a058">⏳ Qiniu Cloud에 업로드 중...</div>
                  <div v-else>
                    {{ videoImagePreview ? 'Qiniu Cloud에 업로드되었습니다. 버튼을 클릭하여 다시 업로드하세요' : '이미지 투 비디오용 참조 이미지 업로드' }}
                    <br />
                    지원 형식: JPG, PNG, WEBP
                    <br />
                    최대 크기: 10MB
                    <br />
                    <span style="color: #999; font-size: 11px">이미지는 Qiniu Cloud 스토리지에 업로드됩니다</span>
                  </div>
                </div>
              </div>
            </n-popover>

            <!-- 기타 기능 아이콘 -->
            <n-popover
              v-for="(item, index) in otherFeatures"
              :key="index"
              trigger="hover"
              :show-arrow="false"
              placement="top">
              <template #trigger>
                <svg><use :href="`#${item.icon}`"></use></svg>
              </template>
              <p>{{ item.label }}</p>
            </n-popover>

            <div class="flex items-center gap-6px bg-[--chat-hover-color] rounded-50px w-fit h-fit p-[4px_6px]">
              <svg style="width: 22px; height: 22px; outline: none; cursor: pointer"><use href="#explosion"></use></svg>
              <n-popover trigger="hover" :show-arrow="false" placement="top">
                <template #trigger>
                  <p class="text-(12px #707070) cursor-default select-none pr-6px">
                    Token 사용량 {{ serverTokenUsage ?? conversationTokens }} / {{ selectedModel?.maxTokens || 0 }}
                  </p>
                </template>
                <span>대화 누적 Token으로 제한되며, 상한에 도달하면 생성이 거부됩니다</span>
              </n-popover>
              <n-popover trigger="hover" :show-arrow="false" placement="top">
                <template #trigger>
                  <n-switch v-model:value="reasoningEnabled" size="small">
                    <template #checked>깊은 생각</template>
                    <template #unchecked>끄기</template>
                  </n-switch>
                </template>
                <span v-if="supportsReasoning">켜면 생각 과정을 우선적으로 표시합니다</span>
                <span v-else>이 모델은 깊은 생각을 지원하지 않습니다</span>
              </n-popover>
            </div>
          </n-flex>

          <div style="height: 100px" class="flex flex-col items-end gap-6px">
            <MsgInput ref="MsgInputRef" :isAIMode="!!selectedModel" @send-ai="handleSendAI" />
          </div>
        </n-flex>
      </div>
    </div>
  </main>

  <!-- 기록 팝업 -->
  <n-modal
    v-model:show="showHistoryModal"
    preset="card"
    title="생성 기록"
    style="width: 90%; max-width: 1200px"
    :bordered="false">
    <!-- 유형 전환 버튼 -->
    <template #header-extra>
      <n-button-group size="small">
        <n-button :type="historyType === 'image' ? 'primary' : 'default'" @click="switchHistoryType('image')">
          <template #icon>
            <Icon icon="mdi:image" />
          </template>
          이미지
        </n-button>
        <n-button :type="historyType === 'audio' ? 'primary' : 'default'" @click="switchHistoryType('audio')">
          <template #icon>
            <Icon icon="mdi:music" />
          </template>
          오디오
        </n-button>
        <n-button :type="historyType === 'video' ? 'primary' : 'default'" @click="switchHistoryType('video')">
          <template #icon>
            <Icon icon="mdi:video" />
          </template>
          비디오
        </n-button>
      </n-button-group>
    </template>

    <n-spin :show="historyLoading">
      <div v-if="historyList.length > 0" class="history-grid">
        <div v-for="item in historyList" :key="item.id" class="history-item">
          <div class="history-wrapper">
            <!-- 이미지 미리보기 -->
            <div v-if="historyType === 'image'" class="media-preview">
              <img
                v-if="item.status === 20 && item.picUrl"
                :src="item.picUrl"
                :alt="item.prompt"
                class="preview-img"
                @click="handlePreviewImage(item)" />
              <div v-else-if="item.status === 10" class="preview-placeholder">
                <n-spin size="large" />
                <p class="text-12px text-#909090 mt-8px">생성 중...</p>
              </div>
              <div v-else class="preview-placeholder error">
                <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                <p class="text-12px text-#d5304f mt-8px">생성 실패</p>
              </div>
            </div>

            <!-- 오디오 미리보기 -->
            <div v-else-if="historyType === 'audio'" class="media-preview">
              <div v-if="item.status === 20 && item.audioUrl" class="audio-preview">
                <Icon icon="mdi:music-circle" class="text-64px text-#1890ff" />
                <p class="text-12px text-#1890ff mt-8px">클릭하여 재생</p>
              </div>
              <div v-else-if="item.status === 10" class="preview-placeholder">
                <n-spin size="large" />
                <p class="text-12px text-#909090 mt-8px">생성 중...</p>
              </div>
              <div v-else class="preview-placeholder error">
                <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                <p class="text-12px text-#d5304f mt-8px">생성 실패</p>
              </div>
            </div>

            <!-- 비디오 미리보기 -->
            <div v-else class="media-preview">
              <div v-if="item.status === 20 && item.videoUrl" class="video-preview" @click="handlePreviewVideo(item)">
                <Icon icon="mdi:play-circle" class="text-64px text-white" />
                <p class="text-12px text-white mt-8px">클릭하여 재생</p>
              </div>
              <div v-else-if="item.status === 10" class="preview-placeholder">
                <n-spin size="large" />
                <p class="text-12px text-#909090 mt-8px">생성 중...</p>
              </div>
              <div v-else class="preview-placeholder error">
                <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                <p class="text-12px text-#d5304f mt-8px">생성 실패</p>
              </div>
            </div>

            <!-- 정보 -->
            <div class="history-info">
              <p class="prompt" :title="item.prompt">{{ item.prompt }}</p>
              <p class="text-11px text-#909090 mt-4px">{{ item.width }} × {{ item.height }}</p>
            </div>
          </div>
        </div>
      </div>
      <n-empty v-else description="생성 기록 없음" class="py-40px" />
    </n-spin>

    <!-- 페이지네이션 -->
    <n-flex v-if="historyPagination.total > historyPagination.pageSize" justify="center" class="mt-16px">
      <n-pagination
        v-model:page="historyPagination.pageNo"
        :page-size="historyPagination.pageSize"
        :page-count="Math.ceil(historyPagination.total / historyPagination.pageSize)"
        @update:page="handleHistoryPageChange" />
    </n-flex>
  </n-modal>

  <!-- 이미지 미리보기 팝업 -->
  <n-modal v-model:show="showImagePreview" preset="card" title="이미지 미리보기" style="width: 90%; max-width: 1000px">
    <div v-if="previewItem" class="preview-container">
      <img :src="previewItem.picUrl" :alt="previewItem.prompt" class="preview-image" />
      <div class="preview-info mt-16px">
        <p class="text-14px">
          <strong>프롬프트:</strong>
          {{ previewItem.prompt }}
        </p>
        <p class="text-12px text-#909090 mt-8px">
          <strong>크기:</strong>
          {{ previewItem.width }} × {{ previewItem.height }}
        </p>
      </div>
    </div>
  </n-modal>

  <!-- 비디오 미리보기 팝업 -->
  <n-modal v-model:show="showVideoPreview" preset="card" title="비디오 미리보기" style="width: 90%; max-width: 1000px">
    <div v-if="previewItem" class="preview-container">
      <video :src="previewItem.videoUrl" controls class="preview-video" />
      <div class="preview-info mt-16px">
        <p class="text-14px">
          <strong>프롬프트:</strong>
          {{ previewItem.prompt }}
        </p>
        <p class="text-12px text-#909090 mt-8px">
          <strong>크기:</strong>
          {{ previewItem.width }} × {{ previewItem.height }}
        </p>
      </div>
    </div>
  </n-modal>
</template>
<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { type InputInst, UploadFileInfo } from 'naive-ui'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import MsgInput from '@/components/rightBox/MsgInput.vue'
import { useMitt } from '@/hooks/useMitt.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user.ts'
import MarkdownRender from 'markstream-vue'
import { ROBOT_MARKDOWN_CUSTOM_ID } from '@/plugins/robot/utils/markdown'
import { useResizeObserver } from '@vueuse/core'
import { ThemeEnum, AiMsgContentTypeEnum } from '@/enums'
import 'markstream-vue/index.css'
import {
  modelPage,
  conversationCreateMy,
  conversationUpdateMy,
  conversationDeleteMy,
  messageListByConversationId,
  messageDelete,
  messageDeleteByConversationId,
  chatRolePage,
  imageDraw,
  videoGenerate,
  audioGenerate,
  imageMyPage,
  videoMyPage,
  audioMyPage,
  imageMyListByIds,
  videoMyListByIds,
  audioMyListByIds,
  audioGetVoices
} from '@/utils/ImRequestUtils'
import { messageSendStream } from '@/utils/ImRequestUtils'
import { conversationGetMy } from '@/utils/ImRequestUtils'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { persistAiImageFile, resolveAiImagePath } from '@/utils/PathUtil'
import { md5FromString } from '@/utils/Md5Util'
import router from '@/router'
import { storeToRefs } from 'pinia'
import { useUpload, UploadProviderEnum } from '@/hooks/useUpload'
import { UploadSceneEnum } from '@/enums'

const settingStore = useSettingStore()
const userStore = useUserStore()
const { page, themes } = storeToRefs(settingStore)
const SHIKI_LIGHT_THEME = 'vitesse-light'
const SHIKI_DARK_THEME = 'vitesse-dark'
const markdownCustomId = ROBOT_MARKDOWN_CUSTOM_ID
const markdownThemes = [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME] as const as any

const MsgInputRef = ref()
/** 편집 모드 여부 */
const isEdit = ref(false)
const inputInstRef = ref<InputInst | null>(null)
/** 원본 제목 */
const originalTitle = ref('')
/** 현재 채팅의 제목, id 및 메타 정보 */
const currentChat = ref({
  id: '0',
  title: '',
  messageCount: 0,
  createTime: 0
})

// 어두운 테마인지 계산, null 값 및 초기화되지 않은 경우 처리
const isDarkTheme = computed(() => {
  const content = themes.value.content
  // content가 비어 있으면 document.documentElement.dataset.theme에서 가져오기 시도
  if (!content) {
    const datasetTheme = document.documentElement.dataset.theme
    return datasetTheme === ThemeEnum.DARK
  }
  return content === ThemeEnum.DARK
})

const markdownCodeBlockProps = computed(() => ({
  isDark: isDarkTheme.value,
  darkTheme: SHIKI_DARK_THEME,
  lightTheme: SHIKI_LIGHT_THEME,
  themes: [SHIKI_DARK_THEME, SHIKI_LIGHT_THEME] as const,
  showHeader: true
}))

// isDarkTheme 변경을 동시에 감시하여 테마 전환 시 컴포넌트가 올바르게 업데이트되도록 함
watch(
  isDarkTheme,
  (newVal) => {
    // 테마 전환 시 CSS 클래스가 올바르게 적용되도록 함
    nextTick(() => {
      // 모든 code-block-wrapper 요소를 찾아 올바른 클래스가 있는지 확인
      const wrappers = document.querySelectorAll('.code-block-wrapper')
      wrappers.forEach((wrapper) => {
        wrapper.classList.remove('code-block-dark', 'code-block-light')
        wrapper.classList.add(newVal ? 'code-block-dark' : 'code-block-light')
      })
    })
  },
  { immediate: true }
)

// 메시지 목록
interface Message {
  type: 'user' | 'assistant'
  content: string
  reasoningContent?: string // 추론 생각 내용 (DeepSeek R1과 같은 생각 모델 지원용)
  streaming?: boolean
  createTime?: number
  id?: string // 메시지 ID, 삭제용
  replyId?: string | null // 답장 메시지 ID
  model?: string // 사용된 모델
  isGenerating?: boolean // 생성 중인지 여부 (이미지/비디오/오디오 생성용)
  msgType?: AiMsgContentTypeEnum // 메시지 콘텐츠 유형 열거형
  imageUrl?: string // 이미지 URL
  imageInfo?: {
    // 이미지 정보
    prompt: string
    width: number
    height: number
    model: string
  }
  videoUrl?: string // 비디오 URL
  videoInfo?: {
    // 비디오 정보
    prompt: string
    width: number
    height: number
    model: string
  }
  audioUrl?: string // 오디오 URL
  audioInfo?: {
    // 오디오 정보
    prompt: string
    voice: string
    model: string
    speed: number
  }
}

const messageList = ref<Message[]>([])
const MAX_MESSAGE_COUNT = 40 // 메모리 누수 방지를 위해 최대 40개 메시지 유지
const scrollContainerRef = ref<HTMLElement | null>(null)
const messageContentRef = ref<HTMLElement | null>(null)
const shouldAutoStickBottom = ref(true)
const showScrollbar = ref(true)
const loadingMessages = ref(false) // 메시지 로딩 상태
const estimateTokens = (text: string) => {
  if (!text) return 0
  const chars = Array.from(text)
  const asciiChars = chars.filter((ch) => (ch.codePointAt(0) as number) <= 0x7f)
  const ascii = asciiChars.join('')
  const nonAsciiCount = chars.length - asciiChars.length
  const asciiWords = ascii.trim().split(/\s+/).filter(Boolean)
  const asciiTokens = asciiWords.reduce((acc, w) => acc + Math.ceil(w.length / 4), 0)
  const nonAsciiTokens = nonAsciiCount
  return asciiTokens + nonAsciiTokens
}
const estimateMessageTokens = (m: Message) => {
  const base = estimateTokens(m.content || '')
  const reasoning = estimateTokens(m.reasoningContent || '')
  return base + reasoning
}
const conversationTokens = computed(() => {
  return messageList.value.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
})
const serverTokenUsage = ref<number | null>(null)

const aiMediaDownloadTasks = new Map<string, Promise<ArrayBuffer>>()
const MAX_MEDIA_CACHE_SIZE = 10 // 최대 10개의 미디어 다운로드 작업 캐시

// 다양한 바이너리 반환 형식을 ArrayBuffer로 통일하여 plugin-http/브라우저 fetch 등의 시나리오 호환
const convertHttpDataToArrayBuffer = (rawData: unknown): ArrayBuffer => {
  if (rawData === null || rawData === undefined) {
    throw new Error('이미지 데이터가 비어 있습니다')
  }

  if (rawData instanceof ArrayBuffer) {
    return rawData
  }

  if (rawData instanceof Uint8Array) {
    return rawData.slice().buffer
  }

  if (ArrayBuffer.isView(rawData)) {
    // 복사본 생성, SharedArrayBuffer 유형 비호환성 방지
    const view = rawData as ArrayBufferView
    const copy = new Uint8Array(view.byteLength)
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
    return copy.buffer
  }

  if (Array.isArray(rawData)) {
    return Uint8Array.from(rawData).buffer
  }

  if (typeof rawData === 'object') {
    const maybeData = (rawData as { data?: number[] }).data
    if (Array.isArray(maybeData)) {
      return Uint8Array.from(maybeData).buffer
    }
  }

  if (typeof rawData === 'string') {
    const binaryString = atob(rawData)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  throw new Error('이미지 데이터를 파싱할 수 없습니다')
}

// AI 미디어 바이너리 데이터 다운로드: 동일한 URL은 Promise 재사용, 중복 다운로드 방지; plugin-http의 다양한 반환 형태 처리
const requestAiMediaBuffer = (url: string) => {
  if (!url) {
    return Promise.reject(new Error('이미지 주소가 유효하지 않습니다'))
  }

  const existingTask = aiMediaDownloadTasks.get(url)
  if (existingTask) {
    return existingTask
  }

  // 캐시 정리, 메모리 누수 방지
  if (aiMediaDownloadTasks.size >= MAX_MEDIA_CACHE_SIZE) {
    const firstKey = aiMediaDownloadTasks.keys().next().value
    if (firstKey) {
      aiMediaDownloadTasks.delete(firstKey)
    }
  }

  const downloadTask = (async () => {
    const response = await nativeFetch(url, {
      method: 'GET'
    })

    const anyResponse = response as any
    const status = typeof anyResponse.status === 'number' ? anyResponse.status : 200
    const statusText = typeof anyResponse.statusText === 'string' ? anyResponse.statusText : ''
    const ok = 'ok' in anyResponse ? Boolean(anyResponse.ok) : status >= 200 && status < 400

    if (!ok) {
      throw new Error(`다운로드 실패: ${status} ${statusText}`.trim())
    }

    // 표준 arrayBuffer 우선 사용
    if (typeof anyResponse.arrayBuffer === 'function') {
      const buffer = await anyResponse.arrayBuffer()
      if (buffer instanceof ArrayBuffer) {
        return buffer
      }
    }

    // plugin-http에서 추가로 제공하는 bytes 메서드
    if (typeof anyResponse.bytes === 'function') {
      const bytes = await anyResponse.bytes()
      return convertHttpDataToArrayBuffer(bytes)
    }

    // 마지막으로 data 필드로 대체
    if ('data' in anyResponse) {
      return convertHttpDataToArrayBuffer(anyResponse.data)
    }

    throw new Error('이미지 데이터를 파싱할 수 없습니다')
  })().finally(() => {
    aiMediaDownloadTasks.delete(url)
  })

  aiMediaDownloadTasks.set(url, downloadTask)
  return downloadTask
}

// 미디어 확장자 파싱, 기본값은 지정된 접미사로 대체
const getAiMediaExtension = (url: string, fallback = 'png') => {
  const cleanUrl = url.split(/[?#]/)[0] || ''
  const ext = cleanUrl.split('.').pop() || ''
  if (!ext || ext.length > 5 || ext.includes('/')) return fallback
  return ext
}

const buildAiMediaFileName = async (url: string, fallbackExt: string, prefix: string) => {
  const ext = getAiMediaExtension(url, fallbackExt)
  try {
    const hash = await md5FromString(url)
    return `${prefix}-${hash}.${ext}`
  } catch (error) {
    console.error('AI 미디어 파일 이름 생성 실패:', error)
    return `${prefix}-${Date.now()}.${ext}`
  }
}

const ensureLocalAiImage = async (remoteUrl: string, messageIndex: number) => {
  if (!remoteUrl || !userStore.userInfo?.uid || !currentChat.value.id) return
  const targetMessage = messageList.value[messageIndex]
  if (!targetMessage || targetMessage.type !== 'assistant') return
  const isSameImage = targetMessage.imageUrl
    ? targetMessage.imageUrl === remoteUrl
    : targetMessage.content === remoteUrl
  if (!isSameImage) return
  try {
    const fileName = await buildAiMediaFileName(remoteUrl, 'png', 'ai-image')
    const existsResult = await resolveAiImagePath({
      userUid: userStore.userInfo.uid,
      conversationId: currentChat.value.id,
      fileName
    })
    let absolutePath = existsResult.absolutePath
    if (!existsResult.exists) {
      const buffer = await requestAiMediaBuffer(remoteUrl)
      const data = new Uint8Array(buffer)
      const saved = await persistAiImageFile({
        userUid: userStore.userInfo.uid,
        conversationId: currentChat.value.id,
        fileName,
        data
      })
      absolutePath = saved.absolutePath
    }
    if (messageList.value[messageIndex]) {
      const displayUrl = convertFileSrc(absolutePath)
      messageList.value[messageIndex].content = displayUrl
      messageList.value[messageIndex].imageUrl = remoteUrl
    }
  } catch (error) {
    console.error('AI 이미지 로컬화 실패:', error)
  }
}

// 비디오 로컬화: 이미지와 동일한 디렉토리 전략, 다운로드 후 표시 URL 교체
const ensureLocalAiVideo = async (remoteUrl: string, messageIndex: number) => {
  if (!remoteUrl || !userStore.userInfo?.uid || !currentChat.value.id) return
  const targetMessage = messageList.value[messageIndex]
  if (!targetMessage || targetMessage.type !== 'assistant') return
  const isSameVideo = targetMessage.videoUrl
    ? targetMessage.videoUrl === remoteUrl
    : targetMessage.content === remoteUrl
  if (!isSameVideo) return
  try {
    const fileName = await buildAiMediaFileName(remoteUrl, 'mp4', 'ai-video')
    const existsResult = await resolveAiImagePath({
      userUid: userStore.userInfo.uid,
      conversationId: currentChat.value.id,
      fileName
    })
    let absolutePath = existsResult.absolutePath
    if (!existsResult.exists) {
      const buffer = await requestAiMediaBuffer(remoteUrl)
      const data = new Uint8Array(buffer)
      const saved = await persistAiImageFile({
        userUid: userStore.userInfo.uid,
        conversationId: currentChat.value.id,
        fileName,
        data
      })
      absolutePath = saved.absolutePath
    }
    if (messageList.value[messageIndex]) {
      const displayUrl = convertFileSrc(absolutePath)
      messageList.value[messageIndex].content = displayUrl
      messageList.value[messageIndex].videoUrl = remoteUrl
    }
  } catch (error) {
    console.error('AI 비디오 로컬화 실패:', error)
  }
}

// 오디오 로컬화: 이미지와 동일한 디렉토리 전략, 다운로드 후 표시 URL 교체
const ensureLocalAiAudio = async (remoteUrl: string, messageIndex: number) => {
  if (!remoteUrl || !userStore.userInfo?.uid || !currentChat.value.id) return
  const targetMessage = messageList.value[messageIndex]
  if (!targetMessage || targetMessage.type !== 'assistant') return
  const isSameAudio = targetMessage.audioUrl
    ? targetMessage.audioUrl === remoteUrl
    : targetMessage.content === remoteUrl
  if (!isSameAudio) return
  try {
    const fileName = await buildAiMediaFileName(remoteUrl, 'mp3', 'ai-audio')
    const existsResult = await resolveAiImagePath({
      userUid: userStore.userInfo.uid,
      conversationId: currentChat.value.id,
      fileName
    })
    let absolutePath = existsResult.absolutePath
    if (!existsResult.exists) {
      const buffer = await requestAiMediaBuffer(remoteUrl)
      const data = new Uint8Array(buffer)
      const saved = await persistAiImageFile({
        userUid: userStore.userInfo.uid,
        conversationId: currentChat.value.id,
        fileName,
        data
      })
      absolutePath = saved.absolutePath
    }
    if (messageList.value[messageIndex]) {
      const displayUrl = convertFileSrc(absolutePath)
      messageList.value[messageIndex].content = displayUrl
      messageList.value[messageIndex].audioUrl = remoteUrl
    }
  } catch (error) {
    console.error('AI 오디오 로컬화 실패:', error)
  }
}

const getMessageBubbleClass = (message: Message) => {
  if (message.type === 'assistant' && isRenderableAiImage(message)) {
    return []
  }
  return ['bubble', message.type === 'user' ? 'bubble-oneself' : 'bubble-ai']
}

const showDeleteChatConfirm = ref(false) // 대화 삭제 확인 상자 표시 상태
const deleteWithMessages = ref(false) // 메시지 동시 삭제 여부
const showRolePopover = ref(false) // 역할 선택 팝업 표시 상태
const selectedRole = ref<any>(null) // 현재 선택된 역할
const roleList = ref<any[]>([]) // 역할 목록
const roleLoading = ref(false) // 역할 로딩 상태

// 하단으로 스크롤
const getScrollContainer = () => scrollContainerRef.value

const isNearBottom = () => {
  const container = getScrollContainer()
  if (!container) return true
  const offset = container.scrollHeight - (container.scrollTop + container.clientHeight)
  return offset <= 80
}

const scrollToBottom = (retryCount = 2) => {
  shouldAutoStickBottom.value = true
  const raf =
    typeof window === 'undefined'
      ? (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16)
      : window.requestAnimationFrame

  const scroll = () => {
    const container = getScrollContainer()
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
  }

  const runWithRetry = (remaining: number) => {
    raf(() => {
      scroll()
      if (remaining > 0) {
        runWithRetry(remaining - 1)
      }
    })
  }

  nextTick(() => {
    runWithRetry(retryCount)
  })
}

const handleScroll = () => {
  shouldAutoStickBottom.value = isNearBottom()
}

watch(scrollContainerRef, () => {
  handleScroll()
})

useResizeObserver(messageContentRef, () => {
  if (shouldAutoStickBottom.value) {
    scrollToBottom()
  }
})

/** 대화 메타 정보 변경 알림 */
const notifyConversationMetaChange = (payload: { messageCount?: number; createTime: number }) => {
  if (!currentChat.value.id || currentChat.value.id === '0') {
    return
  }

  if (payload.messageCount !== undefined) {
    currentChat.value.messageCount = payload.messageCount
  }

  const resolvedCreateTime =
    typeof payload.createTime === 'number' && Number.isFinite(payload.createTime)
      ? payload.createTime
      : currentChat.value.createTime || Date.now()
  currentChat.value.createTime = resolvedCreateTime

  useMitt.emit('update-chat-meta', {
    id: currentChat.value.id,
    messageCount: currentChat.value.messageCount,
    createTime: resolvedCreateTime
  })
}

// 모델 선택 관련 상태
const showModelPopover = ref(false)
const modelLoading = ref(false)
const modelSearch = ref('')
const selectedModel = ref<any>(null)
const reasoningEnabled = ref(false)
const supportsReasoning = computed(() => Boolean(selectedModel.value?.supportsReasoning))

// 모델 페이지네이션 데이터
const modelPagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})

// 모델 목록
const modelList = ref<any[]>([])

// 필터링된 모델 목록
const filteredModels = computed(() => {
  const list = modelList.value.slice()
  const search = modelSearch.value?.toLowerCase() || ''
  const filtered = search
    ? list.filter(
        (model) =>
          model.name?.toLowerCase().includes(search) ||
          model.description?.toLowerCase().includes(search) ||
          model.platform?.toLowerCase().includes(search)
      )
    : list
  return filtered.sort((a: any, b: any) => {
    const ao = a.publicStatus === 0
    const bo = b.publicStatus === 0
    if (ao !== bo) return ao ? -1 : 1
    const as = a.sort ?? 0
    const bs = b.sort ?? 0
    if (as !== bs) return as - bs
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
})

const officialModels = computed(() => filteredModels.value.filter((m: any) => m.publicStatus === 0))
const userModels = computed(() => filteredModels.value.filter((m: any) => m.publicStatus !== 0))

// 이미지 생성 매개변수
const imageParams = ref({
  size: '1024x1024'
})

// 이미지 크기 옵션
const imageSizeOptions = [
  { label: '1024x1024 (정사각형)', value: '1024x1024' },
  { label: '1024x1792 (세로)', value: '1024x1792' },
  { label: '1792x1024 (가로)', value: '1792x1024' }
]

// 비디오 생성 매개변수
const videoParams = ref({
  size: '1280x720',
  duration: 5, // 비디오 길이(초)
  image: null as string | null // I2V 모델용 참조 이미지 (Qiniu Cloud URL)
})

// 비디오 크기 옵션
const videoSizeOptions = [
  { label: '1280x720 (가로)', value: '1280x720' },
  { label: '720x1280 (세로)', value: '720x1280' },
  { label: '960x960 (정사각형)', value: '960x960' }
]

// 비디오 길이 옵션
const videoDurationOptions = [
  { label: '5초', value: 5 },
  { label: '10초', value: 10 }
]

// 오디오 생성 매개변수
const audioParams = ref({
  voice: 'alloy',
  speed: 1.0
})

// 오디오 음성 옵션 (동적 로드)
const audioVoiceOptions = ref([
  { label: 'Alloy (중성)', value: 'alloy' },
  { label: 'Echo (남성)', value: 'echo' },
  { label: 'Fable (남성)', value: 'fable' },
  { label: 'Onyx (남성)', value: 'onyx' },
  { label: 'Nova (여성)', value: 'nova' },
  { label: 'Shimmer (여성)', value: 'shimmer' }
])

// 지정된 모델이 지원하는 음성 목록 로드
const loadAudioVoices = async (model: any) => {
  try {
    if (!model || !model.model) {
      return
    }

    const voices = await audioGetVoices({ model: model.model })

    if (voices && voices.length > 0) {
      // 음성 목록을 옵션 형식으로 변환
      audioVoiceOptions.value = voices.map((voice: string) => {
        // 음성 이름 추출 (예: "fnlp/MOSS-TTSD-v0.5:anna" -> "anna")
        const voiceName = voice.includes(':') ? voice.split(':')[1] : voice
        return {
          label: voiceName.charAt(0).toUpperCase() + voiceName.slice(1),
          value: voice
        }
      })

      // 첫 번째 옵션을 기본값으로 설정
      if (audioVoiceOptions.value.length > 0) {
        audioParams.value.voice = audioVoiceOptions.value[0].value
      }
    } else {
      // 빈 목록이 반환되면 동적 음색을 지원함을 의미하므로 기본 옵션 사용
      audioVoiceOptions.value = [{ label: 'Default', value: 'default' }]
      audioParams.value.voice = 'default'
    }
  } catch (error) {
    console.error('음성 목록 로드 실패:', error)
    // 기본 옵션 유지
  }
}

// 오디오 속도 옵션
const audioSpeedOptions = [
  { label: '0.5x (느림)', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1.0x (보통)', value: 1.0 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x (빠름)', value: 1.5 },
  { label: '2.0x (매우 빠름)', value: 2.0 }
]

// 비디오 참조 이미지 업로드
const videoImageFileRef = ref<any>(null)
const videoImagePreview = ref<string | null>(null)
const isUploadingVideoImage = ref(false)

// 업로드 hook 초기화
const { uploadFile: uploadToQiniu, fileInfo } = useUpload()

// 비디오 참조 이미지 업로드 처리
const handleVideoImageUpload = async (options: { file: UploadFileInfo; onFinish: () => void; onError: () => void }) => {
  const file = options.file.file as File
  if (!file) {
    options.onError()
    return
  }

  // 파일 유형 확인
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    window.$message.error('JPG, PNG, WEBP 형식의 이미지만 지원합니다')
    options.onError()
    return
  }

  // 파일 크기 확인 (최대 10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    window.$message.error('이미지 크기는 10MB를 초과할 수 없습니다')
    options.onError()
    return
  }

  try {
    isUploadingVideoImage.value = true

    // Qiniu Cloud에 업로드
    await uploadToQiniu(file, {
      provider: UploadProviderEnum.QINIU,
      scene: UploadSceneEnum.CHAT,
      enableDeduplication: true
    })

    // Qiniu Cloud URL 가져오기
    const qiniuUrl = fileInfo.value?.downloadUrl
    if (qiniuUrl) {
      videoParams.value.image = qiniuUrl
      videoImagePreview.value = qiniuUrl
      console.log('비디오 참조 이미지 업로드 성공, Qiniu Cloud URL:', qiniuUrl)
      options.onFinish()
    } else {
      throw new Error('이미지 URL을 가져오지 못했습니다')
    }
  } catch (error) {
    console.error('이미지 업로드 실패:', error)
    options.onError()
  } finally {
    isUploadingVideoImage.value = false
  }
}

// 비디오 참조 이미지 지우기
const clearVideoImage = () => {
  videoParams.value.image = null
  videoImagePreview.value = null
  if (videoImageFileRef.value) {
    videoImageFileRef.value.clear()
  }
}

// 폴링 작업 관리
const MAX_POLL_DURATION = 5 * 60 * 1000 // 5분 타임아웃 보호, 장시간 중단으로 인한 메모리 점유 방지
const pollingTasks = new Map<number, { timerId: number; conversationId: string; startedAt: number }>()

// 모든 폴링 작업 중지
const stopAllPolling = () => {
  pollingTasks.forEach(({ timerId }) => window.clearInterval(timerId))
  pollingTasks.clear()
  console.log('모든 폴링 작업이 중지되었습니다')
}

// 특정 대화의 폴링 작업 중지
const stopConversationPolling = (conversationId: string) => {
  const tasksToStop: number[] = []
  pollingTasks.forEach(({ timerId, conversationId: taskConvId }, imageId) => {
    if (taskConvId === conversationId) {
      window.clearInterval(timerId)
      tasksToStop.push(imageId)
    }
  })
  tasksToStop.forEach((id) => pollingTasks.delete(id))
  if (tasksToStop.length > 0) {
    console.log(`대화 ${conversationId}의 ${tasksToStop.length}개 폴링 작업이 중지되었습니다`)
  }
}

// 기록 관련
const showHistoryModal = ref(false)
const historyType = ref<'image' | 'video' | 'audio'>('image')
const historyLoading = ref(false)
const historyList = ref<any[]>([])
const historyPagination = ref({
  pageNo: 1,
  pageSize: 12,
  total: 0
})

// 미리보기 관련
const showImagePreview = ref(false)
const showVideoPreview = ref(false)
const previewItem = ref<any>(null)
const AI_THINKING_PLACEHOLDER = '생각 중...'

const isLikelyImageUrl = (value?: string) => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    /^https?:\/\//.test(value) ||
    lower.startsWith('data:image/') ||
    lower.startsWith('asset:') ||
    lower.startsWith('file:') ||
    lower.startsWith('tauri://') ||
    lower.startsWith('blob:')
  )
}

const isLikelyMediaUrl = (value?: string) => {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    /^https?:\/\//.test(value) ||
    lower.startsWith('data:') ||
    lower.startsWith('asset:') ||
    lower.startsWith('file:') ||
    lower.startsWith('tauri://') ||
    lower.startsWith('blob:')
  )
}

const isRenderableAiImage = (message: Message) => {
  if (message.type !== 'assistant') return false
  if (!isLikelyImageUrl(message.content)) return false
  return message.msgType === AiMsgContentTypeEnum.IMAGE || message.msgType === undefined || message.msgType === null
}

const getAiPlaceholderText = (message: Message) => {
  if (message.content && message.content.trim()) return message.content
  return AI_THINKING_PLACEHOLDER
}

// AI 메시지 전송 처리
const handleSendAI = (data: { content: string }) => {
  if (!selectedModel.value) {
    window.$message.warning('AI 모델을 먼저 선택해주세요')
    return
  }

  if (!data.content.trim()) {
    window.$message.warning('메시지 내용은 비워둘 수 없습니다')
    return
  }

  // 모델 유형에 따라 다른 처리 로직 호출
  const modelType = selectedModel.value.type

  if (modelType === 1) {
    // 텍스트 대화 모델
    sendAIMessage(data.content, selectedModel.value)
  } else if (modelType === 2) {
    // 이미지 생성 모델
    generateImage(data.content, selectedModel.value)
  } else if (modelType === 3) {
    // 오디오 생성 모델
    generateAudio(data.content, selectedModel.value)
  } else if (modelType === 4 || modelType === 7 || modelType === 8) {
    // 비디오 생성 모델 (이전 type=4, 텍스트 투 비디오 type=7, 이미지 투 비디오 type=8 포함)
    generateVideo(data.content, selectedModel.value)
  } else {
    window.$message.warning('지원하지 않는 모델 유형입니다')
  }
}

// AI 메시지 전송 구현
const sendAIMessage = async (content: string, model: any) => {
  try {
    const tokenBudget = Number(model?.maxTokens || 0)
    if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
      window.$message.warning(`이 대화의 Token이 모두 소진되었습니다 (${tokenBudget}). 새 대화를 시작하거나 모델을 변경하세요`)
      return
    }
    window.$message.loading('AI 생각 중...', { duration: 0 })

    console.log('AI 메시지 전송 시작:', {
      내용: content,
      모델: model.name,
      대화ID: currentChat.value.id
    })

    // 사용자 메시지를 목록에 추가
    messageList.value.push({
      type: 'user',
      msgType: 1, // 1=TEXT
      content: content,
      createTime: Date.now()
    })

    // AI 메시지 자리 표시자 추가 (스트리밍 업데이트용)
    const aiMessageIndex = messageList.value.length
    messageList.value.push({
      type: 'assistant',
      msgType: 1, // 1=TEXT
      content: AI_THINKING_PLACEHOLDER,
      createTime: Date.now()
    })

    // 하단으로 스크롤, AI 응답 내용 누적용
    scrollToBottom()
    let accumulatedContent = ''
    let accumulatedReasoningContent = '' // 추론 내용 누적용

    if (!currentChat.value.messageCount) {
      currentChat.value.messageCount = 0
    }
    currentChat.value.messageCount += 2 // 사용자 메시지 + AI 메시지
    notifyConversationMetaChange({
      messageCount: currentChat.value.messageCount,
      createTime: Date.now()
    })

    await messageSendStream(
      {
        conversationId: currentChat.value.id,
        content: content,
        useContext: true,
        reasoningEnabled: reasoningEnabled.value
      },
      {
        onChunk: (chunk: string) => {
          try {
            const data = JSON.parse(chunk)
            if (data.success && data.data?.receive) {
              // 정상 내용 처리
              if (data.data.receive.content) {
                const incrementalContent = data.data.receive.content
                // 첫 번째 내용 도착 시 자리 표시자 지우기
                if (
                  messageList.value[aiMessageIndex].content === AI_THINKING_PLACEHOLDER &&
                  accumulatedContent === ''
                ) {
                  messageList.value[aiMessageIndex].content = ''
                }
                // 수동으로 내용 누적, AI 메시지 내용 업데이트
                accumulatedContent += incrementalContent
                messageList.value[aiMessageIndex].content = accumulatedContent
              }

              // 추론 생각 내용 처리
              if (data.data.receive.reasoningContent) {
                const incrementalReasoningContent = data.data.receive.reasoningContent
                accumulatedReasoningContent += incrementalReasoningContent
                messageList.value[aiMessageIndex].reasoningContent = accumulatedReasoningContent
              }

              // msgType 설정 (백엔드에서 반환된 경우)
              if (data.data.receive.msgType !== undefined) {
                messageList.value[aiMessageIndex].msgType = data.data.receive.msgType
              }

              scrollToBottom()
            }
          } catch (e) {
            console.error('JSON 파싱 실패:', e, '원본 데이터:', chunk)
          }
        },
        onDone: () => {
          scrollToBottom()
          const latestEntry = messageList.value[messageList.value.length - 1]
          const latestTimestamp = latestEntry?.createTime ?? currentChat.value.createTime ?? Date.now()

          notifyConversationMetaChange({
            createTime: latestTimestamp
          })
          if (currentChat.value.id && currentChat.value.id !== '0') {
            conversationGetMy({ id: currentChat.value.id })
              .then((conv: any) => {
                if (conv && typeof conv.tokenUsage === 'number') {
                  serverTokenUsage.value = conv.tokenUsage
                }
              })
              .catch(() => {})
            if (!messageList.value[aiMessageIndex].reasoningContent) {
              messageListByConversationId({ conversationId: currentChat.value.id, pageNo: 1, pageSize: 100 })
                .then((list: any[]) => {
                  if (Array.isArray(list) && list.length > 0) {
                    const last = list[list.length - 1]
                    if (last && last.type === 'assistant' && last.reasoningContent) {
                      messageList.value[aiMessageIndex].reasoningContent = last.reasoningContent
                    }
                  }
                })
                .catch(() => {})
            }
          }
        },
        onError: (error: string) => {
          console.error('AI 스트리밍 응답 오류:', error)
          messageList.value[aiMessageIndex].content = '죄송합니다. 오류가 발생했습니다: ' + error
        }
      }
    )

    // 입력 상자 지우기
    if (MsgInputRef.value?.clearInput) {
      MsgInputRef.value.clearInput()
    }

    // 메시지 카운트 업데이트
  } catch (error) {
    console.error('AI 메시지 전송 실패:', error)
    window.$message.error('전송 실패, 네트워크 연결을 확인하세요')
  } finally {
    window.$message.destroyAll()
  }
}

// 이미지 생성 구현
const generateImage = async (prompt: string, model: any) => {
  try {
    const tokenBudget = Number(model?.maxTokens || 0)
    if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
      window.$message.warning(`이 대화의 Token이 모두 소진되었습니다 (${tokenBudget}). 새 대화를 시작하거나 모델을 변경하세요`)
      return
    }
    messageList.value.push({
      type: 'user',
      content: prompt,
      msgType: 2,
      createTime: Date.now()
    })

    // AI 메시지 자리 표시자 추가 (진행 상황 표시용)
    const aiMessageIndex = messageList.value.length
    messageList.value.push({
      type: 'assistant',
      msgType: 2,
      content: AI_THINKING_PLACEHOLDER,
      createTime: Date.now(),
      isGenerating: true
    })

    scrollToBottom()

    console.log('이미지 생성 시작:', {
      프롬프트: prompt,
      모델: model.name,
      크기: imageParams.value.size
    })

    // 크기 파싱
    const [width, height] = imageParams.value.size.split('x').map(Number)

    const imageId = await imageDraw({
      modelId: String(model.id),
      prompt: prompt,
      width: width,
      height: height,
      conversationId: currentChat.value.id
    })

    // 생성 상태 폴링 조회 시작
    pollImageStatus(imageId, aiMessageIndex, prompt, width, height, model.name)

    // 입력 상자 지우기
    if (MsgInputRef.value?.clearInput) {
      MsgInputRef.value.clearInput()
    }
  } catch (error: any) {
    console.error('이미지 생성 실패:', error)
    // 오류 메시지로 업데이트
    const lastMessage = messageList.value[messageList.value.length - 1]
    if (lastMessage && lastMessage.isGenerating) {
      lastMessage.content = `이미지 생성 실패: ${error.message || '알 수 없는 오류'}`
      lastMessage.isGenerating = false
    }
    window.$message.error('이미지 생성 실패, 네트워크 연결을 확인하세요')
  }
}

// 이미지 생성 상태 폴링 조회
const pollImageStatus = async (
  imageId: number,
  messageIndex: number,
  prompt: string,
  width: number,
  height: number,
  modelName: string
) => {
  const interval = 3000 // 3초마다 폴링
  const conversationId = currentChat.value.id

  const poll = async () => {
    const task = pollingTasks.get(imageId)
    if (!task) return

    // 타임아웃 보호
    if (Date.now() - task.startedAt > MAX_POLL_DURATION) {
      window.clearInterval(task.timerId)
      pollingTasks.delete(imageId)
      messageList.value[messageIndex].content = '이미지 생성 시간 초과, 다시 시도해주세요'
      messageList.value[messageIndex].isGenerating = false
      window.$message.warning('이미지 생성 시간 초과, 폴링이 중지되었습니다')
      return
    }

    try {
      if (!pollingTasks.has(imageId)) {
        return
      }

      const imageList = await imageMyListByIds({ ids: imageId.toString() })

      if (!imageList || !Array.isArray(imageList) || imageList.length === 0) {
        messageList.value[messageIndex].content = '이미지 생성 실패: 기록이 존재하지 않습니다'
        messageList.value[messageIndex].isGenerating = false
        pollingTasks.delete(imageId)
        return
      }

      const image = imageList[0]

      // 상태: 10=진행 중, 20=성공, 30=실패
      if (image.status === 20) {
        messageList.value[messageIndex] = {
          type: 'assistant',
          content: image.picUrl,
          msgType: AiMsgContentTypeEnum.IMAGE,
          createTime: Date.now(),
          isGenerating: false,
          imageUrl: image.picUrl,
          imageInfo: {
            prompt: prompt,
            width: width,
            height: height,
            model: modelName
          }
        }

        void ensureLocalAiImage(image.picUrl, messageIndex)

        window.$message.success('이미지 생성 성공')

        scrollToBottom()
        pollingTasks.delete(imageId)
        return
      } else if (image.status === 30) {
        // 생성 실패
        messageList.value[messageIndex].content = `이미지 생성 실패: ${image.errorMessage || '알 수 없는 오류'}`
        messageList.value[messageIndex].isGenerating = false
        window.$message.error('이미지 생성 실패')
        pollingTasks.delete(imageId)
        return
      }

      // 상태=10 (진행 중), 계속 폴링
      console.log('이미지 생성 중, 계속 폴링...')
    } catch (error: any) {
      console.error('이미지 상태 폴링 실패:', error)
      messageList.value[messageIndex].content = `상태 조회 실패: ${error.message || '알 수 없는 오류'}`
      messageList.value[messageIndex].isGenerating = false
      pollingTasks.delete(imageId)
    }
  }

  // 정기 폴링 시작
  const timerId = window.setInterval(poll, interval)
  pollingTasks.set(imageId, { timerId, conversationId, startedAt: Date.now() })

  // 첫 번째 폴링 즉시 실행
  poll()
}

// 비디오 생성 구현
const generateVideo = async (prompt: string, model: any) => {
  try {
    const tokenBudget = Number(model?.maxTokens || 0)
    if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
      window.$message.warning(`이 대화의 Token이 모두 소진되었습니다 (${tokenBudget}). 새 대화를 시작하거나 모델을 변경하세요`)
      return
    }
    messageList.value.push({
      type: 'user',
      msgType: 3, // 3=VIDEO
      content: prompt,
      createTime: Date.now()
    })

    // AI 메시지 자리 표시자 추가
    const aiMessageIndex = messageList.value.length
    messageList.value.push({
      type: 'assistant',
      msgType: 3, // 3=VIDEO
      content: AI_THINKING_PLACEHOLDER,
      createTime: Date.now(),
      isGenerating: true
    })

    scrollToBottom()

    console.log('비디오 생성 시작:', {
      프롬프트: prompt,
      모델: model.name,
      크기: videoParams.value.size,
      참조이미지: videoParams.value.image ? '업로드됨' : '업로드 안 됨'
    })

    // 크기 파싱
    const [width, height] = videoParams.value.size.split('x').map(Number)

    // 요청 매개변수 구성
    const requestBody: any = {
      modelId: String(model.id),
      prompt: prompt,
      width: width,
      height: height,
      duration: videoParams.value.duration,
      conversationId: currentChat.value.id
    }

    // 참조 이미지가 있는 경우 options에 추가
    if (videoParams.value.image) {
      requestBody.options = {
        image: videoParams.value.image
      }
    }

    // 비디오 생성 API 호출, 비디오 ID 반환
    const videoId = await videoGenerate(requestBody)

    // 생성 상태 폴링 조회 시작
    pollVideoStatus(videoId, aiMessageIndex, prompt, width, height, model.name)

    // 입력 상자 및 참조 이미지 지우기
    if (MsgInputRef.value?.clearInput) {
      MsgInputRef.value.clearInput()
    }
    clearVideoImage()
  } catch (error: any) {
    console.error('비디오 생성 실패:', error)
    // 오류 메시지로 업데이트
    const lastMessage = messageList.value[messageList.value.length - 1]
    if (lastMessage && lastMessage.isGenerating) {
      lastMessage.content = `비디오 생성 실패: ${error.message || '알 수 없는 오류'}`
      lastMessage.isGenerating = false
    }
    window.$message.error('비디오 생성 실패, 네트워크 연결을 확인하세요')
  }
}

// 비디오 생성 상태 폴링 조회
const pollVideoStatus = async (
  videoId: number,
  messageIndex: number,
  prompt: string,
  width: number,
  height: number,
  modelName: string
) => {
  const interval = 5000 // 5초마다 폴링
  const conversationId = currentChat.value.id

  const poll = async () => {
    const task = pollingTasks.get(videoId)
    if (!task) return

    // 타임아웃 보호
    if (Date.now() - task.startedAt > MAX_POLL_DURATION) {
      window.clearInterval(task.timerId)
      pollingTasks.delete(videoId)
      messageList.value[messageIndex].content = '비디오 생성 시간 초과, 다시 시도해주세요'
      messageList.value[messageIndex].isGenerating = false
      window.$message.warning('비디오 생성 시간 초과, 폴링이 중지되었습니다')
      return
    }

    try {
      // 작업이 중지되었는지 확인
      if (!pollingTasks.has(videoId)) {
        return
      }

      // 백엔드는 배열 List<AiVideoRespVO>를 반환합니다
      const videoList = await videoMyListByIds({ ids: videoId.toString() })

      if (!videoList || !Array.isArray(videoList) || videoList.length === 0) {
        messageList.value[messageIndex].content = '비디오 생성 실패: 기록이 존재하지 않습니다'
        messageList.value[messageIndex].isGenerating = false
        pollingTasks.delete(videoId)
        return
      }

      const video = videoList[0]

      // 상태: 10=진행 중, 20=성공, 30=실패
      if (video.status === 20) {
        messageList.value[messageIndex] = {
          type: 'assistant',
          content: video.videoUrl,
          msgType: AiMsgContentTypeEnum.VIDEO,
          createTime: Date.now(),
          isGenerating: false,
          videoUrl: video.videoUrl,
          videoInfo: {
            prompt: prompt,
            width: width,
            height: height,
            model: modelName
          }
        }

        void ensureLocalAiVideo(video.videoUrl, messageIndex)

        window.$message.success('비디오 생성 성공')

        scrollToBottom()
        pollingTasks.delete(videoId)
        return
      } else if (video.status === 30) {
        // 생성 실패
        messageList.value[messageIndex].content = `비디오 생성 실패: ${video.errorMessage || '알 수 없는 오류'}`
        messageList.value[messageIndex].isGenerating = false
        window.$message.error('비디오 생성 실패')
        pollingTasks.delete(videoId)
        return
      }

      // 상태=10 (진행 중), 계속 폴링
    } catch (error: any) {
      console.error('비디오 상태 폴링 실패:', error)
      messageList.value[messageIndex].content = `상태 조회 실패: ${error.message || '알 수 없는 오류'}`
      messageList.value[messageIndex].isGenerating = false
      pollingTasks.delete(videoId)
    }
  }

  // 정기 폴링 시작
  const timerId = window.setInterval(poll, interval)
  pollingTasks.set(videoId, { timerId, conversationId, startedAt: Date.now() })

  // 첫 번째 폴링 즉시 실행
  poll()
}

// 오디오 생성 구현: 사용자 메시지 추가
const generateAudio = async (prompt: string, model: any) => {
  try {
    const tokenBudget = Number(model?.maxTokens || 0)
    if (tokenBudget > 0 && conversationTokens.value >= tokenBudget) {
      window.$message.warning(`이 대화의 Token이 모두 소진되었습니다 (${tokenBudget}). 새 대화를 시작하거나 모델을 변경하세요`)
      return
    }
    messageList.value.push({
      type: 'user',
      msgType: 4, // 4=AUDIO
      content: prompt,
      createTime: Date.now()
    })

    // AI 메시지 자리 표시자 추가 (진행 상황 표시용)
    const aiMessageIndex = messageList.value.length
    messageList.value.push({
      type: 'assistant',
      msgType: 4, // 4=AUDIO
      content: AI_THINKING_PLACEHOLDER,
      createTime: Date.now(),
      isGenerating: true
    })

    scrollToBottom()

    console.log('오디오 생성 시작:', {
      프롬프트: prompt,
      모델: model.name,
      음성: audioParams.value.voice,
      속도: audioParams.value.speed
    })

    const audioId = await audioGenerate({
      modelId: model.id,
      prompt: prompt,
      conversationId: currentChat.value.id,
      options: {
        voice: audioParams.value.voice,
        speed: String(audioParams.value.speed)
      }
    })

    pollAudioStatus(audioId, aiMessageIndex, prompt, model.name)

    if (MsgInputRef.value?.clearInput) {
      MsgInputRef.value.clearInput()
    }
  } catch (error: any) {
    console.error('오디오 생성 실패:', error)
    const lastMessage = messageList.value[messageList.value.length - 1]
    if (lastMessage && lastMessage.isGenerating) {
      lastMessage.content = `오디오 생성 실패: ${error.message || '알 수 없는 오류'}`
      lastMessage.isGenerating = false
    }
    window.$message.error('오디오 생성 실패, 네트워크 연결을 확인하세요')
  }
}

// 오디오 생성 상태 폴링 조회
const pollAudioStatus = async (audioId: number, messageIndex: number, prompt: string, modelName: string) => {
  const interval = 3000
  const conversationId = currentChat.value.id

  const poll = async () => {
    const task = pollingTasks.get(audioId)
    if (!task) return

    // 타임아웃 보호
    if (Date.now() - task.startedAt > MAX_POLL_DURATION) {
      window.clearInterval(task.timerId)
      pollingTasks.delete(audioId)
      messageList.value[messageIndex].content = '오디오 생성 시간 초과, 다시 시도해주세요'
      messageList.value[messageIndex].isGenerating = false
      window.$message.warning('오디오 생성 시간 초과, 폴링이 중지되었습니다')
      return
    }

    try {
      if (!pollingTasks.has(audioId)) {
        return
      }

      const audioList = await audioMyListByIds({ ids: audioId.toString() })

      if (!audioList || !Array.isArray(audioList) || audioList.length === 0) {
        messageList.value[messageIndex].content = '오디오 생성 실패: 기록이 존재하지 않습니다'
        messageList.value[messageIndex].isGenerating = false
        pollingTasks.delete(audioId)
        return
      }

      const audio = audioList[0]

      // 20은 성공을 나타냄
      if (audio.status === 20) {
        messageList.value[messageIndex] = {
          type: 'assistant',
          content: audio.audioUrl,
          msgType: AiMsgContentTypeEnum.AUDIO,
          createTime: Date.now(),
          isGenerating: false,
          audioUrl: audio.audioUrl,
          audioInfo: {
            prompt: prompt,
            model: modelName,
            voice: audioParams.value.voice,
            speed: audioParams.value.speed
          }
        }

        void ensureLocalAiAudio(audio.audioUrl, messageIndex)

        window.$message.success('오디오 생성 성공')

        scrollToBottom()
        pollingTasks.delete(audioId)
        return
      } else if (audio.status === 30) {
        messageList.value[messageIndex].content = `오디오 생성 실패: ${audio.errorMessage || '알 수 없는 오류'}`
        messageList.value[messageIndex].isGenerating = false
        window.$message.error('오디오 생성 실패')
        pollingTasks.delete(audioId)
        return
      }
    } catch (error: any) {
      // 폴링 실패
      messageList.value[messageIndex].content = `상태 조회 실패: ${error.message || '알 수 없는 오류'}`
      messageList.value[messageIndex].isGenerating = false
      pollingTasks.delete(audioId)
    }
  }

  const timerId = window.setInterval(poll, interval)
  pollingTasks.set(audioId, { timerId, conversationId, startedAt: Date.now() })

  poll()
}

// 이미지 미리보기 처리
const handleImagePreview = (imageUrl: string) => {
  previewItem.value = { picUrl: imageUrl }
  showImagePreview.value = true
}

// 기능 목록
const features = ref([
  {
    icon: 'model',
    label: '모델'
  },
  {
    icon: 'voice',
    label: '음성 입력'
  },
  {
    icon: 'plugins2',
    label: '플러그인'
  }
])

// 기타 기능
const otherFeatures = computed(() => features.value.filter((item) => item.icon !== 'model'))

// 기본 아바타 가져오기
const getDefaultAvatar = () => {
  return 'https://img1.baidu.com/it/u=3613958228,3522035000&fm=253&fmt=auto&app=120&f=JPEG?w=500&h=500'
}

// 모델 아바타 가져오기
const getModelAvatar = (model: any) => {
  if (!model) {
    return getDefaultAvatar()
  }

  if (model.avatar) {
    return model.avatar
  }

  // 모델 이름에 따라 기본 아바타 생성
  const modelName = model.name || ''

  // 일반적인 모델의 기본 아바타 매핑
  const defaultAvatars: Record<string, string> = {
    'gpt-4': getDefaultAvatar()
  }

  // 모델 이름에 키워드가 포함되어 있는지 확인
  const lowerName = modelName.toLowerCase()
  for (const [key, avatar] of Object.entries(defaultAvatars)) {
    if (lowerName.includes(key)) {
      return avatar
    }
  }

  // 기본적으로 일반 아바타 반환
  return getDefaultAvatar()
}

// 모델 목록 가져오기
const fetchModelList = async () => {
  modelLoading.value = true
  try {
    const data = await modelPage({
      pageNo: modelPagination.value.pageNo,
      pageSize: modelPagination.value.pageSize
    })

    modelList.value = data.list || []
    modelPagination.value.total = data.total || 0
  } catch (error) {
    console.error('모델 목록 가져오기 실패:', error)
    window.$message.error('모델 목록 가져오기 실패')
  } finally {
    modelLoading.value = false
  }
}

// 모델 클릭 처리
const handleModelClick = () => {
  showModelPopover.value = !showModelPopover.value
  if (showModelPopover.value && modelList.value.length === 0) {
    fetchModelList()
  }
}

// 모델 선택
const selectModel = async (model: any) => {
  selectedModel.value = model ? { ...model } : null
  showModelPopover.value = false

  // 이미지 투 비디오 모델이 아닌 경우 참조 이미지 지우기
  if (model && model.type !== 8) {
    clearVideoImage()
  }

  // 오디오 모델인 경우 지원되는 음성 목록 로드
  if (model && model.type === 3) {
    await loadAudioVoices(model)
  }

  // 현재 대화가 있는 경우 백엔드 API를 호출하여 대화의 모델 업데이트
  if (currentChat.value.id && currentChat.value.id !== '0') {
    try {
      await conversationUpdateMy({
        id: currentChat.value.id,
        modelId: String(model.id)
      })
    } catch (error) {
      console.error('모델 전환 실패:', error)
      window.$message.destroyAll()
      window.$message.error('모델 전환 실패')
    }
  } else {
    window.$message.success(`선택된 모델: ${model.name}`)
  }

  // mitt를 통해 다른 컴포넌트에 모델 선택 알림
  useMitt.emit('model-selected', model)
}

// 모델 페이지 변경 처리
const handleModelPageChange = (page: number) => {
  modelPagination.value.pageNo = page
  fetchModelList()
}

// 모델 관리 열기
const handleOpenModelManagement = () => {
  showModelPopover.value = false
  useMitt.emit('open-model-management')
}

// 역할 목록 로드
const loadRoleList = async () => {
  roleLoading.value = true
  try {
    const data = await chatRolePage({ pageNo: 1, pageSize: 100 })
    roleList.value = (data.list || []).filter((item: any) => item.status === 0) // 사용 가능한 역할만 표시

    // 선택된 역할이 없으면 기본적으로 첫 번째 역할 선택
    if (!selectedRole.value && roleList.value.length > 0) {
      selectedRole.value = roleList.value[0]
    }
  } catch (error) {
    console.error('역할 목록 로드 실패:', error)
    window.$message.error('역할 목록 로드 실패')
  } finally {
    roleLoading.value = false
  }
}

// 역할 선택
const handleSelectRole = async (role: any) => {
  selectedRole.value = role ? { ...role } : null
  showRolePopover.value = false

  try {
    if (currentChat.value.id && currentChat.value.id !== '0') {
      await conversationUpdateMy({
        id: currentChat.value.id,
        roleId: role.id,
        modelId: role.modelId ? role.modelId : undefined
      })
    } else {
      // 대화가 없으면 역할만 선택하고 대화는 생성하지 않음
      window.$message.success(`선택된 역할: ${role.name}`)
    }
  } catch (error) {
    console.error('역할 전환 실패:', error)
    window.$message.destroyAll()
    window.$message.error('역할 전환 실패')
  }
}

// 역할 관리 열기
const handleOpenRoleManagement = () => {
  showRolePopover.value = false
  useMitt.emit('open-role-management')
}

const handleBlur = async () => {
  isEdit.value = false
  if (originalTitle.value === currentChat.value.title) {
    return
  }
  if (currentChat.value.title === '') {
    currentChat.value.title = `새로운 채팅${currentChat.value.id}`
  }

  try {
    await conversationUpdateMy({
      id: currentChat.value.id,
      title: currentChat.value.title
    })

    useMitt.emit('update-chat-title', { title: currentChat.value.title, id: currentChat.value.id })
  } catch (error) {
    console.error('대화 제목 업데이트 실패:', error)
    window.$message.error('이름 변경 실패')
    currentChat.value.title = originalTitle.value
  }
}

const handleEdit = () => {
  originalTitle.value = currentChat.value.title
  isEdit.value = true
  nextTick(() => {
    inputInstRef.value?.select()
  })
}

// 대화의 기록 메시지 로드
const loadMessages = async (conversationId: string) => {
  if (!conversationId || conversationId === '0') {
    console.log('대화 ID가 유효하지 않아 메시지 로드를 건너뜁니다')
    return
  }

  try {
    loadingMessages.value = true
    const data = await messageListByConversationId({
      conversationId: conversationId,
      pageNo: 1,
      pageSize: 100
    })

    if (data && Array.isArray(data) && data.length > 0) {
      // 현재 메시지 목록 지우기
      messageList.value = []

      // 메시지 수 제한, 최근 MAX_MESSAGE_COUNT 개만 유지
      const limitedData = data.slice(-MAX_MESSAGE_COUNT)

      limitedData.forEach((msg: any) => {
        const nextMessage: Message = {
          type: msg.type,
          content: msg.content || '',
          reasoningContent: msg.reasoningContent, // 추론 생각 내용
          msgType: msg.msgType, // 메시지 콘텐츠 유형 열거형
          createTime: msg.createTime ?? Date.now(),
          id: msg.id,
          replyId: msg.replyId,
          model: msg.model
        }
        if (
          nextMessage.type === 'assistant' &&
          (nextMessage.msgType === undefined || nextMessage.msgType === null) &&
          isLikelyImageUrl(nextMessage.content)
        ) {
          nextMessage.msgType = AiMsgContentTypeEnum.IMAGE
        }
        if (nextMessage.msgType === AiMsgContentTypeEnum.IMAGE && isLikelyImageUrl(nextMessage.content)) {
          nextMessage.imageUrl = msg.imageUrl || nextMessage.content
        }
        messageList.value.push(nextMessage)
      })

      if (userStore.userInfo?.uid && currentChat.value.id) {
        void Promise.all(
          messageList.value.map((msg, index) => {
            if (msg.type !== 'assistant') return Promise.resolve()
            if (msg.msgType === AiMsgContentTypeEnum.IMAGE) {
              const remoteUrl = msg.imageUrl || msg.content
              return ensureLocalAiImage(remoteUrl, index)
            }
            if (msg.msgType === AiMsgContentTypeEnum.VIDEO) {
              const remoteUrl = msg.videoUrl || msg.content
              return ensureLocalAiVideo(remoteUrl, index)
            }
            if (msg.msgType === AiMsgContentTypeEnum.AUDIO) {
              const remoteUrl = msg.audioUrl || msg.content
              return ensureLocalAiAudio(remoteUrl, index)
            }
            return Promise.resolve()
          })
        )
      }

      nextTick(() => {
        scrollToBottom()
      })
      try {
        const conv = await conversationGetMy({ id: conversationId })
        if (conv && typeof conv.tokenUsage === 'number') {
          serverTokenUsage.value = conv.tokenUsage
        }
      } catch {}
    } else {
      messageList.value = []
    }
  } catch (error) {
    console.error('메시지 로드 실패:', error)
    window.$message.error('메시지 로드 실패')
    messageList.value = []
  } finally {
    loadingMessages.value = false
  }
}

// 새 대화 추가
const handleCreateNewChat = async () => {
  try {
    const data = await conversationCreateMy({
      roleId: selectedRole.value?.id,
      knowledgeId: undefined,
      title: selectedRole.value?.name || '새로운 대화'
    })

    if (data) {
      window.$message.success('대화 생성 성공')

      // 왼쪽 목록에 새 대화를 직접 추가하도록 알림, 전체 목록 새로고침 불필요
      const rawCreateTime = Number(data.createTime)
      const newChat = {
        id: data.id || data,
        title: data.title || selectedRole.value?.name || '새로운 대화',
        createTime: Number.isFinite(rawCreateTime) ? rawCreateTime : Date.now(),
        messageCount: data.messageCount || 0,
        isPinned: data.pinned || false,
        roleId: selectedRole.value?.id,
        modelId: data.modelId
      }

      useMitt.emit('add-conversation', newChat)

      // 채팅 페이지로 이동
      serverTokenUsage.value = null
      messageList.value = []
      router.push('/chat')
    }
  } catch (error) {
    console.error('대화 생성 실패:', error)
    window.$message.error('대화 생성 실패')
  }
}

// 단일 메시지 삭제
const handleDeleteMessage = async (messageId: string, index: number) => {
  if (!messageId) {
    window.$message.warning('메시지 ID가 유효하지 않습니다')
    return
  }

  try {
    await messageDelete({ id: messageId })

    // 메시지 목록에서 제거
    messageList.value.splice(index, 1)
    window.$message.success('메시지가 삭제되었습니다')

    // 대화의 메시지 수 업데이트
    currentChat.value.messageCount = Math.max((currentChat.value.messageCount || 0) - 1, 0)
    const latestEntry = messageList.value[messageList.value.length - 1]
    const latestTimestamp = latestEntry?.createTime ?? currentChat.value.createTime ?? Date.now()
    notifyConversationMetaChange({
      messageCount: currentChat.value.messageCount,
      createTime: latestTimestamp
    })
  } catch (error) {
    console.error('메시지 삭제 실패:', error)
    window.$message.error('메시지 삭제 실패')
  }
}

// 대화 삭제
const handleDeleteChat = async () => {
  if (!currentChat.value.id || currentChat.value.id === '0') {
    window.$message.warning('대화를 먼저 선택해주세요')
    showDeleteChatConfirm.value = false
    return
  }

  try {
    if (deleteWithMessages.value) {
      try {
        await messageDeleteByConversationId({ conversationIdList: [currentChat.value.id] })
      } catch (error) {
        console.error('대화 메시지 삭제 실패:', error)
      }
    }

    // 대화 삭제
    await conversationDeleteMy({ conversationIdList: [currentChat.value.id] })
    window.$message.success(deleteWithMessages.value ? '대화 및 메시지가 삭제되었습니다' : '대화 삭제 성공')

    // 확인 상자 닫기
    showDeleteChatConfirm.value = false
    deleteWithMessages.value = false // 옵션 초기화

    // 현재 대화 데이터 지우기
    currentChat.value = {
      id: '0',
      title: '',
      messageCount: 0,
      createTime: 0
    }
    messageList.value = []
    serverTokenUsage.value = null

    // 먼저 환영 페이지로 이동한 다음 왼쪽 목록 새로고침 알림
    await router.push('/welcome')
    useMitt.emit('refresh-conversations')
  } catch (error) {
    console.error('대화 삭제 실패:', error)
    window.$message.error('대화 삭제 실패')
    showDeleteChatConfirm.value = false
  }
}

// 대화 전환 이벤트 미리 수신
useMitt.on('chat-active', async (e) => {
  const { title, id, messageCount, roleId, modelId, createTime } = e

  currentChat.value.title = title || `새로운 채팅${currentChat.value.id}`
  currentChat.value.id = id
  currentChat.value.messageCount = messageCount ?? 0
  currentChat.value.createTime = createTime ?? currentChat.value.createTime ?? Date.now()

  serverTokenUsage.value = null
  messageList.value = []

  if (modelList.value.length === 0) {
    await fetchModelList()
  }

  // 역할 목록이 로드되었는지 확인
  if (roleList.value.length === 0) {
    await loadRoleList()
  }

  if (roleId) {
    const role = roleList.value.find((r: any) => String(r.id) === String(roleId))
    if (role) {
      selectedRole.value = role
    }
  }

  if (modelId) {
    const model = modelList.value.find((m: any) => String(m.id) === String(modelId))
    if (model) {
      selectedModel.value = model
      // 오디오 모델인 경우 지원되는 음성 목록 로드
      if (model.type === 3) {
        await loadAudioVoices(model)
      }
    }
  }

  await loadMessages(id)
})

// 기록 열기
const handleOpenHistory = () => {
  // 선택된 모델이 있는 경우 모델 유형에 따라 해당 기록 표시
  if (selectedModel.value) {
    if (selectedModel.value.type === 2) {
      historyType.value = 'image'
    } else if (selectedModel.value.type === 3) {
      historyType.value = 'audio'
    } else if (selectedModel.value.type === 4 || selectedModel.value.type === 7 || selectedModel.value.type === 8) {
      historyType.value = 'video'
    } else {
      // 기타 유형은 기본적으로 이미지 기록 표시
      historyType.value = 'image'
    }
  } else {
    // 모델이 선택되지 않은 경우 기본적으로 이미지 기록 표시
    historyType.value = 'image'
  }

  historyPagination.value.pageNo = 1
  showHistoryModal.value = true
  loadHistory()
}

// 기록 로드
const loadHistory = async () => {
  historyLoading.value = true
  try {
    let apiFunc
    if (historyType.value === 'image') {
      apiFunc = imageMyPage
    } else if (historyType.value === 'audio') {
      apiFunc = audioMyPage
    } else {
      apiFunc = videoMyPage
    }

    const data = await apiFunc({
      pageNo: historyPagination.value.pageNo,
      pageSize: historyPagination.value.pageSize
    })
    historyList.value = data.list || []
    historyPagination.value.total = data.total || 0
  } catch (error) {
    console.error('기록 로드 실패:', error)
    window.$message.error('기록 로드 실패')
  } finally {
    historyLoading.value = false
  }
}

// 기록 유형 전환
const switchHistoryType = (type: 'image' | 'video' | 'audio') => {
  historyType.value = type
  historyPagination.value.pageNo = 1
  loadHistory()
}

// 기록 페이지 변경
const handleHistoryPageChange = (page: number) => {
  historyPagination.value.pageNo = page
  loadHistory()
}

// 이미지 미리보기
const handlePreviewImage = (item: any) => {
  previewItem.value = item
  showImagePreview.value = true
}

// 비디오 미리보기
const handlePreviewVideo = (item: any) => {
  previewItem.value = item
  showVideoPreview.value = true
}

// 이벤트 핸들러 (onUnmounted에서 제거할 수 있도록 최상위 스코프에 정의)
const handleRefreshRoleList = () => {
  console.log('역할 목록 새로고침 이벤트 수신')
  loadRoleList()
}

const handleRefreshModelList = async () => {
  await fetchModelList()

  // 현재 선택된 모델이 있는 경우 selectedModel 객체 업데이트 필요
  if (selectedModel.value && selectedModel.value.id) {
    const updatedModel = modelList.value.find((m: any) => m.id === selectedModel.value.id)
    if (updatedModel) {
      // 이전 모델 유형 기록
      const oldType = selectedModel.value.type
      // 새 모델 객체로 업데이트
      selectedModel.value = { ...updatedModel }
      console.log('selectedModel 업데이트됨:', selectedModel.value)

      // 모델 유형이 8에서 다른 유형으로 변경된 경우 참고 이미지 지우기
      if (oldType === 8 && updatedModel.type !== 8) {
        clearVideoImage()
        console.log('모델 유형이 변경되어 참고 이미지가 지워졌습니다')
      }
    }
  }
}

const handleLeftChatTitle = (e: any) => {
  const { title, id, messageCount, createTime } = e
  if (id === currentChat.value.id) {
    currentChat.value.title = title ?? ''
    currentChat.value.messageCount = messageCount ?? 0
    currentChat.value.createTime = createTime ?? currentChat.value.createTime ?? Date.now()
  }
}

onMounted(async () => {
  // 모델 목록 로드 완료 대기
  if (modelList.value.length === 0) {
    await fetchModelList()
  }

  // 역할 목록 로드 완료 대기
  await loadRoleList()

  // 역할 목록 새로고침 이벤트 수신
  useMitt.on('refresh-role-list', handleRefreshRoleList)

  // 모델 목록 새로고침 이벤트 수신
  useMitt.on('refresh-model-list', handleRefreshModelList)

  // 생성 기록 열기 이벤트 수신
  useMitt.on('open-generation-history', handleOpenHistory)

  // 왼쪽 채팅 제목 업데이트 이벤트 수신
  useMitt.on('left-chat-title', handleLeftChatTitle)
})

onUnmounted(() => {
  // 모든 폴링 작업 중지
  stopAllPolling()

  useMitt.off('refresh-role-list', handleRefreshRoleList)
  useMitt.off('refresh-model-list', handleRefreshModelList)
  useMitt.off('open-generation-history', handleOpenHistory)
  useMitt.off('left-chat-title', handleLeftChatTitle)
})

// 대화 전환 감지, 이전 대화의 폴링 작업 중지
watch(
  () => currentChat.value.id,
  (newId, oldId) => {
    if (oldId && oldId !== newId) {
      stopConversationPolling(oldId)
    }
  }
)
</script>

<style scoped lang="scss">
@use '@/styles/scss/render-message';
@use '@/styles/scss/chatBot/code-block';

/* 메인 컨테이너 레이아웃 */
.chat-main-container {
  display: flex;
  flex-direction: row;
  height: 100vh;
  overflow: hidden;
}

/* 왼쪽 역할 선택 영역 */
.chat-role-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line-color);
  background: var(--bg-color);

  .role-sidebar-header {
    padding: 16px;
    border-bottom: 1px solid var(--line-color);
  }

  .role-sidebar-content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }
}

/* 오른쪽 채팅 영역 */
.chat-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 헤더 영역 */
.chat-header {
  flex-shrink: 0;
  min-height: 60px;
  max-height: 80px;
}

/* 채팅 메시지 영역 */
.chat-messages-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.link-node),
  :deep(.footnote-link) {
    --link-color: #13987f;
    color: #13987f;
  }
}

/* 기본 스크롤바 스타일 및 상호 작용 */
.scrollbar-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  will-change: scroll-position;
  transform: translateZ(0);

  &::-webkit-scrollbar {
    width: 6px;
    transition: opacity 0.3s ease;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(144, 144, 144, 0.3);
    border-radius: 3px;
    transition:
      opacity 0.3s ease,
      background-color 0.3s ease;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(144, 144, 144, 0.5);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &.hide-scrollbar {
    &::-webkit-scrollbar,
    &::-webkit-scrollbar-thumb,
    &::-webkit-scrollbar-track {
      background: transparent;
    }

    padding-right: 0.01px;
  }
}

/* 입력 상자 컨테이너 하단 고정 */
.chat-input-container {
  flex-shrink: 0;
  background: var(--bg-color);
}

.right-btn {
  @apply size-fit border-(1px solid [--line-color]) cursor-pointer bg-[--chat-bt-color] color-[--chat-text-color] rounded-8px custom-shadow p-[10px_11px];
  transition: all 0.2s ease;
  svg {
    @apply size-18px;
  }

  // &:hover {
  //   @apply bg-[--chat-hover-color];
  // }

  &.right-btn-disabled {
    @apply opacity-50 cursor-not-allowed;
    &:hover {
      @apply bg-[--chat-bt-color];
    }
  }
}

.options {
  padding-left: 4px;
  svg {
    @apply size-22px cursor-pointer outline-none;
  }
}

/* AI 메시지 말풍선 스타일 */
.bubble-ai {
  display: flex;
  flex-direction: column;
  width: fit-content;
  max-width: 80%;
  line-height: 2;

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 18px;
    line-height: 1.6;
  }
}

/* 모델 선택기 스타일 */
.model-selector {
  background: var(--chat-bt-color);
  border-radius: 8px;
  padding: 12px;
  max-height: 400px;
  display: flex;
  flex-direction: column;

  .model-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .model-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--chat-text-color);
    }
  }

  .model-list {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 12px;

    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;

      .loading-text {
        margin-left: 8px;
        font-size: 12px;
        color: #909090;
      }
    }

    .empty-container {
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .models-container {
      .model-section-title {
        font-size: 12px;
        color: #707070;
        padding: 4px 8px;
      }
      .model-divider {
        height: 1px;
        background: var(--line-color);
        margin: 6px 0;
      }
      .model-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        margin-bottom: 4px;
        transition: all 0.2s ease;
        border: 1px solid transparent;

        &:hover {
          background: var(--chat-hover-color);
        }

        &.model-item-active {
          border-color: #13987f;
          background: rgba(19, 152, 127, 0.1);
        }

        .model-info {
          flex: 1;
          margin-left: 12px;

          .model-name {
            font-size: 13px;
            font-weight: 500;
            color: var(--chat-text-color);
            margin-bottom: 2px;
          }

          .model-description {
            font-size: 11px;
            color: #909090;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .model-meta {
            display: flex;
            gap: 8px;

            .model-provider,
            .model-version {
              font-size: 10px;
              color: #707070;
              background: rgba(0, 0, 0, 0.05);
              padding: 1px 4px;
              border-radius: 3px;
            }
          }
        }

        .model-status {
          margin-left: 8px;
        }
      }
    }
  }

  .model-pagination {
    display: flex;
    justify-content: center;
    padding-top: 8px;
    border-top: 1px solid var(--line-color);
  }
}

/* 역할 선택기 스타일 */
.role-selector {
  background: var(--chat-bt-color);
  border-radius: 8px;
  padding: 12px;
  max-height: 400px;
  display: flex;
  flex-direction: column;

  .role-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .role-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--chat-text-color);
    }
  }

  .role-list {
    flex: 1;
    overflow-y: auto;

    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;

      .loading-text {
        margin-left: 8px;
        font-size: 12px;
        color: #909090;
      }
    }

    .empty-container {
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .roles-container {
      .role-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        margin-bottom: 4px;
        transition: all 0.2s ease;
        border: 1px solid transparent;
        gap: 12px;

        &:hover {
          background: var(--chat-hover-color);
        }

        &.active {
          border-color: #13987f;
          background: rgba(19, 152, 127, 0.1);
        }

        .role-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--chat-text-color);
        }

        .role-desc {
          font-size: 11px;
          color: #909090;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
}

:deep(.paragraph-node) {
  margin: 0.5rem 0;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.history-item {
  border: 1px solid var(--line-color);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.history-wrapper {
  display: flex;
  flex-direction: column;
}

.media-preview {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  cursor: pointer;
  position: relative;

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-preview {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .preview-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    &.error {
      background: #fff1f0;
    }
  }
}

.history-info {
  padding: 12px;

  .prompt {
    font-size: 13px;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.preview-container {
  .preview-image,
  .preview-video {
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
  }

  .preview-info {
    padding: 16px;
    background: var(--bg-color);
    border-radius: 8px;
  }
}
</style>
