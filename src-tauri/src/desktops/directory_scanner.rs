use async_walkdir::WalkDir as AsyncWalkDir;
use futures::stream::StreamExt;
use serde::Serialize;
use std::path::PathBuf;
use std::time::Instant;
use sysinfo::Disks;
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;

#[derive(Serialize)]
pub struct DirectoryInfo {
    pub path: String,
    pub total_size: u64,
    pub disk_mount_point: String,
    pub disk_total_space: u64,
    pub disk_used_space: u64,
    pub disk_usage_percentage: f64,
    pub usage_percentage: f64,
}

#[derive(Serialize, Clone)]
pub struct DirectoryScanProgress {
    pub current_path: String,
    pub files_processed: u64,
    pub total_size: u64,
    pub elapsed_time: u64,
    pub elapsed_seconds: f64,
    pub progress_percentage: f64,
}

lazy_static::lazy_static! {
    static ref CANCEL_SENDER: broadcast::Sender<()> = {
        let (tx, _) = broadcast::channel(1);
        tx
    };
}

/// 진행 이벤트가 포함된 디렉토리 크기 스캔
async fn get_directory_size_with_progress(
    directory_path: String,
    handle: AppHandle,
) -> Result<u64, String> {
    // 너무 큰 디렉토리를 스캔할 때 무기한 실행되는 것을 방지하기 위해 전체 타임아웃 메커니즘 추가
    let timeout_duration = tokio::time::Duration::from_secs(300); // 5분 타임아웃

    match tokio::time::timeout(
        timeout_duration,
        scan_directory_internal(directory_path, handle),
    )
    .await
    {
        Ok(result) => result,
        Err(_) => {
            tracing::warn!("Directory scan timeout, automatically cancelled");
            Err("디렉토리 스캔 시간 초과, 더 작은 디렉토리를 스캔해 보세요".to_string())
        }
    }
}

async fn scan_directory_internal(directory_path: String, handle: AppHandle) -> Result<u64, String> {
    let path = PathBuf::from(&directory_path);

    if !path.exists() {
        return Err("디렉토리가 존재하지 않습니다".to_string());
    }

    if !path.is_dir() {
        return Err("지정된 경로가 디렉토리가 아닙니다".to_string());
    }

    // 취소 수신기 생성
    let mut cancel_receiver = CANCEL_SENDER.subscribe();

    let start_time = Instant::now();

    // 1. 빠른 사전 스캔으로 총 파일 수 계산
    let mut total_files = 0u64;
    let mut entries = AsyncWalkDir::new(&path);

    let _ = handle.emit(
        "directory-scan-progress",
        &DirectoryScanProgress {
            current_path: "파일 수 계산 중...".to_string(),
            files_processed: 0,
            total_size: 0,
            elapsed_time: 0,
            elapsed_seconds: 0.0,
            progress_percentage: 0.0,
        },
    );

    loop {
        tokio::select! {
            // 취소 신호 확인
            _ = cancel_receiver.recv() => {
                let _ = handle.emit("directory-scan-cancelled", ());
                return Err("扫描已取消".to_string());
            }
            // 파일 스캔 처리
            entry = entries.next() => {
                match entry {
                    Some(Ok(entry)) => {
                        if entry.file_type().await.map_or(false, |ft| ft.is_file()) {
                            total_files += 1;
                        }
                    }
                    Some(Err(_)) => continue,
                    None => break, // 스캔 완료
                }
            }
        }
    }

    // 2. 실제 스캔 및 정확한 진행률 계산
    let mut total_size = 0u64;
    let mut files_processed = 0u64;
    let mut last_progress_time = Instant::now();

    let mut entries = AsyncWalkDir::new(&path);

    loop {
        tokio::select! {
            // 检查取消信号
            _ = cancel_receiver.recv() => {
                let _ = handle.emit("directory-scan-cancelled", ());
                return Err("扫描已取消".to_string());
            }
            // 파일 스캔 처리
            entry = entries.next() => {
                match entry {
                    Some(Ok(entry)) => {
                        if entry.file_type().await.map_or(false, |ft| ft.is_file()) {
                            match entry.metadata().await {
                                Ok(metadata) => {
                                    total_size = total_size.saturating_add(metadata.len());
                                    files_processed += 1;

                                    // 진행률 업데이트: 200ms마다 또는 100개 파일마다 한 번씩 전송
                                    let now = Instant::now();
                                    if now.duration_since(last_progress_time).as_millis() > 200
                                        || files_processed % 100 == 0
                                    {
                                        last_progress_time = now;

                                        // 이벤트를 전송해야 할 때만 경로 변환
                                        let current_path = entry.path().to_string_lossy().to_string();

                                        let elapsed = now.duration_since(start_time).as_millis() as u64;
                                        let elapsed_seconds = elapsed as f64 / 1000.0;

                                        // 정확한 진행률 백분율 계산
                                        let progress_percentage = if total_files > 0 {
                                            (files_processed as f64 / total_files as f64) * 100.0
                                        } else {
                                            0.0
                                        };

                                        let progress = DirectoryScanProgress {
                                            current_path: current_path.clone(),
                                            files_processed,
                                            total_size,
                                            elapsed_time: elapsed,
                                            elapsed_seconds,
                                            progress_percentage,
                                        };

                                        let _ = handle.emit("directory-scan-progress", &progress);
                                    }
                                }
                                Err(_) => continue,
                            }
                        }
                    }
                    Some(Err(_)) => continue,
                    None => break, // 스캔 완료
                }
            }
        }
    }

    let final_elapsed = start_time.elapsed().as_millis() as u64;
    let final_elapsed_seconds = final_elapsed as f64 / 1000.0;

    let final_progress = DirectoryScanProgress {
        current_path: "스캔 완료".to_string(),
        files_processed,
        total_size,
        elapsed_time: final_elapsed,
        elapsed_seconds: final_elapsed_seconds,
        progress_percentage: 100.0,
    };

    let _ = handle.emit("directory-scan-complete", &final_progress);

    Ok(total_size)
}

