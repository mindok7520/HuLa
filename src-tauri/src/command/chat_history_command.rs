use crate::AppData;
use crate::command::message_command::MessageResp;
use crate::repository::im_message_repository;

use serde::{Deserialize, Serialize};
use std::ops::Deref;
use tauri::State;
use tracing::{error, info};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistoryQueryParam {
    pub room_id: String,
    pub message_type: Option<String>, // "all", "image", "file"
    pub search_keyword: Option<String>,
    pub sort_order: Option<String>, // "asc", "desc"
    pub date_range: Option<DateRange>,
    pub pagination: PaginationParam,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DateRange {
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaginationParam {
    pub page: u32,
    pub page_size: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistoryResponse {
    pub messages: Vec<MessageResp>,
    pub has_more: bool,
    pub current_page: u32,
}

/// 채팅 기록 조회를 위한 Tauri 명령
#[tauri::command]
pub async fn query_chat_history(
    param: ChatHistoryQueryParam,
    state: State<'_, AppData>,
) -> Result<ChatHistoryResponse, String> {
    info!(
        "채팅 기록 조회 - 방 ID: {}, 메시지 유형: {:?}, 검색 키워드: {:?}, 정렬: {:?}, 페이지 번호: {}",
        param.room_id,
        param.message_type,
        param.search_keyword,
        param.sort_order,
        param.pagination.page
    );

    // 현재 로그인한 사용자의 uid 가져오기
    let login_uid = {
        let user_info = state.user_info.lock().await;
        user_info.uid.clone()
    };

    // 조회 조건 구축
    let query_condition = ChatHistoryQueryCondition {
        room_id: param.room_id.clone(),
        login_uid: login_uid.clone(),
        message_type: parse_message_type(&param.message_type),
        search_keyword: param.search_keyword.clone(),
        sort_order: parse_sort_order(&param.sort_order),
        date_range: param.date_range.clone(),
        pagination: param.pagination.clone(),
    };

    // 데이터베이스 조회
    let messages =
        im_message_repository::query_chat_history(state.db_conn.deref(), query_condition)
            .await
            .map_err(|e| {
                error!("채팅 기록 조회 실패: {}", e);
                e.to_string()
            })?;

    // 응답 형식으로 변환
    let message_resps: Vec<MessageResp> = messages
        .into_iter()
        .map(|msg| crate::command::message_command::convert_message_to_resp(msg, None))
        .collect();

    // 반환된 메시지 수에 따라 데이터가 더 있는지 판단
    let has_more = message_resps.len() >= param.pagination.page_size as usize;

    let response = ChatHistoryResponse {
        messages: message_resps,
        has_more,
        current_page: param.pagination.page,
    };

    Ok(response)
}

/// 내부 조회 조건 구조
#[derive(Debug, Clone)]
pub struct ChatHistoryQueryCondition {
    pub room_id: String,
    pub login_uid: String,
    pub message_type: Option<Vec<u8>>,
    pub search_keyword: Option<String>,
    pub sort_order: SortOrder,
    pub date_range: Option<DateRange>,
    pub pagination: PaginationParam,
}

#[derive(Debug, Clone)]
pub enum SortOrder {
    Asc,
    Desc,
}

/// 메시지 유형 필터링 조건 파싱
fn parse_message_type(message_type: &Option<String>) -> Option<Vec<u8>> {
    match message_type {
        Some(msg_type) => match msg_type.as_str() {
            "image" => {
                // 이미지 및 비디오 유형의 메시지 유형 ID
                // 프로젝트의 실제 메시지 유형 열거형에 따라 이 값들을 정의함
                Some(vec![3, 6]) // 3=이미지, 6=비디오로 가정
            }
            "file" => {
                // 파일 유형의 메시지 유형 ID
                Some(vec![4]) // 4=파일로 가정
            }
            "all" | _ => None, // 필터링하지 않고 모든 유형 반환
        },
        None => None,
    }
}

/// 정렬 방식 파싱
fn parse_sort_order(sort_order: &Option<String>) -> SortOrder {
    match sort_order {
        Some(order) => match order.as_str() {
            "asc" => SortOrder::Asc,
            "desc" | _ => SortOrder::Desc,
        },
        None => SortOrder::Desc, // 기본 내림차순 (최신순)
    }
}
