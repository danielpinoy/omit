(function () {
  'use strict';

  var listEl = document.getElementById('channel-list');
  var emptyEl = document.getElementById('empty-state');
  var loadingEl = document.getElementById('loading-state');
  var storageErrEl = document.getElementById('error-state');
  var countEl = document.getElementById('block-count');
  var inputEl = document.getElementById('channel-input');
  var blockBtn = document.getElementById('block-btn');
  var addErrEl = document.getElementById('add-error');
  var badgeEl = document.getElementById('sync-badge');
  var exportBtn = document.getElementById('export-btn');
  var importBtn = document.getElementById('import-btn');
  var importArea = document.getElementById('import-area');
  var importTextarea = document.getElementById('import-textarea');
  var importLoadBtn = document.getElementById('import-load-btn');
  var importCancelBtn = document.getElementById('import-cancel-btn');
  var importErrEl = document.getElementById('import-error');
  var retryBtn = document.getElementById('retry-btn');

  var tabChannels = document.getElementById('tab-channels');
  var tabKeywords = document.getElementById('tab-keywords');
  var tabChannelsContent = document.getElementById('tab-channels-content');
  var tabKeywordsContent = document.getElementById('tab-keywords-content');

  var keywordInputEl = document.getElementById('keyword-input');
  var keywordBtn = document.getElementById('keyword-btn');
  var keywordErrEl = document.getElementById('keyword-error');
  var keywordListEl = document.getElementById('keyword-list');
  var keywordEmptyEl = document.getElementById('keyword-empty-state');

  var cachedChannels = [];
  var cachedKeywords = [];

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function activateTab(tab) {
    tabChannels.classList.toggle('tab-active', tab === 'channels');
    tabKeywords.classList.toggle('tab-active', tab === 'keywords');
    tabChannelsContent.style.display = tab === 'channels' ? '' : 'none';
    tabKeywordsContent.style.display = tab === 'keywords' ? '' : 'none';
  }

  function showLoading() {
    loadingEl.style.display = '';
    storageErrEl.style.display = 'none';
    emptyEl.style.display = 'none';
    listEl.style.display = 'none';
  }

  function showState(channels) {
    loadingEl.style.display = 'none';
    storageErrEl.style.display = 'none';
    if (!channels || channels.length === 0) {
      emptyEl.style.display = '';
      listEl.style.display = 'none';
      countEl.textContent = '0 blocked';
    } else {
      emptyEl.style.display = 'none';
      listEl.style.display = '';
      countEl.textContent = channels.length + ' blocked';
    }
  }

  function showError() {
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'none';
    listEl.style.display = 'none';
    storageErrEl.style.display = '';
  }

  function renderChannelList(channels) {
    listEl.innerHTML = '';
    showState(channels);
    if (!channels || channels.length === 0) return;

    channels.forEach(function (ch) {
      var li = document.createElement('li');
      li.className = 'channel-item';
      li.innerHTML =
        '<div class="channel-info">' +
          '<span class="channel-name">' + escapeHtml(ch.name) + '</span>' +
          '<span class="channel-id">' + escapeHtml(ch.id || '') + '</span>' +
        '</div>' +
        '<button class="remove-btn" title="Unblock">&times;</button>';
      li.querySelector('.remove-btn').setAttribute('data-id', ch.id);
      listEl.appendChild(li);
    });
  }

  function renderKeywordList(keywords) {
    keywordListEl.innerHTML = '';
    if (!keywords || keywords.length === 0) {
      keywordEmptyEl.style.display = '';
      keywordListEl.style.display = 'none';
      return;
    }
    keywordEmptyEl.style.display = 'none';
    keywordListEl.style.display = '';

    keywords.forEach(function (kw) {
      var li = document.createElement('li');
      li.className = 'channel-item keyword-item';
      li.innerHTML =
        '<div class="channel-info">' +
          '<span class="channel-name">' + escapeHtml(kw) + '</span>' +
        '</div>' +
        '<button class="remove-btn" title="Remove keyword">&times;</button>';
      li.querySelector('.remove-btn').setAttribute('data-keyword', kw);
      keywordListEl.appendChild(li);
    });
  }

  function updateCount() {
    var total = (cachedChannels.length + cachedKeywords.length);
    countEl.textContent = total + ' blocked';
  }

  async function loadAndRender() {
    showLoading();
    try {
      var result = await chrome.storage.local.get(['blockedChannels', 'blockedKeywords']);
      cachedChannels = result.blockedChannels || [];
      cachedKeywords = result.blockedKeywords || [];
      renderChannelList(cachedChannels);
      renderKeywordList(cachedKeywords);
      updateCount();
    } catch (err) {
      showError();
      console.error('[Omit] Popup load error:', err);
    }
  }

  function parseChannelInput(text) {
    text = text.trim();
    if (!text) return null;
    var m;
    m = text.match(/(?:youtube\.com|youtu\.be)\/(@[^/?\s]+|channel\/[^/?\s]+|c\/[^/?\s]+)/i);
    if (m) return { id: m[1], name: m[1] };
    m = text.match(/^@[\w.-]+$/);
    if (m) return { id: m[0], name: m[0] };
    m = text.match(/^UC[\w-]{22}$/);
    if (m) return { id: 'channel/' + m[0], name: m[0] };
    return { id: text, name: text };
  }

  async function addChannel() {
    var text = inputEl.value;
    var parsed = parseChannelInput(text);
    if (!parsed) {
      addErrEl.textContent = 'Enter a channel URL, handle (@name), or name';
      return;
    }
    addErrEl.textContent = '';
    try {
      var result = await chrome.storage.local.get(['blockedChannels']);
      var channels = result.blockedChannels || [];
      if (channels.some(function (c) { return c.id === parsed.id; })) {
        addErrEl.textContent = 'Channel already blocked';
        return;
      }
      channels.push(parsed);
      await chrome.storage.local.set({ blockedChannels: channels });
      inputEl.value = '';
      cachedChannels = channels;
      renderChannelList(channels);
      updateCount();
    } catch (err) {
      addErrEl.textContent = 'Something went wrong';
      console.error('[Omit] Add error:', err);
    }
  }

  async function removeChannel(id) {
    try {
      var result = await chrome.storage.local.get(['blockedChannels']);
      var channels = (result.blockedChannels || []).filter(function (c) { return c.id !== id; });
      await chrome.storage.local.set({ blockedChannels: channels });
      cachedChannels = channels;
      renderChannelList(channels);
      updateCount();
    } catch (err) {
      console.error('[Omit] Remove error:', err);
    }
  }

  async function addKeyword() {
    var kw = keywordInputEl.value.trim().toLowerCase();
    if (!kw) {
      keywordErrEl.textContent = 'Enter a keyword';
      return;
    }
    keywordErrEl.textContent = '';
    try {
      var result = await chrome.storage.local.get(['blockedKeywords']);
      var keywords = result.blockedKeywords || [];
      if (keywords.indexOf(kw) !== -1) {
        keywordErrEl.textContent = 'Keyword already blocked';
        return;
      }
      keywords.push(kw);
      await chrome.storage.local.set({ blockedKeywords: keywords });
      keywordInputEl.value = '';
      cachedKeywords = keywords;
      renderKeywordList(keywords);
      updateCount();
    } catch (err) {
      keywordErrEl.textContent = 'Something went wrong';
      console.error('[Omit] Keyword add error:', err);
    }
  }

  async function removeKeyword(kw) {
    try {
      var result = await chrome.storage.local.get(['blockedKeywords']);
      var keywords = (result.blockedKeywords || []).filter(function (k) { return k !== kw; });
      await chrome.storage.local.set({ blockedKeywords: keywords });
      cachedKeywords = keywords;
      renderKeywordList(keywords);
      updateCount();
    } catch (err) {
      console.error('[Omit] Keyword remove error:', err);
    }
  }

  function exportBlocklist() {
    var data = {
      channels: cachedChannels,
      keywords: cachedKeywords
    };
    var json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(function () {
      exportBtn.textContent = 'Copied!';
      exportBtn.classList.add('copied');
      setTimeout(function () {
        exportBtn.textContent = 'Export';
        exportBtn.classList.remove('copied');
      }, 1500);
    }).catch(function () {
      addErrEl.textContent = 'Failed to copy to clipboard';
    });
  }

  function showImport() {
    importArea.style.display = '';
    importTextarea.value = '';
    importErrEl.textContent = '';
    importTextarea.focus();
  }

  function hideImport() {
    importArea.style.display = 'none';
    importTextarea.value = '';
    importErrEl.textContent = '';
  }

  async function loadImport() {
    var raw = importTextarea.value.trim();
    if (!raw) {
      importErrEl.textContent = 'Paste JSON blocklist above';
      return;
    }
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      importErrEl.textContent = 'Invalid JSON';
      return;
    }

    var channels = [];
    var keywords = [];

    if (Array.isArray(parsed)) {
      var valid = parsed.every(function (item) {
        return item && typeof item.id === 'string' && typeof item.name === 'string';
      });
      if (!valid) {
        importErrEl.textContent = 'Each channel must have "id" and "name" strings';
        return;
      }
      channels = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (parsed.channels) {
        if (!Array.isArray(parsed.channels)) {
          importErrEl.textContent = '"channels" must be an array';
          return;
        }
        var channelsValid = parsed.channels.every(function (item) {
          return item && typeof item.id === 'string' && typeof item.name === 'string';
        });
        if (!channelsValid) {
          importErrEl.textContent = 'Each channel must have "id" and "name" strings';
          return;
        }
        channels = parsed.channels;
      }
      if (parsed.keywords) {
        if (!Array.isArray(parsed.keywords)) {
          importErrEl.textContent = '"keywords" must be an array';
          return;
        }
        keywords = parsed.keywords.filter(function (k) { return typeof k === 'string'; });
      }
    } else {
      importErrEl.textContent = 'Expected a JSON object or array of channels';
      return;
    }

    try {
      await chrome.storage.local.set({
        blockedChannels: channels,
        blockedKeywords: keywords
      });
      cachedChannels = channels;
      cachedKeywords = keywords;
      renderChannelList(channels);
      renderKeywordList(keywords);
      updateCount();
      hideImport();
    } catch (err) {
      importErrEl.textContent = 'Failed to save blocklist';
      console.error('[Omit] Import error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadAndRender();
  });

  tabChannels.addEventListener('click', function () { activateTab('channels'); });
  tabKeywords.addEventListener('click', function () { activateTab('keywords'); });

  blockBtn.addEventListener('click', addChannel);

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChannel();
    }
  });

  inputEl.addEventListener('input', function () {
    addErrEl.textContent = '';
  });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.remove-btn');
    if (!btn) return;
    removeChannel(btn.dataset.id);
  });

  keywordBtn.addEventListener('click', addKeyword);

  keywordInputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  });

  keywordInputEl.addEventListener('input', function () {
    keywordErrEl.textContent = '';
  });

  keywordListEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.remove-btn');
    if (!btn) return;
    removeKeyword(btn.dataset.keyword);
  });

  exportBtn.addEventListener('click', exportBlocklist);
  importBtn.addEventListener('click', showImport);
  importLoadBtn.addEventListener('click', loadImport);
  importCancelBtn.addEventListener('click', hideImport);

  if (retryBtn) {
    retryBtn.addEventListener('click', loadAndRender);
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    var updated = false;
    if (changes.blockedChannels) {
      cachedChannels = changes.blockedChannels.newValue || [];
      renderChannelList(cachedChannels);
      updated = true;
    }
    if (changes.blockedKeywords) {
      cachedKeywords = changes.blockedKeywords.newValue || [];
      renderKeywordList(cachedKeywords);
      updated = true;
    }
    if (updated) updateCount();
  });

  if (chrome.storage.local) {
    badgeEl.textContent = 'Local';
  }
})();
