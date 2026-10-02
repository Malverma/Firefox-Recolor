# Recolor for Firefox — Firefox Extension Spec

Repository: <https://github.com/Malverma/Firefox-Recolor>

The add-on is named "Recolor for Firefox" because AMO doesn't allow the
Firefox or Mozilla trademarks in names except in the "for Firefox" form.

## 1. Overview

**Recolor for Firefox** is a Firefox extension that puts a wallpaper image behind
**every website** (`http://*/*`, `https://*/*`). Each page's opaque
background layers are made transparent (or lightly tinted) so the wallpaper
shows through behind the existing UI. **Light sites are forced into dark
mode** so they match the wallpaper instead of clashing with it.

Most sites use **generic mode** (section 5.9), which measures the page and
clears its background automatically. These sites have hand-tuned stylesheets
instead, because generic mode can't handle their custom theme systems:

| Site           | URLs                                                   |
| -------------- | ------------------------------------------------------ |
| YouTube        | `https://www.youtube.com/*` (except `/embed/*`)        |
| YouTube Music  | `https://music.youtube.com/*`                          |

The wallpaper defaults to the bundled `images/background.jpg`. The user can
open a drag-and-drop upload page from the toolbar and drop in their own image,
which **replaces** the current wallpaper on every site at once.

The extension is **purely cosmetic**. It changes how sites look and nothing
else.

History: this grew out of BetterYoutubeMusic (YouTube Music only,
<https://github.com/Malverma/BetterYoutubeMusic>), which stays a separate
project. Everything for Recolor for Firefox lives in the Firefox-Recolor repo.

## 2. Goals

- Show a fixed, full-viewport wallpaper behind every website.
- Make each site's opaque background layers transparent or translucent so the
  wallpaper is visible.
- Keep all text, icons, thumbnails, and controls readable.
- Let the user upload their own wallpaper through a drag-and-drop page.
- A newly uploaded image replaces whatever wallpaper was in use (the default or
  a previous upload) on every site, and applies right away without a
  page reload.

## 3. Non-Goals

The extension must **not**:

- Change playback, search, email, ads, recommendations, or any other site
  behavior.
- Read, store, or send any user data, email contents, search queries, watch
  history, or account info.
- Make network requests. The default image ships inside the extension and
  uploaded images stay in local extension storage.
- Change layout, sizing, spacing, fonts, or the colors of foreground elements
  (text, buttons, icons, thumbnails).
- Inject any UI (buttons, panels, overlays) into web pages. The upload UI
  lives on its own extension page.
- Touch iframes (embedded videos, ads, Gmail chat, comment widgets). Only
  the top-level page is styled.
- Touch non-HTML documents (images, plain text, PDFs opened directly) or
  browser pages (`about:`, `addons.mozilla.org`, which Firefox protects).
- Have per-site wallpapers or per-site on/off switches (v2).
- Keep a history or gallery of uploaded images (one slot only).
- Offer a "reset to default" button (v2).

## 4. Background Image

### 4.1 Default image

- `images/background.jpg` (1920×1280, copyright-free), bundled with the extension.
- Used whenever no custom image has been uploaded.
- A higher-resolution file can be dropped in at the same path with no code
  changes.

### 4.2 Custom image

- Stored in `browser.storage.local` under the key `customBackground` as a data
  URL string, plus `customBackgroundUpdated` (timestamp in ms).
- One image is shared by all sites.
- Only one custom image exists at a time. Saving a new one overwrites the key,
  so the previous upload is discarded.
- The bundled `background.jpg` file is never modified (extension files are
  read-only). "Replace" means the custom image takes precedence over it.
- Accepted input types: PNG, JPEG, WebP. Max input file size: 20 MB.
- Before saving, the upload page normalizes the image:
  - Decode it with `createImageBitmap`.
  - If the longest side is over 3840 px, scale it down to 3840 px, keeping
    the aspect ratio.
  - Re-encode with `OffscreenCanvas.convertToBlob({ type: "image/webp",
    quality: 0.9 })`, then convert to a data URL.
  - This keeps storage size bounded and strips metadata (EXIF, location).
- Animated GIFs and other formats are rejected with a clear message.

## 5. Technical Design

### 5.1 File Structure

```
firefox-recolor/
├── manifest.json
├── background.js          (toolbar button → opens upload page)
├── content.js             (sets the wallpaper URL; shared by all sites)
├── generic.js             (generic mode: finds and clears page backgrounds)
├── css/
│   ├── generic.css
│   ├── youtube.css
│   └── youtube-music.css
├── upload/
│   ├── upload.html
│   ├── upload.css
│   └── upload.js
├── images/
│   └── background.jpg
├── icons/
│   ├── icon-48.png
│   └── icon-96.png
├── LICENSE
└── spec.md                (not packaged)
```

### 5.2 Manifest (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "Recolor for Firefox",
  "version": "2.0.0",
  "description": "Puts a wallpaper of your choice behind every website, forcing light sites into dark mode, with tuned styles for YouTube and YouTube Music.",
  "homepage_url": "https://github.com/Malverma/Firefox-Recolor",
  "icons": {
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png"
  },
  "permissions": ["storage"],
  "background": {
    "scripts": ["background.js"]
  },
  "action": {
    "default_title": "Recolor for Firefox: change background",
    "default_icon": {
      "48": "icons/icon-48.png",
      "96": "icons/icon-96.png"
    }
  },
  "options_ui": {
    "page": "upload/upload.html",
    "open_in_tab": true
  },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "exclude_matches": ["https://www.youtube.com/embed/*"],
      "css": ["css/youtube.css"],
      "js": ["content.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["https://music.youtube.com/*"],
      "css": ["css/youtube-music.css"],
      "js": ["content.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["http://*/*", "https://*/*"],
      "exclude_matches": [
        "https://www.youtube.com/*",
        "https://music.youtube.com/*"
      ],
      "css": ["css/generic.css"],
      "js": ["content.js", "generic.js"],
      "run_at": "document_start"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["images/background.jpg"],
      "matches": ["http://*/*", "https://*/*"]
    }
  ],
  "browser_specific_settings": {
    "gecko": {
      "id": "firefox-recolor@malverma",
      "strict_min_version": "142.0",
      "data_collection_permissions": {
        "required": ["none"]
      }
    }
  }
}
```

- `storage` is the only API permission. The content script matches cover
  all `http`/`https` sites, so Firefox lists "Access your data for all
  websites" at install. No `tabs` permission.
- The generic entry excludes every URL that has a dedicated stylesheet, so a
  page never gets both.
- `background.jpg` is web-accessible on all sites so pages can load it as a
  CSS background. Firefox's per-install random `moz-extension://` UUID keeps
  this from being usable to detect the extension.
