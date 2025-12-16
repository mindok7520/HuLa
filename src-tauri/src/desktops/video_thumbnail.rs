use base64::{Engine as _, engine::general_purpose};
use image::ImageFormat;
#[cfg(target_os = "macos")]
use image::ImageReader;
use serde::Serialize;
use std::path::Path;
#[cfg(target_os = "macos")]
use std::process::Command;
use tauri::Result as TauriResult;

#[derive(Debug, Clone, Serialize)]
pub struct VideoThumbnailInfo {
    pub thumbnail_base64: String,
    pub width: u32,
    pub height: u32,
    #[cfg(target_os = "macos")]
    pub duration: f64,
}

/// 비디오 썸네일 생성
pub async fn generate_video_thumbnail(
    video_path: &str,
    target_time: Option<f64>,
) -> TauriResult<VideoThumbnailInfo> {
    let path = Path::new(video_path);

    if !path.exists() {
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "비디오 파일이 존재하지 않습니다",
        )));
    }

    // 플랫폼에 따라 다른 구현 선택
    #[cfg(target_os = "macos")]
    {
        generate_thumbnail_macos(video_path, target_time).await
    }

    #[cfg(target_os = "windows")]
    {
        generate_thumbnail_windows(video_path, target_time).await
    }

    #[cfg(target_os = "linux")]
    {
        generate_thumbnail_linux(video_path, target_time).await
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "현재 플랫폼은 비디오 썸네일 생성을 지원하지 않습니다",
        )))
    }
}

#[cfg(target_os = "macos")]
async fn generate_thumbnail_macos(
    video_path: &str,
    _target_time: Option<f64>,
) -> TauriResult<VideoThumbnailInfo> {
    use std::fs;

    // 비디오 파일 존재 여부 확인
    if !Path::new(video_path).exists() {
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("비디오 파일이 존재하지 않습니다: {}", video_path),
        )));
    }

    // macOS 시스템의 qlmanage 도구를 사용하여 썸네일 생성
    let temp_dir = std::env::temp_dir();

    // qlmanage를 사용하여 썸네일 생성
    let output = Command::new("qlmanage")
        .args(&[
            "-t",
            "-s",
            "300", // 썸네일 크기
            "-o",
            temp_dir.to_str().ok_or_else(|| {
                tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "Invalid temp directory path",
                ))
            })?,
            video_path,
        ])
        .output()
        .map_err(|e| {
            tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("qlmanage 실행 실패: {}", e),
            ))
        })?;

    if !output.status.success() {
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!(
                "qlmanage 실행 실패: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        )));
    }

    // 생성된 썸네일 파일 찾기
    let video_file_stem = Path::new(video_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video");

    // 임시 디렉토리의 모든 파일을 나열하여 썸네일 찾기
    let mut generated_thumbnail = None;
    if let Ok(entries) = fs::read_dir(&temp_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(name) = entry.file_name().to_str() {
                    if name.contains(&video_file_stem) && name.ends_with(".png") {
                        generated_thumbnail = Some(entry.path());
                        break;
                    }
                }
            }
        }
    }

    let thumbnail_path = if let Some(path) = generated_thumbnail {
        path
    } else {
        // 찾지 못한 경우 기본 경로 시도
        let default_path = temp_dir.join(format!("{}.png", video_file_stem));
        if default_path.exists() {
            default_path
        } else {
            return Err(tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!(
                    "생성된 썸네일 파일을 찾을 수 없습니다, video_file_stem: {}",
                    video_file_stem
                ),
            )));
        }
    };

    // 생성된 썸네일 읽기
    let thumbnail_data = tokio::fs::read(&thumbnail_path).await.map_err(|e| {
        tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("썸네일 읽기 실패: {}", e),
        ))
    })?;

    // 이미지 크기 가져오기
    let img = ImageReader::new(std::io::Cursor::new(&thumbnail_data))
        .with_guessed_format()
        .map_err(|e| {
            tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("이미지 형식 읽기 실패: {}", e),
            ))
        })?
        .decode()
        .map_err(|e| {
            tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("이미지 디코딩 실패: {}", e),
            ))
        })?;

    let width = img.width();
    let height = img.height();

    // RGB 형식으로 변환(투명도 채널 제거) 후 JPEG로 변환
    let rgb_img = img.to_rgb8();
    let mut jpeg_data = Vec::new();

    image::DynamicImage::ImageRgb8(rgb_img)
        .write_to(&mut std::io::Cursor::new(&mut jpeg_data), ImageFormat::Jpeg)
        .map_err(|e| {
            tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("JPEG 변환 실패: {}", e),
            ))
        })?;

    // base64로 변환
    let base64_string = general_purpose::STANDARD.encode(&jpeg_data);

    // 임시 파일 정리
    let _ = tokio::fs::remove_file(&thumbnail_path).await;

    // 비디오 길이 가져오기 (mdls 명령 사용)
    let duration = get_video_duration_macos(video_path).await.unwrap_or(0.0);

    Ok(VideoThumbnailInfo {
        thumbnail_base64: base64_string,
        width,
        height,
        #[cfg(target_os = "macos")]
        duration,
    })
}