/// 디렉토리 스캔 취소
#[tauri::command]
pub fn cancel_directory_scan() -> Result<(), String> {
    // 취소 신호를 보내 진행 중인 모든 스캔을 즉시 중단
    let _ = CANCEL_SENDER.send(());
    Ok(())
}

/// 진행 이벤트가 포함된 디렉토리 사용 정보
#[tauri::command]
pub async fn get_directory_usage_info_with_progress(
    directory_path: String,
    handle: AppHandle,
) -> Result<DirectoryInfo, String> {
    let total_size = get_directory_size_with_progress(directory_path.clone(), handle).await?;

    let path = PathBuf::from(&directory_path);
    let path_str = path.to_string_lossy().to_string();

    let disks = Disks::new_with_refreshed_list();

    let mut best_match = String::new();
    let mut best_match_len = 0;
    let mut disk_total_space = 0u64;
    let mut disk_available_space = 0u64;

    for disk in &disks {
        let mount_point = disk.mount_point().to_string_lossy().to_string();

        // Windows에서 경로 비교 시 경로 구분 기호 처리 필요
        let normalized_path = path_str.replace('\\', "/");
        let normalized_mount_point = mount_point.replace('\\', "/");

        if normalized_path.starts_with(&normalized_mount_point)
            && mount_point.len() > best_match_len
        {
            best_match_len = mount_point.len();
            disk_total_space = disk.total_space();
            disk_available_space = disk.available_space();
            best_match = mount_point;
        }
    }

    if best_match.is_empty() {
        return Err("디렉토리가 있는 디스크를 찾을 수 없습니다".to_string());
    }

    let usage_percentage = if disk_total_space > 0 {
        (total_size as f64 / disk_total_space as f64) * 100.0
    } else {
        0.0
    };

    // 디스크 사용 공간 및 사용 비율 계산
    let disk_used_space = disk_total_space.saturating_sub(disk_available_space);
    let disk_usage_percentage = if disk_total_space > 0 {
        (disk_used_space as f64 / disk_total_space as f64) * 100.0
    } else {
        0.0
    };

    Ok(DirectoryInfo {
        path: directory_path,
        total_size,
        disk_mount_point: best_match,
        disk_total_space,
        disk_used_space,
        disk_usage_percentage,
        usage_percentage,
    })
}