- Content scripts run in the top frame only (`all_frames` defaults to false),
  so iframes (Gmail chat, YouTube live chat, embeds) are never touched.
- The extension ID changed from earlier versions, so Firefox treats it as a
  new add-on. Old BetterYoutubeMusic/BetterYoutube installs should be removed
  by hand.

### 5.3 background.js

Opens the upload page when the toolbar button is clicked. There is no popup:
Firefox closes popups when focus moves to a file manager or a file picker,
which breaks drag-and-drop from the desktop. A full tab avoids that.

```js
browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});
```

`openOptionsPage()` focuses the existing upload tab if one is open. The same
page is also reachable from `about:addons` → Recolor for Firefox → Preferences.

### 5.4 content.js

Shared by all sites. Resolves which image to show and passes its URL to the
site stylesheet through the `--fr-bg-image` custom property on `<html>`. Keeps
open tabs in sync when the image changes.

```js
const DEFAULT_URL = browser.runtime.getURL("images/background.jpg");

function apply(dataUrl) {
  document.documentElement.style.setProperty(
    "--fr-bg-image",
    `url("${dataUrl || DEFAULT_URL}")`
  );
}

browser.storage.local.get("customBackground").then(
  ({ customBackground }) => apply(customBackground),
  () => apply(null)
);

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "customBackground" in changes) {
    apply(changes.customBackground.newValue);
  }
});
```

- The storage read is async. Until it resolves, each stylesheet shows its
  fallback color (`var(--fr-bg-image, none)`), so the default image never
  flashes before a custom one.
- The script must not touch the DOM in any other way, listen to page events,
  or talk to the page's scripts.

