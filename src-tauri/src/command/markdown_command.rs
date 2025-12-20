use base64::{Engine as _, engine::general_purpose};
use pulldown_cmark::{CowStr, Event, Options, Parser, Tag, html};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 이미지 URL 처리, 상대 경로를 base64 데이터 URI로 변환
fn process_image_url(url: &str, base_dir: &Path) -> String {
    // 절대 URL이거나 이미 데이터 URI인 경우 직접 반환
    if url.starts_with("http://")
        || url.starts_with("https://")
        || url.starts_with("data:")
        || url.starts_with("asset://")
    {
        return url.to_string();
    }

    // 상대 경로 처리
    let img_path = if url.starts_with("./") || url.starts_with("../") {
        base_dir.join(url)
    } else {
        base_dir.join(url)
    };

    // 이미지 파일을 읽고 base64로 변환 시도
    if let Ok(img_data) = fs::read(&img_path) {
        // 파일 확장자에 따라 MIME 유형 결정
        let mime_type = match img_path.extension().and_then(|s| s.to_str()) {
            Some("png") => "image/png",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("gif") => "image/gif",
            Some("svg") => "image/svg+xml",
            Some("webp") => "image/webp",
            _ => "image/png", // 기본값
        };

        // base64로 변환
        let base64_data = general_purpose::STANDARD.encode(&img_data);
        format!("data:{};base64,{}", mime_type, base64_data)
    } else {
        // 읽을 수 없는 경우 원본 URL 반환
        url.to_string()
    }
}

/// markdown 파일을 읽고 HTML로 파싱
#[tauri::command]
pub async fn parse_markdown(app: AppHandle, file_path: String) -> Result<String, String> {
    // 전체 파일 경로 구축
    let full_path = if file_path.starts_with('/') || file_path.starts_with("http") {
        // 절대 경로 또는 URL, 직접 사용
        PathBuf::from(&file_path)
    } else {
        // 상대 경로, 프로젝트 루트 디렉토리부터 시작
        // 개발 모드에서 프로젝트 루트 디렉토리부터 읽기
        // 프로덕션 모드에서 리소스 디렉토리부터 읽기
        let mut possible_paths = vec![
            // 개발 모드 - 프로젝트 루트 디렉토리
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap()
                .join(&file_path),
        ];

        // 프로덕션 모드 - 앱 리소스 디렉토리 (데스크톱 패키징 docs 전용)
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        if let Ok(resource_dir) = app.path().resource_dir() {
            possible_paths.push(resource_dir.join(&file_path));
        }

        // 프로덕션 모드 - 앱 설정 디렉토리 (구버전 설치 경로 호환)
        if let Ok(app_config_dir) = app.path().app_config_dir() {
            possible_paths.push(app_config_dir.join(&file_path));
        }

        // 가능한 모든 경로 시도
        possible_paths
            .into_iter()
            .find(|p| p.exists())
            .ok_or_else(|| format!("파일을 찾을 수 없습니다: {}", file_path))?
    };

    // 파일 내용 읽기
    let markdown_content = fs::read_to_string(&full_path)
        .map_err(|e| format!("파일을 읽을 수 없습니다 {:?}: {}", full_path, e))?;

    // markdown 파싱 옵션 설정
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

    // markdown 파싱
    let parser = Parser::new_ext(&markdown_content, options);

    // 상대 경로 파싱을 위해 markdown 파일 상위 디렉토리 가져오기
    let base_dir = full_path.parent().unwrap_or_else(|| Path::new("."));

    // 이미지 경로 처리
    let events: Vec<Event> = parser
        .map(|event| {
            match event {
                Event::Start(Tag::Image {
                    link_type,
                    dest_url,
                    title,
                    id,
                }) => {
                    // 이미지 URL 처리
                    let new_url = process_image_url(&dest_url, base_dir);
                    Event::Start(Tag::Image {
                        link_type,
                        dest_url: CowStr::from(new_url),
                        title,
                        id,
                    })
                }
                _ => event,
            }
        })
        .collect();

    // HTML로 변환
    let mut html_output = String::new();
    html::push_html(&mut html_output, events.into_iter());

    Ok(html_output)
}

/// README markdown 파일 읽기
#[tauri::command]
#[allow(unused_variables)]
pub async fn get_readme_html(app: AppHandle, language: String) -> Result<String, String> {
    // README 파일 경로 구축
    // 개발 모드에서 프로젝트 루트 디렉토리의 README.md 읽기
    // 프로덕션 모드에서 리소스 디렉토리의 docs 폴더 내 README.md 읽기
    let readme_filename = if language == "zh" {
        "README.md"
    } else {
        "README.en.md"
    };

    let readme_relative_path = Path::new("docs").join(readme_filename);
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();

    let mut possible_paths = vec![];

    #[cfg(dev)]
    {
        // 개발 환경: 프로젝트 루트 디렉토리의 README.md 우선 사용 (로컬 이미지)
        possible_paths.push(project_root.join(readme_filename));

        // 폴백: src-tauri/docs 디렉토리
        possible_paths.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(&readme_relative_path));
    }

    #[cfg(not(dev))]
    {
        // 프로덕션 환경: 패키징된 리소스 디렉토리의 docs/README.md 우선 사용 (원격 이미지)
        // 우선순위 1: 앱 리소스 디렉토리
        #[cfg(not(any(target_os = "android", target_os = "ios")))]
        if let Ok(resource_dir) = app.path().resource_dir() {
            possible_paths.push(resource_dir.join(&readme_relative_path));
        }

        // 우선순위 2: 앱 설정 디렉토리
        if let Ok(app_config_dir) = app.path().app_config_dir() {
            possible_paths.push(app_config_dir.join(&readme_relative_path));
        }

        // 우선순위 3: 루트 디렉토리로 폴백
        possible_paths.push(project_root.join(readme_filename));
    }

    let mut markdown_content = None;
    let mut readme_path = None;
    for path in possible_paths {
        if let Ok(content) = fs::read_to_string(&path) {
            markdown_content = Some(content);
            readme_path = Some(path);
            break;
        }
    }

    let markdown_content =
        markdown_content.ok_or_else(|| format!("{} 파일을 찾을 수 없습니다", readme_filename))?;

    let readme_path = readme_path.unwrap();

    // markdown 파싱 옵션 설정
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

    // markdown 파싱
    let parser = Parser::new_ext(&markdown_content, options);

    // 상대 경로 파싱을 위해 README 파일 상위 디렉토리 가져오기
    let base_dir = readme_path.parent().unwrap_or_else(|| Path::new("."));

    // 이미지 경로 처리
    let events: Vec<Event> = parser
        .map(|event| {
            match event {
                Event::Start(Tag::Image {
                    link_type,
                    dest_url,
                    title,
                    id,
                }) => {
                    // 이미지 URL 처리
                    let new_url = process_image_url(&dest_url, base_dir);
                    Event::Start(Tag::Image {
                        link_type,
                        dest_url: CowStr::from(new_url),
                        title,
                        id,
                    })
                }
                _ => event,
            }
        })
        .collect();

    // HTML로 변환
    let mut html_output = String::new();
    html::push_html(&mut html_output, events.into_iter());

    Ok(html_output)
}
