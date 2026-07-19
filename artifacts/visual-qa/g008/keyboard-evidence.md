# Keyboard evidence

Surface: production `http://127.0.0.1:3124/`, Playwright Chromium viewport 390x900.

- Skip link `.lf-skip-link` is visible when focused.
- Focus `메뉴 열기`, Enter: dialog open and focus moves to `메뉴 닫기`.
- Escape: dialog closes and focus returns to `메뉴 열기`.
- Dev/production route-focus behavior: `RouteFocus` focuses `#admin-main h1` on navigation; first Tab after load lands the queue link rather than the skip link.