### 5.5 Dedicated site stylesheets — shared pattern

Every dedicated site stylesheet follows the same pattern:

1. **Wallpaper layer** on `html`: fallback color matching the site's own
   background, then a tint gradient over `var(--fr-bg-image, none)`, with
   `center / cover no-repeat fixed`.
2. **Transparent surfaces**: the site's page-level containers get
   `background: transparent !important`.
3. **Readability layers**: bars and panels that sit over the image get a
   translucent tint plus `backdrop-filter: blur(...)`.
4. **Untouched**: menus, dropdowns, dialogs, tooltips, media players,
   thumbnails and all foreground colors.

All selectors **must be checked against the live DOM**, because these sites
change their markup often.

### 5.6 css/youtube.css (www.youtube.com)

- Theme variables overridden to `transparent` on `html`, `[dark]`, `ytd-app`:
  `--yt-spec-base-background`, `--yt-spec-general-background-a/b/c`.
  `--yt-spec-raised-background`, `--yt-spec-menu-background` and
  `--yt-spec-brand-background-*` are left alone (menus, dialogs, tooltips).
- Transparent surfaces: `body`, `ytd-app`, `#content.ytd-app`,
  `ytd-page-manager`, `ytd-masthead` (+ `#background`), mini guide, guide,
  browse/rich grid/section list, chips bar, search, channel header and tabs,
  watch page columns and metadata, Shorts containers.
- Readability: `#frosted-glass` (behind masthead and chips bar)
  `rgba(0,0,0,0.45)` + blur 12px; expanded guide
  (`tp-yt-app-drawer #contentContainer`) `rgba(0,0,0,0.35)` + blur 8px.
- Light theme (`html:not([dark])`): white tints instead of black.
- Kept solid black: `#player-full-bleed-container`, `#movie_player`,
  `.html5-video-player`. Fullscreen, miniplayer, menus and dialogs untouched.

### 5.7 css/youtube-music.css (music.youtube.com)

Carried over from BetterYoutubeMusic v1 (only the variable name changed):

- Theme variables `--ytmusic-background`,
  `--ytmusic-general-background-a/b/c` set to `transparent`.
  `--ytmusic-brand-background-*` left alone (menus, dialogs, toasts).
- `--ytmusic-background` is also used as a foreground color by the sidebar
  play button and as the search box background; both get the original color
  back via `--yt-sys-color-baseline--base-background`.
- `ytmusic-browse-response .background-gradient` wraps all page content:
  strip its background only, never hide it.
- `#nav-bar-background`, `#mini-guide-background` and
  `#player-bar-background` live in `ytmusic-app-layout`'s shadow root and are
  styled through `--ytmusic-nav-bar` and `--ytmusic-player-bar-background`.
- Readability: nav bar `rgba(0,0,0,0.45)`, player bar `rgba(0,0,0,0.55)` +
  blur 12px, guide `rgba(0,0,0,0.35)` + blur 8px.

### 5.8 Upload page (`upload/upload.html`, `upload.css`, `upload.js`)

A standalone extension page. It follows the system light/dark theme
(`prefers-color-scheme`) and has no external resources.

#### Layout

1. Heading: "Recolor for Firefox: background".
2. **Current background** preview: a 16:9 box showing the image in use, with
   a label "Default" or "Custom (uploaded <date>)".
3. **Drop zone**: a large dashed-border area reading "Drop an image here or
   click to choose a file". Clicking it or pressing Enter/Space while it is
   focused opens a hidden `<input type="file"
   accept="image/png,image/jpeg,image/webp">`.
4. A status line (`role="status"`, `aria-live="polite"`) for success and
   error messages.

#### Drag-and-drop behavior

- `dragenter`/`dragover` on the drop zone: `preventDefault()`, add a
  highlighted "drag-over" style. `dragleave`/`drop`: remove it.
- `preventDefault()` on `dragover`/`drop` for the whole window, so a file
  dropped outside the zone doesn't make Firefox navigate to it.
- On `drop`, take `dataTransfer.files[0]`. If more than one file is dropped,
  use the first and say so in the status line.
- The file input path goes through the same handler.

#### Save flow

