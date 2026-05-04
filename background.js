chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get(['blockedChannels', 'blockedKeywords'], function (result) {
    if (result.blockedChannels || result.blockedKeywords) return;

    chrome.storage.sync.get(['blockedChannels', 'blockedKeywords'], function (syncData) {
      var updates = {};
      if (syncData.blockedChannels && syncData.blockedChannels.length) {
        updates.blockedChannels = syncData.blockedChannels;
      }
      if (syncData.blockedKeywords && syncData.blockedKeywords.length) {
        updates.blockedKeywords = syncData.blockedKeywords;
      }
      if (Object.keys(updates).length) {
        chrome.storage.local.set(updates);
      } else {
        chrome.storage.local.set({ blockedChannels: [], blockedKeywords: [] });
      }
    });
  });

  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: 'omit-block-channel',
      title: 'Block channel with Omit',
      contexts: ['link'],
      targetUrlPatterns: [
        '*://*.youtube.com/@*',
        '*://*.youtube.com/channel/*',
        '*://*.youtube.com/c/*',
        '*://youtube.com/@*',
        '*://youtube.com/channel/*',
        '*://youtube.com/c/*'
      ]
    });
  });

  console.log('[Omit] Extension installed');
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId !== 'omit-block-channel') return;
  var url = info.linkUrl;
  if (!url) return;
  var match = url.match(/youtube\.com\/(@[^/?\s]+|channel\/[^/?\s]+|c\/[^/?\s]+)/i);
  if (!match) return;
  var id = match[1];

  chrome.storage.local.get(['blockedChannels'], function (result) {
    var channels = result.blockedChannels || [];
    if (channels.some(function (c) { return c.id === id; })) return;
    channels.push({ id: id, name: id });
    chrome.storage.local.set({ blockedChannels: channels });
  });
});

console.log("[Omit] Extension installed");
