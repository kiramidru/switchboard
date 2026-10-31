chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setTitle({
      title: "Open a normal http or https webpage with a native form first.",
    });
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["switchboard.js"],
    });
    await chrome.action.setBadgeText({ text: "", tabId: tab.id });
    await chrome.action.setTitle({
      title: "Open Switchboard on this page",
      tabId: tab.id,
    });
  } catch {
    await chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    await chrome.action.setTitle({
      title:
        "Switchboard cannot run here. Try a normal webpage, not a browser-internal page or extension store.",
      tabId: tab.id,
    });
  }
});
