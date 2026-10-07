const DEFAULT_URL = browser.runtime.getURL("images/background.jpg");

// The page loads the wallpaper, not the extension, and it can't always load
// moz-extension:// URLs. Hand it the default image as a data: URL, the same
// way uploaded backgrounds are stored.
let defaultDataUrl;
function loadDefault() {
  defaultDataUrl ||= fetch(DEFAULT_URL)
    .then((response) => response.blob())
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }))
    .catch(() => DEFAULT_URL);
  return defaultDataUrl;
}

async function apply(dataUrl) {
  const url = dataUrl || (await loadDefault());
  document.documentElement.style.setProperty("--fr-bg-image", `url("${url}")`);
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