1. Validate type (PNG/JPEG/WebP) and size (≤ 20 MB). On failure, show an
   error and change nothing.
2. Normalize as described in 4.2.
3. `browser.storage.local.set({ customBackground: dataUrl,
   customBackgroundUpdated: Date.now() })`. This overwrites any previous
   custom image.
4. Update the preview and show "Background updated. Open tabs have been
   updated."
5. If decoding or saving fails, show the error and leave the stored image
   unchanged.

### 5.9 Generic mode (`generic.js` + `css/generic.css`)

Used on every site without a dedicated stylesheet. Arbitrary sites have no
common theme variables, so the background is found by measuring the page.

**Activation**

- Skips documents whose `contentType` isn't `text/html` or
  `application/xhtml+xml`.
- Waits for `DOMContentLoaded` (so the site's CSS has applied), then:
  1. **Find the base color**: the first plain opaque background (alpha ≥ 0.9,
     no `background-image`) on `body`, then `html`, then the first large
     child/grandchild of `body`. Fallback: white. Colors are resolved to sRGB
     through a 1×1 canvas so any CSS color syntax works.
  2. Set `--fr-base` (base color) on `<html>`. If the base color is light
     (luminance > 128), set `data-fr-invert` on `<html>` (forced dark mode,
     below) and `--fr-tint: rgba(0, 0, 0, 0.6)`. Otherwise set `--fr-tint`
     to the base color at 0.55 alpha.
  3. Set `data-fr` on `<html>`. Every rule in `generic.css` is gated on it,
     so nothing changes before this point and non-HTML documents are never
     styled.

**Clearing backgrounds and panels**

- Depth-first walk of every element under `body` (capped at 50,000 per
  pass), skipping `img`, `video`, `canvas`, `iframe`, `svg`, `picture`,
  `object`, `embed`, form controls, `dialog`. `display: none` subtrees are
  skipped and re-checked when shown; `display: contents` is passed through.
- Each pass reads all styles first and writes all attributes after, so
  layout is computed once per pass.
- Each element is classified once (remembered in a `WeakMap`) using the
  context it sits in: the color **behind** it (page base color, or the
  nearest opaque ancestor's original color), whether an ancestor panel is
  **flipped**, and whether it's inside an **overlay** (an `absolute`/`fixed`
  element smaller than layout size, or `role` = dialog, alertdialog, menu,
  listbox, tooltip).
- Elements with a plain opaque background (alpha ≥ 0.9, no
  `background-image`) are classified as:
  - **Clear** (`data-fr-clear` → transparent): its color is within RGB
    distance 30 of the color behind it, it isn't `absolute`/`fixed`/`sticky`,
    and it isn't in an overlay. This covers wrappers, cards, search result
    boxes, and buttons painted in the page or panel color. Clearing these is
    visually neutral on its own; once what's behind them is cleared too, the
    wallpaper shows through.
  - **Panel** (`data-fr-panel`): layout-sized (≥ 50% of the viewport's width
    **or** height, ≥ 24 px in the other dimension), not in an overlay, and
    not cleared, e.g. a white sticky header, a gray sidebar, a colored nav
    bar, a content column, a fixed app shell. It gets its own color at 0.6
    alpha (`--fr-panel`) plus `backdrop-filter: blur(12px)`.
  - **Flip** (`data-fr-flip`, panels only): a panel that would otherwise end
    up light is inverted on its own (`invert(1) hue-rotate(180deg)`), so
    light panels with dark text/buttons come out dark. "Ends up light" = the
    panel is light on a page that isn't inverted, or dark on a page that is.
    Panels inside a flipped panel are not flipped again.
  - **Solid**: anything else (cards in their own color, popups, menus,
    dropdowns, tooltips) keeps its look.
- Media inside a flipped panel is inverted back, so it looks normal.

**Updates**

- A `MutationObserver` on `body` watches added nodes and `class`, `style`,
  `hidden`, `open` attribute changes. Changed subtrees are batched every
  300 ms and processed with the context rebuilt from their ancestors; only
  elements not yet classified are read. `resize` re-processes from `body`.

**generic.css**

```css
html[data-fr] {
  background-color: var(--fr-base) !important;
  background-image:
    linear-gradient(var(--fr-tint), var(--fr-tint)),
    var(--fr-bg-image, none) !important;
  /* center / cover / no-repeat / fixed */
}

html[data-fr] [data-fr-clear] {
  background-color: transparent !important;
}

html[data-fr] [data-fr-panel] {
  background-color: var(--fr-panel) !important;
  backdrop-filter: blur(12px) !important;
}

html[data-fr]:not(:has(:fullscreen)) [data-fr-flip] {
  filter: invert(1) hue-rotate(180deg) !important;
}
```

On dark pages the tint uses the site's own base color, so text keeps
roughly the contrast the site designed for.

**Forced dark mode (light pages)**

Light pages would otherwise put dark text over a dark wallpaper (or need a
heavy white tint that hides the wallpaper). Instead they're turned dark with
a color inversion, the same approach as Dark Reader's "filter" mode:

- `html[data-fr-invert]` gets `filter: invert(1) hue-rotate(180deg)`.
  `hue-rotate` brings colors back near their original hue, so white → near
  black, dark text → light, blue links stay blue-ish. The filter goes on
  `<html>` because a filter on the root element is the one case that doesn't
  create a containing block, so `position: fixed`/`sticky` keep working.
- The wallpaper can't live in `<html>`'s own background (it would be
  inverted), so in this mode it moves to an `html::before` layer
  (`position: fixed; inset: 0; z-index: -2147483647; pointer-events: none`)
  that has the same filter applied again, which cancels out.
- Media is inverted back the same way so it looks normal: `img`, `video`,
  `canvas`, `iframe`, `embed`, `object`, and elements with an inline
  `background-image`, skipping descendants of an already re-inverted
  element or of a flipped panel (which is already inverted back).
- All forced-dark rules are gated on `:not(:has(:fullscreen))`, so
  fullscreen video is never shown inverted.
- Pages already dark (luminance ≤ 128) are not inverted.

**Known limits**

- Sites built with full-viewport `position: fixed` shells, canvas
  rendering, or backgrounds inside shadow DOM won't show the wallpaper (they
  look unchanged).
