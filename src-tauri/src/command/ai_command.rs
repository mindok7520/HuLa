use crate::AppData;
use crate::im_request_client::ImUrl;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{State, ipc::Channel};
use tracing::{error, info};

/// SSE 스트리밍 데이터 이벤트
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseStreamEvent {
    /// 이벤트 유형: "chunk" | "done" | "error"
    pub event_type: String,
    /// 데이터 내용
    pub data: Option<String>,
    /// 오류 정보
    pub error: Option<String>,
    /// 요청 ID, 서로 다른 요청을 구분하는 데 사용
    pub request_id: String,
}

/// AI 메시지 전송 요청 매개변수
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessageRequest {
    pub conversation_id: String,
    pub content: String,
    pub use_context: Option<bool>,
    pub reasoning_enabled: Option<bool>,
}

/// AI 메시지 전송 및 SSE 스트리밍 응답 수신 대기
#[tauri::command]
pub async fn ai_message_send_stream(
    state: State<'_, AppData>,
    body: AiMessageRequest,
    request_id: String,
    on_event: Channel<SseStreamEvent>,
) -> Result<(), String> {
    info!("AI 스트리밍 메시지 요청 전송 시작, body: {:?}", body);

    // ImRequestClient를 사용하여 스트리밍 요청 전송
    let response = {
        let mut rc = state.rc.lock().await;
        let (method, path) = ImUrl::MessageSendStream.get_url();

        rc.request_stream(method, path, Some(body), None::<serde_json::Value>)
            .await
            .map_err(|e| {
                error!("스트리밍 요청 전송 실패: {}", e);
                let error_event = SseStreamEvent {
                    event_type: "error".to_string(),
                    data: None,
                    error: Some(e.to_string()),
                    request_id: request_id.clone(),
                };
                let _ = on_event.send(error_event);
                e.to_string()
            })?
    }; // 여기서 락 해제

    info!("SSE 연결이 설정되었습니다. 스트리밍 데이터 수신 대기 시작...");

    // 백그라운드 작업에서 SSE 이벤트 스트림 처리
    let request_id_clone = request_id.clone();

    tokio::spawn(async move {
        let mut stream = response.bytes_stream();
        let mut full_content = String::new();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    // 바이트를 문자열로 변환
                    if let Ok(text) = String::from_utf8(chunk.to_vec()) {
                        info!("원시 데이터 청크 수신 (길이: {}): {:?}", text.len(), text);
                        buffer.push_str(&text);

                        // SSE 형식 데이터 처리
                        // SSE 형식: data: <content>\n\n
                        while let Some(pos) = buffer.find("\n\n") {
                            let message = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            info!("SSE 메시지 처리: {:?}", message);

                            // SSE 메시지 파싱
                            for line in message.lines() {
                                info!("라인 처리: {:?}", line);

                                if let Some(data) = line.strip_prefix("data: ") {
                                    info!("SSE 데이터 수신: {}", data);

                                    // 내용 누적
                                    full_content.push_str(data);

                                    // 데이터 청크 이벤트를 프론트엔드로 전송
                                    let chunk_event = SseStreamEvent {
                                        event_type: "chunk".to_string(),
                                        data: Some(data.to_string()),
                                        error: None,
                                        request_id: request_id_clone.clone(),
                                    };

                                    if let Err(e) = on_event.send(chunk_event) {
                                        error!("chunk 이벤트 전송 실패: {}", e);
                                    }
                                } else if line.starts_with("data:") {
                                    // 공백이 없는 경우 처리: data:<content>
                                    let data = &line[5..];
                                    info!("SSE 데이터 수신 (공백 없음): {}", data);

                                    // 내용 누적
                                    full_content.push_str(data);

                                    // 데이터 청크 이벤트를 프론트엔드로 전송
                                    let chunk_event = SseStreamEvent {
                                        event_type: "chunk".to_string(),
                                        data: Some(data.to_string()),
                                        error: None,
                                        request_id: request_id_clone.clone(),
                                    };

                                    if let Err(e) = on_event.send(chunk_event) {
                                        error!("chunk 이벤트 전송 실패: {}", e);
                                    }
                                }
                            }
                        }
                    } else {
                        error!("바이트를 UTF-8 문자열로 변환할 수 없습니다");
                    }
                }
                Err(e) => {
                    error!("스트림 데이터 읽기 실패: {}", e);
                    let error_event = SseStreamEvent {
                        event_type: "error".to_string(),
                        data: None,
                        error: Some(e.to_string()),
                        request_id: request_id_clone.clone(),
                    };

                    if let Err(e) = on_event.send(error_event) {
                        error!("error 이벤트 전송 실패: {}", e);
                    }
                    break;
                }
            }
        }

        // 스트림 종료, 완료 이벤트 전송
        info!("SSE 스트림 정상 종료, 총 내용 길이: {}", full_content.len());
        let done_event = SseStreamEvent {
            event_type: "done".to_string(),
            data: Some(full_content),
            error: None,
            request_id: request_id_clone.clone(),
        };

        if let Err(e) = on_event.send(done_event) {
            error!("done 이벤트 전송 실패: {}", e);
        }

        info!("SSE 스트림 처리 완료");
    });

    Ok(())
}
