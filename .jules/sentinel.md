## 2025-12-16 - Webview CSP hardening
**Vulnerability:** The Tauri webview was running the SPA without a strict Content Security Policy, leaving future XSS or remote script injection bugs with higher impact.
**Learning:** Desktop IM clients built on web stacks often assume “local = safe”, but rich message rendering makes XSS a realistic risk.
**Prevention:** Always define a locked-down CSP (self scripts, restricted connect-src, no framing) for any webview-based client that renders user content.
