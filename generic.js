// Generic mode: every website without a dedicated stylesheet.
//
// Finds the page's base background color, then marks the large layout
// containers painted in that color with [data-fr-clear] so css/generic.css
// can make them transparent. Smaller surfaces (cards, menus, dialogs) and
// anything with its own background image are left alone.
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

  function matchesBase(el) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.position === "sticky") return false;
    const c = solidBackground(el);
    return !!c && Math.hypot(c.r - base.r, c.g - base.g, c.b - base.b) < COLOR_DISTANCE;
  }

  // Breadth-first walk that only descends into large elements, so it stays
  // on the page's layout skeleton and never visits every node.
  function scan() {
    const queue = [document.body];
    let checks = 0;
    while (queue.length && checks < MAX_CHECKS) {
      const el = queue.shift();
      checks++;
      const contents = getComputedStyle(el).display === "contents";
      if (el !== document.body && !contents && !isLarge(el)) continue;
      if (!contents && !el.hasAttribute("data-fr-clear") && matchesBase(el)) {
        el.setAttribute("data-fr-clear", "");
      }
      for (const child of el.children) {
        if (!SKIP.has(child.tagName.toUpperCase())) queue.push(child);
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
    const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 128;
    root.style.setProperty("--fr-base", `rgb(${r}, ${g}, ${b})`);
    root.style.setProperty("--fr-tint", `rgba(${r}, ${g}, ${b}, ${light ? 0.75 : 0.55})`);
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
