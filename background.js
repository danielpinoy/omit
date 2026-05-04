chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.get(['blockedChannels'], function (result) {
    if (!result.blockedChannels) {
      chrome.storage.sync.set({ blockedChannels: [] });
    }
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

  chrome.storage.sync.get(['blockedChannels'], function (result) {
    var channels = result.blockedChannels || [];
    if (channels.some(function (c) { return c.id === id; })) return;
    channels.push({ id: id, name: id });
    chrome.storage.sync.set({ blockedChannels: channels });
  });
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === 'SET_BADGE' && sender.tab) {
    var text = msg.count > 0 ? String(msg.count) : '';
    chrome.action.setBadgeText({ text: text, tabId: sender.tab.id }).catch(function () {});
    chrome.action.setBadgeBackgroundColor({ color: '#7c5cfc', tabId: sender.tab.id }).catch(function () {});
  }
});

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'sync' && changes.blockedChannels) {
    var channels = changes.blockedChannels.newValue || [];
    chrome.tabs.query({ url: '*://*.youtube.com/*' }, function (tabs) {
      tabs.forEach(function (tab) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'BLOCKLIST_UPDATED',
          channels: channels
        }).catch(function () {});
      });
    });
  }
});
