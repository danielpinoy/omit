(function () {
  'use strict';

  var listEl = document.getElementById('channel-list');
  var emptyEl = document.getElementById('empty-state');
  var loadingEl = document.getElementById('loading-state');
  var errorEl2 = document.getElementById('error-state');
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
  var pageStatsEl = document.getElementById('page-stats');

  var cachedChannels = [];

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showLoading() {
    loadingEl.style.display = '';
    errorEl2.style.display = 'none';
    emptyEl.style.display = 'none';
    listEl.style.display = 'none';
  }

  function showState(channels) {
    loadingEl.style.display = 'none';
    errorEl2.style.display = 'none';
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
    errorEl2.style.display = '';
  }

  function renderList(channels) {
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

  async function loadAndRender() {
    showLoading();
    try {
      var result = await chrome.storage.sync.get(['blockedChannels']);
      cachedChannels = result.blockedChannels || [];
      renderList(cachedChannels);
      loadStats();
    } catch (err) {
      showError();
      console.error('[Omit] Popup load error:', err);
    }
  }

  async function loadStats() {
    try {
      var data = await chrome.storage.local.get(['pageHiddenCount']);
      if (data.pageHiddenCount > 0) {
        pageStatsEl.textContent = data.pageHiddenCount + ' videos hidden on this page';
        pageStatsEl.style.display = '';
      }
    } catch (e) {
      pageStatsEl.style.display = 'none';
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
      var result = await chrome.storage.sync.get(['blockedChannels']);
      var channels = result.blockedChannels || [];
      if (channels.some(function (c) { return c.id === parsed.id; })) {
        addErrEl.textContent = 'Channel already blocked';
        return;
      }
      channels.push(parsed);
      await chrome.storage.sync.set({ blockedChannels: channels });
      inputEl.value = '';
      cachedChannels = channels;
      renderList(channels);
    } catch (err) {
      addErrEl.textContent = 'Something went wrong';
      console.error('[Omit] Add error:', err);
    }
  }

  async function removeChannel(id) {
    try {
      var result = await chrome.storage.sync.get(['blockedChannels']);
      var channels = (result.blockedChannels || []).filter(function (c) { return c.id !== id; });
      await chrome.storage.sync.set({ blockedChannels: channels });
      cachedChannels = channels;
      renderList(channels);
    } catch (err) {
      console.error('[Omit] Remove error:', err);
    }
  }

  function exportBlocklist() {
    var json = JSON.stringify(cachedChannels, null, 2);
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
    if (!Array.isArray(parsed)) {
      importErrEl.textContent = 'Expected a JSON array of channels';
      return;
    }
    var valid = parsed.every(function (item) {
      return item && typeof item.id === 'string' && typeof item.name === 'string';
    });
    if (!valid) {
      importErrEl.textContent = 'Each item must have "id" and "name" strings';
      return;
    }
    try {
      await chrome.storage.sync.set({ blockedChannels: parsed });
      cachedChannels = parsed;
      renderList(parsed);
      hideImport();
    } catch (err) {
      importErrEl.textContent = 'Failed to save blocklist';
      console.error('[Omit] Import error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadAndRender();
  });

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

  exportBtn.addEventListener('click', exportBlocklist);

  importBtn.addEventListener('click', showImport);

  importLoadBtn.addEventListener('click', loadImport);

  importCancelBtn.addEventListener('click', hideImport);

  if (retryBtn) {
    retryBtn.addEventListener('click', loadAndRender);
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync' && changes.blockedChannels) {
      cachedChannels = changes.blockedChannels.newValue || [];
      renderList(cachedChannels);
    }
  });

  if (chrome.storage.sync) {
    badgeEl.textContent = 'Synced';
  }
})();
