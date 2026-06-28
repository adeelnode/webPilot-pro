chrome.runtime.onInstalled.addListener(() => {
  console.log('My Urban Limos Cache Clear v3.0 — by Adeel dev');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'DOWNLOAD_IMAGE') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename }, id => {
      sendResponse({ ok: !chrome.runtime.lastError, id });
    });
    return true;
  }
});