- Sites that paint their background with an image or gradient are left
  unchanged.
- The wallpaper and forced dark mode appear once the page has parsed, so
  light pages briefly show white while loading.
- Forced dark mode: images set as CSS `background-image` from a stylesheet
  (not inline) can't be found by selector and show inverted. Brand colors
  shift (e.g. a dark blue header becomes light blue). Sites that apply their
  own `filter` to images lose it.
- Large dark sections of a light page that are smaller than half the
  viewport in both directions (e.g. a dark card) are inverted to light.
- `filter` and `backdrop-filter` on a panel make it the containing block for
  `position: fixed` descendants, so a fixed dropdown inside a header may
  position relative to the header instead of the viewport.
- Like any visual change, a page's own scripts can read the computed
  background, including a custom image's data URL.

## 6. Behavior Requirements

| ID   | Requirement                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------- |
| R1   | The wallpaper is visible on every dedicated site and on standard HTML pages elsewhere.           |
| R1a  | Light pages are shown in dark mode; photos, video, and the wallpaper are not inverted.           |
| R2   | The wallpaper stays applied after in-app (SPA) navigation without a reload.                      |
| R3   | The wallpaper is fixed; it does not scroll with content.                                        |
| R4   | The wallpaper covers the full viewport at any window size, without stretching (`cover`).         |
| R5   | No flash of the default image when a custom image is set. Generic mode never paints a wrong background color (a light page may show white until it has parsed). |
| R6   | Playback, search, email, controls, and navigation work exactly as without the extension.        |
| R7   | The extension makes no network requests.                                                        |
| R8   | Iframes, non-HTML documents, and browser-protected pages are never changed.                       |
| R9   | The toolbar button opens the upload page (or focuses it if already open).                       |
| R10  | Dropping or choosing a valid image replaces the wallpaper on all open tabs within ~1 s, without a reload. |
| R11  | Only one custom image is stored; a new upload overwrites the previous one.                       |
| R12  | Invalid files (wrong type, too large, corrupt) show an error and leave the current wallpaper unchanged. |
| R13  | The custom image survives browser restarts.                                                     |
| R14  | Disabling the extension fully restores each site's original look. Removing it also deletes the stored image. |
| R15  | Text contrast stays readable (target WCAG AA, 4.5:1, for main body text over tinted surfaces).   |

