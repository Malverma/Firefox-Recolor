// Firefox only asks for website access on a fresh install. Over an earlier
// install, or after the user switches it off in about:addons, access stays
// ungranted and nothing is recolored. Until it's granted, the toolbar button
// shows a "!" badge and clicking it asks for access (Firefox only shows its
// permission prompt in response to a click).
const HOSTS = { origins: browser.runtime.getManifest().host_permissions };
const TITLE = browser.runtime.getManifest().action.default_title;

const hasAccess = () => browser.permissions.contains(HOSTS);

async function updateBadge() {
  const granted = await hasAccess();
  browser.action.setBadgeText({ text: granted ? "" : "!" });
  browser.action.setBadgeBackgroundColor({ color: "#d70022" });
  browser.action.setTitle({
    title: granted ? TITLE : "Recolor for Firefox: click to allow on websites",
  });
  return granted;
}

browser.action.onClicked.addListener(() => {
  // permissions.request must be the first call in the click handler, or
  // Firefox no longer treats it as coming from the click.
  browser.permissions.request(HOSTS).then(
    (granted) => { if (granted) updateBadge(); },
    () => {}
  );
  browser.runtime.openOptionsPage();
});

browser.permissions.onAdded.addListener(updateBadge);
browser.permissions.onRemoved.addListener(updateBadge);
browser.runtime.onStartup.addListener(updateBadge);

// On install or update without access, also show the background page, which
// explains what's missing and has its own Allow button.
browser.runtime.onInstalled.addListener(async () => {
  if (!(await updateBadge())) browser.runtime.openOptionsPage();
});
