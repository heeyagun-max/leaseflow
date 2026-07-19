# Browser computed metrics evidence

Surface: production `http://127.0.0.1:3124`, Playwright Chromium, viewport widths 1440, 1024, 768, 390, 375, 320, height 900.

- Every tested route returned status 200, h1 count 1, duplicate id list empty.
- `aria-current` contained the expected Korean current route labels.
- At 320px, `/sources`: `document.documentElement.scrollWidth=373`, `clientWidth=320` (53px horizontal overflow). Other checked global routes were 320/320 at 320px.
- At effective 200% CSS viewport width 160px: `/` and `/changes` measured scrollWidth 320/clientWidth 160; `/sources` 373/160; `/settings` 320/160.
- At 1440/1024 computed nav: `.lf-admin-nav` display flex, `.lf-admin-appbar` display none. At 768/390: `.lf-admin-nav` display none, `.lf-admin-appbar` display flex.
- Rail keyboard focus computed `outline: rgb(147, 197, 253) solid 2px; outline-offset: 3px` at 1440.