## 7. Testing

Manual test pass in Firefox (load via `about:debugging` → *This Firefox* →
*Load Temporary Add-on* → select `manifest.json`). Temporary add-ons lose
`storage.local` data on unload; use `npx web-ext run` with a persistent
profile to test R13.

**YouTube**

1. Visit Home, Subscriptions, Shorts, You, a search, a channel, a playlist,
   and a video. The wallpaper shows everywhere; the player stays black.
2. Try theater mode, fullscreen, and the miniplayer.
3. Open the three-dot menu, account menu, Share, "Save to playlist". They
   are opaque and readable.
4. Switch YouTube to light theme. Text stays readable.

**YouTube Music**

5. Visit Home, Explore, Library, a search, an artist, an album, a playlist.
6. Play a song and open Now Playing (Song and Video modes).
7. Open a track menu and "Save to playlist". They are opaque.

**Generic mode and forced dark**

8. Gmail: inbox, an email with images, Compose, account menu. Everything is
   dark and readable; photos and avatars look normal.
9. Google Search: home page, results, Images tab, a video result. The search
   box and dropdown are dark; thumbnails look normal.
10. A light site with a fixed/sticky header: the header stays in place while
    scrolling.
11. Play an embedded video and make it fullscreen. It isn't inverted.
12. A site that's already dark (e.g. GitHub in dark mode): not inverted; the
    wallpaper shows with a tint in the site's own color.
12a. Google results: the box around each result and the result chips show
    the wallpaper; the search suggestion dropdown stays opaque.
12b. Sites with a white header or sidebar (on a light or dark page) and a
    dark-colored nav bar on a light page: every bar ends up dark, translucent
    and blurred, with light text and buttons; logos and avatars look normal;
    dropdown menus open in the right place.
13. Visit a range of sites: a light news site, a dark site (e.g. GitHub in
    dark mode), Wikipedia, Reddit, a docs site, a web app (e.g. Google
    Docs). The wallpaper shows where the page background was; cards, images,
    sticky headers, and menus keep their look; text stays readable.
14. On an infinite-scroll page, scroll a long way. New content keeps the
    effect and scrolling stays smooth.
15. Open a direct image URL and a `.txt` file URL. They are unchanged.
16. A page with an embedded YouTube video: the embed itself is unchanged.

**Upload page**

17. Click the toolbar button. The upload page opens. Click again; the same
    tab is focused.
18. Drag a JPEG from the file manager onto the drop zone. After the drop, the
    preview and every open tab switch to the new image.
19. Drop a second image. It replaces the first everywhere.
20. Click the drop zone and pick a PNG through the file picker.
21. Drop a `.gif`, a `.txt`, and a file over 20 MB. Each shows an error.
22. Drop a file outside the drop zone. Firefox does not navigate away.
23. Restart Firefox (persistent profile). The custom image is still in use.

**Cleanup**

24. DevTools Network tab: no requests from the extension origin other than
    the local default image.
25. Disable the extension and reload each site. The original look comes back.

Optional: `npx web-ext lint --ignore-files spec.md`.

## 8. Packaging & Distribution

- Source lives at <https://github.com/Malverma/Firefox-Recolor>.
- Build with `npx web-ext build --ignore-files spec.md` →
  `web-ext-artifacts/firefox_recolor-2.0.0.zip`.
- For permanent install outside AMO, the add-on must be signed (via AMO
  unlisted submission) or used in Firefox Developer Edition/Nightly with
  `xpinstall.signatures.required = false`.

## 9. Future Ideas

- Per-site wallpapers and per-site on/off toggles (e.g. to turn generic
  mode off on a site where it misbehaves).
- A "Reset to default" button.
- Sliders for dim/blur strength on the upload page.
- Dedicated stylesheets for more sites where generic mode falls short.
- Remember per-site light/dark detection to avoid the brief white flash.
- A toggle to turn forced dark mode off.
- Paste an image from the clipboard on the upload page.
- Animated (GIF/WebP) wallpapers.
