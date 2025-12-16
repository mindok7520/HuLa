use std::ops::Deref;
use tauri::{Emitter, State};
use tracing::{error, info};

use crate::{
    AppData,
    command::message_command::check_user_init_and_fetch_messages,
    im_request_client::{ImRequest, ImUrl},
    repository::im_user_repository,
    vo::vo::{LoginReq, LoginResp, RefreshTokenReq},
};

#[tauri::command]
pub async fn login_command(
    data: LoginReq,
    state: State<'_, AppData>,
) -> Result<Option<LoginResp>, String> {
    if data.is_auto_login {
        // 자동 로그인 로직
        if let Some(uid) = &data.uid {
            info!("Attempting auto login, user ID: {}", uid);

            // 데이터베이스에서 사용자의 refresh_token 가져오기
            match im_user_repository::get_user_tokens(state.db_conn.deref(), uid).await {
                Ok(Some((_, refresh_token))) => {
                    info!(
                        "Found refresh_token for user {}, attempting to refresh login",
                        uid
                    );

                    // refresh_token을 사용하여 로그인 갱신
                    let refresh_req = RefreshTokenReq {
                        refresh_token: refresh_token.clone(),
                    };

                    let refresh_result = {
                        let mut rc = state.rc.lock().await;
                        rc.refresh_token(refresh_req).await
                    };

                    match refresh_result {
                        Ok(Some(refresh_resp)) => {
                            info!("Auto login successful, user ID: {}", uid);

                            // 새로운 token 정보를 데이터베이스에 저장
                            if let Err(e) = im_user_repository::save_user_tokens(
                                state.db_conn.deref(),
                                uid,
                                &refresh_resp.token,
                                &refresh_resp.refresh_token,
                            )
                            .await
                            {
                                error!("Failed to save new token info: {}", e);
                            }

                            // LoginResp 형식으로 변환하여 반환
                            let login_resp = LoginResp {
                                token: refresh_resp.token,
                                client: "".to_string(), // refresh_token 응답은 일반적으로 client를 포함하지 않음
                                refresh_token: refresh_resp.refresh_token,
                                expire: refresh_resp.expire,
                                uid: refresh_resp.uid,
                            };

                            handle_login_success(&login_resp, &state, data.async_data).await?;

                            return Ok(Some(login_resp));
                        }
                        Ok(None) => {
                            error!("Auto login failed: refresh token returned empty result");
                        }
                        Err(e) => {
                            error!("Auto login failed: refresh token request failed: {}", e);
                        }
                    }
                }
                Ok(None) => {
                    info!("User {} has no saved token info, cannot auto login", uid);
                }
                Err(e) => {
                    error!("Failed to get token info for user {}: {}", uid, e);
                }
            };
            // 자동 로그인 실패, 오류를 반환하여 프론트엔드가 수동 로그인으로 전환하도록 함
            return Err("자동 로그인 실패, 수동으로 로그인해주세요".to_string());
        } else {
            return Err("자동 로그인에 사용자 ID가 누락되었습니다".to_string());
        }
    } else {
        // 수동 로그인 로직
        info!("Performing manual login");

        let async_data = data.async_data;
        let res = {
            let mut rc = state.rc.lock().await;
            rc.login(data).await.map_err(|e| e.to_string())?
        }; // 락이 여기서 해제됨

        // 로그인 성공 후 사용자 정보 및 token 저장 처리
        if let Some(login_resp) = &res {
            handle_login_success(login_resp, &state, async_data).await?;
        }

        info!("Manual login successful");
        Ok(res)
    }
}

async fn handle_login_success(
    login_resp: &LoginResp,
    state: &State<'_, AppData>,
    async_data: bool,
) -> Result<(), String> {
    info!("handle_login_success, login_resp: {:?}", login_resp);
    // 로그인 응답에서 사용자 식별자 가져오기, 여기서는 uid를 uid로 사용
    let uid = &login_resp.uid;

    // 사용자 정보 설정
    let mut user_info = state.user_info.lock().await;
    user_info.uid = login_resp.uid.clone();
    user_info.token = login_resp.token.clone();
    user_info.refresh_token = login_resp.refresh_token.clone();
    info!("handle_login_success, user_info: {:?}", user_info);
    // token 정보를 데이터베이스에 저장
    im_user_repository::save_user_tokens(
        state.db_conn.deref(),
        uid,
        &login_resp.token,
        &login_resp.refresh_token,
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut client = state.rc.lock().await;
    check_user_init_and_fetch_messages(&mut client, state.db_conn.deref(), uid, async_data, false)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[cfg_attr(mobile, allow(unused_variables))]
pub async fn im_request_command(
    state: State<'_, AppData>,
    url: String,
    body: Option<serde_json::Value>,
    params: Option<serde_json::Value>,
    app_handle: tauri::AppHandle,
) -> Result<Option<serde_json::Value>, String> {
    let mut rc = state.rc.lock().await;

    if let Ok(url) = url.parse::<ImUrl>() {
        let result: Result<Option<serde_json::Value>, anyhow::Error> =
            rc.im_request(url, body, params).await;

        match result {
            Ok(data) => {
                return Ok(data);
            }
            Err(e) => {
                tracing::error!("Request error: {}", e);
                if e.to_string().contains("다시 로그인해주세요") {
                    app_handle.emit_to("home", "relogin", ()).unwrap();
                }
                return Err(e.to_string());
            }
        }
    } else {
        tracing::error!("Invalid URL: {}", url);
        return Err(format!("Invalid URL: {}", url));
    }
}
