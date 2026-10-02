// Generic mode: every website without a dedicated stylesheet.
//
// Finds the page's base background color, then marks the large layout
// containers painted in that color with [data-fr-clear] so css/generic.css
// can make them transparent. Smaller surfaces (cards, menus, dialogs) and
// anything with its own background image are left alone. Light pages are
// also marked [data-fr-invert] to force them dark. Other opaque headers,
// sidebars and columns become translucent panels [data-fr-panel], flipped
// [data-fr-flip] when they would otherwise end up light.
(() => {
  if (!/^(text\/html|application\/xhtml\+xml)$/.test(document.contentType)) return;

  const root = document.documentElement;
  const SKIP = new Set([
    "IMG", "VIDEO", "CANVAS", "IFRAME", "SVG", "PICTURE", "OBJECT", "EMBED",
    "INPUT", "TEXTAREA", "SELECT", "BUTTON", "DIALOG", "SCRIPT", "STYLE",
  ]);
  const MAX_CHECKS = 2000;
  const COLOR_DISTANCE = 30;

  // Resolve any CSS color (rgb, oklch, color(), …) to sRGB through a 1×1 canvas.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const colorCache = new Map();

  function toRgba(color) {
    let rgba = colorCache.get(color);
    if (!rgba) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      rgba = { r, g, b, a: a / 255 };
      colorCache.set(color, rgba);
    }
    return rgba;
  }

  // The element's background color, if it is a plain opaque color.
  function solidBackground(el) {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage !== "none") return null;
    const c = toRgba(cs.backgroundColor);
    return c.a >= 0.9 ? c : null;
  }

  function isLarge(el) {
    const rect = el.getBoundingClientRect();
    return rect.width >= innerWidth * 0.5 && rect.height >= innerHeight * 0.5;
  }

  function findBase() {
    const fromRoot = solidBackground(document.body) || solidBackground(root);
    if (fromRoot) return fromRoot;
    for (const el of document.body.querySelectorAll(":scope > *, :scope > * > *")) {
      if (!SKIP.has(el.tagName.toUpperCase()) && isLarge(el)) {
        const c = solidBackground(el);
        if (c) return c;
      }
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  let base;
  let pageInverted = false;

  const distance = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  const isLight = ({ r, g, b }) => 0.2126 * r + 0.7152 * g + 0.0722 * b > 128;

  // What each element was classified as, so rescans don't re-read
  // backgrounds the extension itself has already changed.
  const classified = new WeakMap();

  function classify(el, rect, ctx) {
    const c = solidBackground(el);
    if (!c) return { kind: "none" };
    const large =
      el === document.body || (rect.width >= innerWidth * 0.5 && rect.height >= innerHeight * 0.5);
    const position = getComputedStyle(el).position;
    const pinned = position === "fixed" || position === "sticky";

    // Same color as the panel or page it sits on: let that show through.
    if (ctx.panel && distance(c, ctx.panel) < COLOR_DISTANCE) return { kind: "clear" };
    if (!ctx.panel && large && !pinned && distance(c, base) < COLOR_DISTANCE) {
      return { kind: "clear" };
    }

    // Anything else (headers, sidebars, content columns, bars in a different
    // color) becomes a translucent panel. Flip it if it would end up light:
    // a light panel on a page that isn't inverted, or a dark one on a page
    // that is.
    const endsLight = isLight(c) !== (pageInverted !== ctx.flipped);
    return { kind: "panel", color: c, flip: endsLight && !ctx.flipped };
  }

  function apply(el, result) {
    if (result.kind === "clear") {
      el.setAttribute("data-fr-clear", "");
    } else if (result.kind === "panel") {
      const { r, g, b } = result.color;
      el.style.setProperty("--fr-panel", `rgba(${r}, ${g}, ${b}, 0.6)`);
      el.setAttribute("data-fr-panel", "");
      if (result.flip) el.setAttribute("data-fr-flip", "");
    }
  }

  // Breadth-first walk that only descends into large or bar/sidebar-sized
  // elements, so it stays on the page's layout skeleton and never visits
  // every node. ctx carries the nearest panel color and whether an ancestor
  // was flipped.
  function scan() {
    const queue = [[document.body, { panel: null, flipped: false }]];
    let checks = 0;
    while (queue.length && checks < MAX_CHECKS) {
      const [el, ctx] = queue.shift();
      checks++;
      let childCtx = ctx;

      if (getComputedStyle(el).display !== "contents") {
        const rect = el.getBoundingClientRect();
        const wide = rect.width >= innerWidth * 0.5;
        const tall = rect.height >= innerHeight * 0.5;
        const sized = (wide || tall) && Math.min(rect.width, rect.height) >= 24;
        if (el !== document.body && !sized) continue;

        let result = classified.get(el);
        if (!result) {
          result = classify(el, rect, ctx);
          classified.set(el, result);
          apply(el, result);
        }
        if (result.kind === "panel") {
          childCtx = { panel: result.color, flipped: ctx.flipped || result.flip };
        }
      }

      for (const child of el.children) {
        if (!SKIP.has(child.tagName.toUpperCase())) queue.push([child, childCtx]);
      }
    }
  }

  let pending = false;
  function scheduleScan() {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      scan();
    }, 500);
  }

  function activate() {
    if (!document.body) return;
    base = findBase();
    const { r, g, b } = base;
    pageInverted = isLight(base);
    root.style.setProperty("--fr-base", `rgb(${r}, ${g}, ${b})`);
    if (pageInverted) {
      // Light pages are forced dark (see "Forced dark mode" in generic.css).
      root.style.setProperty("--fr-tint", "rgba(0, 0, 0, 0.6)");
      root.setAttribute("data-fr-invert", "");
    } else {
      root.style.setProperty("--fr-tint", `rgba(${r}, ${g}, ${b}, 0.55)`);
    }
    root.setAttribute("data-fr", "");
    scan();
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", scheduleScan);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", activate, { once: true });
  } else {
    activate();
  }
})();
