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