#[cfg(target_os = "macos")]
async fn get_video_duration_macos(video_path: &str) -> Option<f64> {
    let output = Command::new("mdls")
        .args(&["-name", "kMDItemDurationSeconds", video_path])
        .output()
        .ok()?;

    if output.status.success() {
        let output_str = String::from_utf8_lossy(&output.stdout);
        // 출력 형식 파싱: "kMDItemDurationSeconds = 123.456"
        if let Some(duration_str) = output_str.split('=').nth(1) {
            duration_str.trim().parse().ok()
        } else {
            None
        }
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
unsafe fn convert_hbitmap_to_image_data(
    hbitmap: windows::Win32::Graphics::Gdi::HBITMAP,
) -> TauriResult<(u32, u32, Vec<u8>)> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::*;

    unsafe {
        // 비트맵 정보 가져오기
        let mut bitmap = BITMAP::default();
        let result = GetObjectW(
            hbitmap.into(),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bitmap as *mut _ as *mut _),
        );

        if result == 0 {
            return Err(tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                "비트맵 정보 가져오기 실패",
            )));
        }

        let width = bitmap.bmWidth as u32;
        let height = bitmap.bmHeight as u32;

        // 장치 컨텍스트 생성
        let hdc = GetDC(Some(HWND::default()));
        if hdc.is_invalid() {
            return Err(tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                "장치 컨텍스트 생성 실패",
            )));
        }

        let mem_dc = CreateCompatibleDC(Some(hdc));
        if mem_dc.is_invalid() {
            ReleaseDC(Some(HWND::default()), hdc);
            return Err(tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                "호환되는 장치 컨텍스트 생성 실패",
            )));
        }

        // 메모리 DC에 비트맵 선택
        let old_bitmap = SelectObject(mem_dc, hbitmap.into());

        // 비트맵 정보 헤더 준비
        let mut bmp_info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32), // 음수 값은 위에서 아래로를 나타냄
                biPlanes: 1,
                biBitCount: 24, // RGB 형식
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        // 이미지 데이터 크기 계산
        let stride = ((width * 3 + 3) / 4) * 4; // 4바이트 정렬
        let data_size = stride * height;
        let mut image_data = vec![0u8; data_size as usize];

        // 비트맵 데이터 가져오기
        let result = GetDIBits(
            mem_dc,
            hbitmap,
            0,
            height,
            Some(image_data.as_mut_ptr() as *mut _),
            &mut bmp_info,
            DIB_RGB_COLORS,
        );

        // 리소스 정리
        SelectObject(mem_dc, old_bitmap);
        let _ = DeleteDC(mem_dc);
        ReleaseDC(Some(HWND::default()), hdc);

        if result == 0 {
            return Err(tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                "비트맵 데이터 가져오기 실패",
            )));
        }

        // BGR을 RGB로 변환하고 패딩 제거
        let mut rgb_data = Vec::with_capacity((width * height * 3) as usize);
        for y in 0..height {
            for x in 0..width {
                let offset = (y * stride + x * 3) as usize;
                if offset + 2 < image_data.len() {
                    // BGR을 RGB로 변환
                    rgb_data.push(image_data[offset + 2]); // R
                    rgb_data.push(image_data[offset + 1]); // G
                    rgb_data.push(image_data[offset]); // B
                }
            }
        }

        Ok((width, height, rgb_data))
    }
}

