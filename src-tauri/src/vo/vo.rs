use serde::{Deserialize, Serialize};
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MyRoomInfoReq {
    pub id: String,
    // 내 그룹 닉네임
    pub my_name: String,
    // 그룹 메모
    pub remark: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageReq {
    pub id: String,
    pub room_id: Option<String>,
    pub msg_type: Option<u8>,
    pub body: Option<serde_json::Value>,
    pub skip: Option<bool>,
    pub is_temp: Option<bool>,
    pub is_push_message: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoginReq {
    pub grant_type: String,
    pub system_type: String,
    pub device_type: String,
    pub client_id: String,
    pub account: String,
    pub password: String,
    #[serde(default)]
    pub is_auto_login: bool,
    pub async_data: bool,
    pub uid: Option<String>, // 자동 로그인 시 사용자 ID 전달에 사용
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LoginResp {
    pub token: String,
    pub client: String,
    pub refresh_token: String,
    pub uid: String,
    pub expire: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RefreshTokenReq {
    pub refresh_token: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RefreshTokenResp {
    pub token: String,
    pub refresh_token: String,
    pub expire: String,
    pub uid: String,
}
