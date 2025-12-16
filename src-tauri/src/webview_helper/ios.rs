use std::{
    cell::RefCell,
    ptr::NonNull,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

use objc2::{
    DefinedClass, MainThreadMarker, MainThreadOnly, define_class, msg_send,
    rc::Retained,
    runtime::{AnyObject, ProtocolObject},
};
use objc2_core_foundation::{CGPoint, CGRect};
use objc2_foundation::{
    NSDictionary, NSNotification, NSNotificationCenter, NSNotificationName, NSNumber, NSObject,
    NSObjectProtocol, NSString, NSTimeInterval, NSValue,
};
use objc2_ui_kit::{
    UIColor, UIKeyboardDidShowNotification, UIKeyboardWillHideNotification,
    UIKeyboardWillShowNotification, UIScrollView, UIScrollViewContentInsetAdjustmentBehavior,
    UIScrollViewDelegate, UIView, UIViewAnimationOptions, UIWebView,
};
use tauri::WebviewWindow;

thread_local! {
    static KEYBOARD_DELEGATE: RefCell<Option<KeyboardDelegateHolder>> = RefCell::new(None);
}

static SHOULD_ADJUST: AtomicBool = AtomicBool::new(false);

/// 전역 플래그를 읽어 현재 키보드 표시 시 처리 모드(조정 또는 잠금)를 결정합니다.
#[inline]
fn should_adjust() -> bool {
    SHOULD_ADJUST.load(Ordering::SeqCst)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum KeyboardHandlingMode {
    None,
    Adjust,
    Lock,
}

enum KeyboardDelegateHolder {
    Adjust(Retained<KeyboardScrollPreventDelegate>),
    Lock(Retained<KeyboardLockDelegate>),
}

/// iOS WebView의 키보드 처리 로직을 초기화하고 알림을 등록하며 모드에 따라 레이아웃을 조정하거나 스크롤을 잠급니다.
pub fn initialize_keyboard_adjustment(webview_window: &WebviewWindow) {
    let _ = webview_window.with_webview(|webview| unsafe {
        #[allow(deprecated)]
        let webview: &UIWebView = &*webview.inner().cast();
        let notification_center = NSNotificationCenter::defaultCenter();
        let main_thread = MainThreadMarker::from(webview);
        let background_color = UIColor::colorWithRed_green_blue_alpha(
            243.0 / 255.0,
            251.0 / 255.0,
            248.0 / 255.0,
            1.0,
        );

        webview.setOpaque(false);
        webview.setBackgroundColor(Some(&background_color));

        let scroll_view_arc = Arc::new(webview.scrollView());
        scroll_view_arc.setBackgroundColor(Some(&background_color));
        let old_delegate_arc = Arc::new(Mutex::new(None));
        let handling_mode_arc = Arc::new(Mutex::new(KeyboardHandlingMode::None));

        scroll_view_arc
            .setContentInsetAdjustmentBehavior(UIScrollViewContentInsetAdjustmentBehavior::Never);

        // 누적 조정을 방지하기 위해 원래 상태 기록
        let keyboard_height_arc = Arc::new(Mutex::new(0f64));
        let original_frame_arc = Arc::new(Mutex::new(webview.frame()));
        let original_inset_arc = Arc::new(Mutex::new(scroll_view_arc.contentInset()));
        let webview_arc = Arc::new(
            Retained::retain(webview as *const _ as *mut UIWebView)
                .expect("Failed to retain UIWebView reference"),
        );

        let scroll_view_arc_observer = scroll_view_arc.clone();
        let old_delegate_arc_will_show = old_delegate_arc.clone();
        let keyboard_height_arc_observer = keyboard_height_arc.clone();
        let original_frame_arc_observer = original_frame_arc.clone();
        let original_inset_arc_observer = original_inset_arc.clone();
        let handling_mode_arc_observer = handling_mode_arc.clone();
        let webview_arc_observer = webview_arc.clone();
        // 키보드가 곧 표시되는 것을 모니터링하고 모드에 따라 레이아웃과 스크롤을 조정합니다.
        create_observer(
            &notification_center,
            &UIKeyboardWillShowNotification,
            move |notification| {
                let desired_mode = if should_adjust() {
                    KeyboardHandlingMode::Adjust
                } else {
                    KeyboardHandlingMode::Lock
                };

                {
                    let mut mode = handling_mode_arc_observer.lock().unwrap();
                    *mode = desired_mode;
                }

                let mut old_delegate = old_delegate_arc_will_show.lock().unwrap();
                *old_delegate = scroll_view_arc_observer.delegate();

                match desired_mode {
                    KeyboardHandlingMode::Adjust => {
                        unsafe {
                            let scroll_view_ptr = (&**scroll_view_arc_observer)
                                as *const UIScrollView
                                as *mut UIScrollView;
                            let _: () = msg_send![
                                scroll_view_ptr,
                                setShowsVerticalScrollIndicator: true
                            ];
                            let _: () = msg_send![
                                scroll_view_ptr,
                                setShowsHorizontalScrollIndicator: true
                            ];
                            let _: () = msg_send![scroll_view_ptr, setBounces: true];
                        }

                        let new_delegate = KeyboardScrollPreventDelegate::new(
                            main_thread,
                            scroll_view_arc_observer.clone(),
                            scroll_view_arc_observer.contentOffset(),
                        );

                        KEYBOARD_DELEGATE.with(|cell| {
                            *cell.borrow_mut() = Some(KeyboardDelegateHolder::Adjust(new_delegate));
                        });

                        KEYBOARD_DELEGATE.with(|cell| {
                            if let Some(KeyboardDelegateHolder::Adjust(delegate)) =
                                cell.borrow().as_ref()
                            {
                                let delegate_obj = ProtocolObject::from_ref(&**delegate);
                                scroll_view_arc_observer.setDelegate(Some(delegate_obj));
                            }
                        });
                    }
                    KeyboardHandlingMode::Lock => {
                        let new_delegate = KeyboardLockDelegate::new(
                            main_thread,
                            scroll_view_arc_observer.clone(),
                            webview_arc_observer.clone(),
                            scroll_view_arc_observer.contentOffset(),
                        );

                        KEYBOARD_DELEGATE.with(|cell| {
                            *cell.borrow_mut() = Some(KeyboardDelegateHolder::Lock(new_delegate));
                        });

                        KEYBOARD_DELEGATE.with(|cell| {
                            if let Some(KeyboardDelegateHolder::Lock(delegate)) =
                                cell.borrow().as_ref()
                            {
                                let delegate_obj = ProtocolObject::from_ref(&**delegate);
                                scroll_view_arc_observer.setDelegate(Some(delegate_obj));
                            }
                        });

                        unsafe {
                            let scroll_view_ptr = (&**scroll_view_arc_observer)
                                as *const UIScrollView
                                as *mut UIScrollView;
                            let _: () = msg_send![
                                scroll_view_ptr,
                                setShowsVerticalScrollIndicator: false
                            ];
                            let _: () = msg_send![
                                scroll_view_ptr,
                                setShowsHorizontalScrollIndicator: false
                            ];
                            let _: () = msg_send![scroll_view_ptr, setBounces: false];
                        }

                        // 복원 로직이 잘못 트리거되는 것을 방지하기 위해 키보드 높이 정리
                        let mut keyboard_height = keyboard_height_arc_observer.lock().unwrap();
                        *keyboard_height = 0.0;

                        // 잠금 모드에서는 아래의 높이 조정 로직을 실행할 필요가 없음
                        return;
                    }
                    KeyboardHandlingMode::None => unreachable!(),
                };

                let user_info: *mut NSDictionary<NSString, AnyObject> =
                    msg_send![notification, userInfo];
                if user_info.is_null() {
                    return;
                }

                let frame_key = NSString::from_str("UIKeyboardFrameEndUserInfoKey");
                let value: *mut NSValue = msg_send![user_info, objectForKey: &*frame_key];
                if value.is_null() {
                    return;
                }

                let keyboard_rect: CGRect = msg_send![value, CGRectValue];
                let new_keyboard_height = keyboard_rect.size.height;

                let original_frame = *original_frame_arc_observer.lock().unwrap();
                let mut adjusted_frame = original_frame;
                adjusted_frame.size.height -= new_keyboard_height;

                let original_inset = *original_inset_arc_observer.lock().unwrap();
                let mut adjusted_inset = original_inset;
                adjusted_inset.bottom += new_keyboard_height;

                {
                    let mut keyboard_height = keyboard_height_arc_observer.lock().unwrap();
                    *keyboard_height = new_keyboard_height as f64;
                }

                let duration_key = NSString::from_str("UIKeyboardAnimationDurationUserInfoKey");
                let duration_value: *mut NSNumber =
                    msg_send![user_info, objectForKey: &*duration_key];
                let duration: NSTimeInterval = {
                    duration_value
                        .as_ref()
                        .map(|number| number.doubleValue() as NSTimeInterval)
                        .unwrap_or(0.25)
                };

                let curve_key = NSString::from_str("UIKeyboardAnimationCurveUserInfoKey");
                let curve_value: *mut NSNumber = msg_send![user_info, objectForKey: &*curve_key];
                let curve_bits = {
                    curve_value
                        .as_ref()
                        .map(|number| (number.integerValue() as u64) << 16)
                        .unwrap_or(UIViewAnimationOptions::CurveEaseInOut.bits() as u64)
                };

                let mut options = UIViewAnimationOptions::BeginFromCurrentState
                    | UIViewAnimationOptions::AllowUserInteraction;
                options |= UIViewAnimationOptions::from_bits_retain(curve_bits as _);

                let scroll_view_for_animation = scroll_view_arc_observer.clone();
                let animation_block = block2::StackBlock::new(move || {
                    // Match the keyboard transition to avoid visible jumps.
                    scroll_view_for_animation.setContentInset(adjusted_inset);
                    scroll_view_for_animation.setScrollIndicatorInsets(adjusted_inset);
                    webview.setFrame(adjusted_frame);
                })
                .copy();

                unsafe {
                    UIView::animateWithDuration_delay_options_animations_completion(
                        duration,
                        0.0,
                        options,
                        &animation_block,
                        None,
                        main_thread,
                    );
                }
            },
        );

        let scroll_view_arc_observer = scroll_view_arc.clone();
        let old_delegate_arc_will_hide = old_delegate_arc.clone();
        let keyboard_height_arc_observer = keyboard_height_arc.clone();
        let original_frame_arc_observer = original_frame_arc.clone();
        let original_inset_arc_observer = original_inset_arc.clone();
        let handling_mode_arc_observer = handling_mode_arc.clone();
        let webview_arc_observer = webview_arc.clone();
        // 키보드가 곧 숨겨지는 것을 모니터링하고 초기 레이아웃을 복원하거나 편집을 종료합니다.
        create_observer(
            &notification_center,
            &UIKeyboardWillHideNotification,
            move |notification| {
                let current_mode = *handling_mode_arc_observer.lock().unwrap();

                if current_mode == KeyboardHandlingMode::Adjust {
                    let keyboard_height = keyboard_height_arc_observer.lock().unwrap();
                    if *keyboard_height <= 0.0 {
                        return;
                    }
                    drop(keyboard_height);

                    let user_info: *mut NSDictionary<NSString, AnyObject> =
                        msg_send![notification, userInfo];

                    let duration_key = NSString::from_str("UIKeyboardAnimationDurationUserInfoKey");
                    let duration_value: *mut NSNumber =
                        msg_send![user_info, objectForKey: &*duration_key];
                    let duration: NSTimeInterval = {
                        duration_value
                            .as_ref()
                            .map(|number| number.doubleValue() as NSTimeInterval)
                            .unwrap_or(0.25)
                    };

                    let curve_key = NSString::from_str("UIKeyboardAnimationCurveUserInfoKey");
                    let curve_value: *mut NSNumber =
                        msg_send![user_info, objectForKey: &*curve_key];
                    let curve_bits = {
                        curve_value
                            .as_ref()
                            .map(|number| (number.integerValue() as u64) << 16)
                            .unwrap_or(UIViewAnimationOptions::CurveEaseInOut.bits() as u64)
                    };

                    let mut options = UIViewAnimationOptions::BeginFromCurrentState
                        | UIViewAnimationOptions::AllowUserInteraction;
                    options |= UIViewAnimationOptions::from_bits_retain(curve_bits as _);

                    let original_frame = *original_frame_arc_observer.lock().unwrap();
                    let original_inset = *original_inset_arc_observer.lock().unwrap();

                    let scroll_view_for_animation = scroll_view_arc_observer.clone();
                    let animation_block = block2::StackBlock::new(move || {
                        // 키보드 애니메이션에 따라 초기 레이아웃 복원
                        scroll_view_for_animation.setContentInset(original_inset);
                        scroll_view_for_animation.setScrollIndicatorInsets(original_inset);
                        webview.setFrame(original_frame);
                    })
                    .copy();

                    unsafe {
                        UIView::animateWithDuration_delay_options_animations_completion(
                            duration,
                            0.0,
                            options,
                            &animation_block,
                            None,
                            main_thread,
                        );
                    }

                    let mut keyboard_height = keyboard_height_arc_observer.lock().unwrap();
                    *keyboard_height = 0.0;
                    let mut mode = handling_mode_arc_observer.lock().unwrap();
                    *mode = KeyboardHandlingMode::None;
                } else if current_mode == KeyboardHandlingMode::Lock {
                    // 잠금 모드에서는 스크롤 뷰의 기본 동작을 복원하고 키보드를 숨김 상태로 유지
                    let webview_ptr =
                        (&**webview_arc_observer) as *const UIWebView as *mut UIWebView;
                    let _: () = msg_send![webview_ptr, endEditing: true];

                    unsafe {
                        let scroll_view_ptr = (&**scroll_view_arc_observer) as *const UIScrollView
                            as *mut UIScrollView;
                        let _: () = msg_send![
                            scroll_view_ptr,
                            setShowsVerticalScrollIndicator: true
                        ];
                        let _: () = msg_send![
                            scroll_view_ptr,
                            setShowsHorizontalScrollIndicator: true
                        ];
                        let _: () = msg_send![scroll_view_ptr, setBounces: true];
                    }

                    KEYBOARD_DELEGATE.with(|cell| {
                        *cell.borrow_mut() = None;
                    });

                    let mut old_delegate = old_delegate_arc_will_hide.lock().unwrap();
                    // 원래 UIScrollViewDelegate를 복원하여 키보드 로직이 끝난 후 동작이 기본값으로 돌아가도록 함
                    if let Some(delegate) = old_delegate.take() {
                        scroll_view_arc_observer.setDelegate(Some(delegate.as_ref()));
                    } else {
                        scroll_view_arc_observer.setDelegate(None);
                    }

                    let mut mode = handling_mode_arc_observer.lock().unwrap();
                    *mode = KeyboardHandlingMode::None;
                }
            },
        );

        let scroll_view_arc_observer = scroll_view_arc.clone();
        let old_delegate_arc_did_show = old_delegate_arc.clone();
        let keyboard_height_arc_observer = keyboard_height_arc.clone();
        let original_frame_arc_observer = original_frame_arc.clone();
        let original_inset_arc_observer = original_inset_arc.clone();
        let handling_mode_arc_observer = handling_mode_arc.clone();
        // 키보드가 이미 표시되었음을 모니터링하고 최종 프레임/인셋이 정확하게 동기화되도록 함
        create_observer(
            &notification_center,
            &UIKeyboardDidShowNotification,
            move |notification| {
                let current_mode = *handling_mode_arc_observer.lock().unwrap();
                if current_mode != KeyboardHandlingMode::Adjust {
                    return;
                }

                let user_info: *mut NSDictionary<NSString, AnyObject> =
                    msg_send![notification, userInfo];
                if user_info.is_null() {
                    return;
                }

                let key = NSString::from_str("UIKeyboardFrameEndUserInfoKey");
                let value: *mut NSValue = msg_send![user_info, objectForKey: &*key];
                if value.is_null() {
                    return;
                }

                let keyboard_rect: CGRect = msg_send![value, CGRectValue];
                let new_keyboard_height = keyboard_rect.size.height;

                // 누적을 방지하기 위해 원래 상태를 기반으로 조정
                let original_frame = original_frame_arc_observer.lock().unwrap();
                let mut adjusted_frame = *original_frame;
                adjusted_frame.size.height -= new_keyboard_height;
                webview.setFrame(adjusted_frame);

                // 원래 인셋을 기반으로 조정
                let original_inset = original_inset_arc_observer.lock().unwrap();
                let mut adjusted_inset = *original_inset;
                adjusted_inset.bottom += new_keyboard_height;
                scroll_view_arc_observer.setContentInset(adjusted_inset);
                scroll_view_arc_observer.setScrollIndicatorInsets(adjusted_inset);

                // 키보드 높이 기록 업데이트
                let mut keyboard_height = keyboard_height_arc_observer.lock().unwrap();
                *keyboard_height = new_keyboard_height;

                let mut old_delegate = old_delegate_arc_did_show.lock().unwrap();
                // 키보드 표시가 완료된 후 원래 delegate를 복원하여 누적된 사용자 지정 delegate가 후속 스크롤 이벤트에 영향을 미치지 않도록 함
                if let Some(delegate) = old_delegate.take() {
                    scroll_view_arc_observer.setDelegate(Some(delegate.as_ref()));
                } else {
                    scroll_view_arc_observer.setDelegate(None);
                }

                KEYBOARD_DELEGATE.with(|cell| {
                    *cell.borrow_mut() = None;
                });
            },
        );
    });
}

/// 키보드 조정 모드를 전환하여 후속 알림 콜백이 이 값에 따라 전략을 결정하도록 함
pub fn set_keyboard_adjustment(enabled: bool) {
    SHOULD_ADJUST.store(enabled, Ordering::SeqCst);
}

pub struct KeyboardScrollPreventDelegateState {
    pub scroll_view: Arc<Retained<UIScrollView>>,
    pub offset: CGPoint,
}

define_class! {
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "KeyboardScrollPreventDelegate"]
    #[ivars = KeyboardScrollPreventDelegateState]
    pub(crate) struct KeyboardScrollPreventDelegate;

    unsafe impl NSObjectProtocol for KeyboardScrollPreventDelegate {}

    unsafe impl UIScrollViewDelegate for KeyboardScrollPreventDelegate {
        #[unsafe(method(scrollViewDidScroll:))]
        // 스크롤 콜백에서 초기 오프셋을 강제로 복원하여 사용자가 드래그하여 잘못 정렬되는 것을 방지
        unsafe fn scroll_view_did_scroll(&self, _scroll_view: &UIScrollView) {
            self.ivars()
                .scroll_view
                .setContentOffset(self.ivars().offset);
        }
    }
}

impl KeyboardScrollPreventDelegate {
    /// 스크롤 방지 delegate를 구성하고 대상 스크롤 뷰와 초기 오프셋 저장
    fn new(
        mtm: MainThreadMarker,
        scroll_view: Arc<Retained<UIScrollView>>,
        offset: CGPoint,
    ) -> Retained<Self> {
        let delegate = Self::alloc(mtm).set_ivars(KeyboardScrollPreventDelegateState {
            scroll_view,
            offset,
        });

        unsafe { msg_send![super(delegate), init] }
    }
}

pub struct KeyboardLockDelegateState {
    pub scroll_view: Arc<Retained<UIScrollView>>,
    pub webview: Arc<Retained<UIWebView>>,
    pub locked_offset: CGPoint,
}

define_class! {
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "KeyboardLockDelegate"]
    #[ivars = KeyboardLockDelegateState]
    pub(crate) struct KeyboardLockDelegate;

    unsafe impl NSObjectProtocol for KeyboardLockDelegate {}

    unsafe impl UIScrollViewDelegate for KeyboardLockDelegate {
        #[unsafe(method(scrollViewWillBeginDragging:))]
        // 사용자가 드래그를 시도할 때 즉시 편집을 종료하고 잠금 오프셋 복원
        unsafe fn scroll_view_will_begin_dragging(&self, _scroll_view: &UIScrollView) {
            let ivars = self.ivars();
            let webview_ptr =
                (&**ivars.webview) as *const UIWebView as *mut UIWebView;
            let _: () = msg_send![webview_ptr, endEditing: true];
            ivars
                .scroll_view
                .setContentOffset(ivars.locked_offset);
        }

        #[unsafe(method(scrollViewDidScroll:))]
        unsafe fn scroll_view_did_scroll(&self, _scroll_view: &UIScrollView) {
            let ivars = self.ivars();
            ivars
                .scroll_view
                .setContentOffset(ivars.locked_offset);
        }
    }
}

impl KeyboardLockDelegate {
    /// 스크롤 잠금 delegate를 구성하고 스크롤 뷰, 웹뷰 및 잠금 오프셋 기록
    fn new(
        mtm: MainThreadMarker,
        scroll_view: Arc<Retained<UIScrollView>>,
        webview: Arc<Retained<UIWebView>>,
        offset: CGPoint,
    ) -> Retained<Self> {
        let delegate = Self::alloc(mtm).set_ivars(KeyboardLockDelegateState {
            scroll_view,
            webview,
            locked_offset: offset,
        });

        unsafe { msg_send![super(delegate), init] }
    }
}

/// 알림 리스너 등록을 캡슐화하고 클로저를 사용하여 수신된 시스템 알림 처리
fn create_observer(
    center: &NSNotificationCenter,
    name: &NSNotificationName,
    handler: impl Fn(&NSNotification) + 'static,
) -> Retained<ProtocolObject<dyn NSObjectProtocol>> {
    let block = block2::RcBlock::new(move |notification: NonNull<NSNotification>| {
        handler(unsafe { notification.as_ref() });
    });

    unsafe { center.addObserverForName_object_queue_usingBlock(Some(name), None, None, &block) }
}