#[cfg(target_os = "windows")]
async fn generate_thumbnail_windows(
    video_path: &str,
    _target_time: Option<f64>,
) -> TauriResult<VideoThumbnailInfo> {
    use windows::{Win32::Foundation::*, Win32::System::Com::*, Win32::UI::Shell::*, core::*};

    // 비디오 파일 존재 여부 확인
    if !Path::new(video_path).exists() {
        return Err(tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("비디오 파일이 존재하지 않습니다: {}", video_path),
        )));
    }

    // COM 초기화
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| {
                tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("COM 초기화 실패: {:?}", e),
                ))
            })?;
    }

    let result = unsafe {
        // 파일 경로를 와이드 문자로 변환
        let video_path_wide: Vec<u16> = video_path
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let video_path_pcwstr = PCWSTR(video_path_wide.as_ptr());

        // ShellItem 생성
        let shell_item: IShellItem =
            SHCreateItemFromParsingName(video_path_pcwstr, None).map_err(|e| {
                tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("ShellItem 생성 실패: {:?}", e),
                ))
            })?;

        // 썸네일 가져오기
        let image_factory: IShellItemImageFactory = shell_item.cast().map_err(|e| {
            tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("이미지 팩토리 가져오기 실패: {:?}", e),
            ))
        })?;

        // 썸네일 크기 설정
        let size = SIZE { cx: 300, cy: 300 };

        // 썸네일 HBITMAP 가져오기
        let hbitmap = image_factory
            .GetImage(size, SIIGBF_RESIZETOFIT)
            .map_err(|e| {
                tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("썸네일 가져오기 실패, 비디오 형식이 지원되지 않을 수 있음: {:?}", e),
                ))
            })?;

        // HBITMAP을 이미지 데이터로 변환
        convert_hbitmap_to_image_data(hbitmap)
    };

    // COM 정리
    unsafe {
        CoUninitialize();
    }

    let (width, height, image_data) = result?;

    // 이미지 생성 및 JPEG로 변환
    let img = image::RgbImage::from_raw(width, height, image_data).ok_or_else(|| {
        tauri::Error::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            "이미지 생성 실패",
        ))
    })?;

    let mut jpeg_data = Vec::new();
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut std::io::Cursor::new(&mut jpeg_data), ImageFormat::Jpeg)
        .map_err(|e| {
            tauri::Error::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("JPEG 변환 실패: {}", e),
            ))
        })?;

    // base64로 변환
    let base64_string = general_purpose::STANDARD.encode(&jpeg_data);

    Ok(VideoThumbnailInfo {
        thumbnail_base64: base64_string,
        width,
        height,
    })
}

#[cfg(target_os = "linux")]
async fn generate_thumbnail_linux(
    _video_path: &str,
    _target_time: Option<f64>,
) -> TauriResult<VideoThumbnailInfo> {
    // Linux 구현은 gstreamer 또는 기타 솔루션을 사용할 수 있음
    Err(tauri::Error::Io(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Linux 플랫폼은 현재 비디오 썸네일 생성을 지원하지 않습니다",
    )))
}

/// Tauri 명령: 비디오 썸네일 생성
#[tauri::command]
pub async fn get_video_thumbnail(
    video_path: String,
    target_time: Option<f64>,
) -> Result<VideoThumbnailInfo, String> {
    generate_video_thumbnail(&video_path, target_time)
        .await
        .map_err(|e| e.to_string())
}
