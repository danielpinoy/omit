(function () {
  "use strict";

  var VIDEO_SELECTORS = [
    "ytd-rich-item-renderer:not([omit-blocked])",
    "ytd-video-renderer:not([omit-blocked])",
    "ytd-compact-video-renderer:not([omit-blocked])",
    "ytd-reel-item-renderer:not([omit-blocked])",
    "ytd-grid-video-renderer:not([omit-blocked])",
  ].join(",");

  var VIDEO_TAGS = {
    "ytd-rich-item-renderer": true,
    "ytd-video-renderer": true,
    "ytd-compact-video-renderer": true,
    "ytd-reel-item-renderer": true,
    "ytd-grid-video-renderer": true
  };

  var blockedIds = new Set();
  var blockedNames = new Set();
  var blockedKeywords = [];
  var blockedKeywordRegexes = [];
  var hiddenCount = 0;
  var channelNameMap = {};
  var overlayShown = false;
  var toastTimer = null;

  var CHANNEL_RE = /\/(@[^/?]+|channel\/[^/?]+|c\/[^/?]+)/;

  function extractTitle(el) {
    var t = el.querySelector("a#video-title, a[title]");
    if (!t) {
      var all = el.querySelectorAll("a");
      for (var i = 0; i < all.length; i++) {
        var h = all[i].getAttribute("href") || "";
        if (h.indexOf("/watch?v=") !== -1 || h.indexOf("/shorts/") !== -1) {
          t = all[i];
          break;
        }
      }
    }
    if (!t) return "";
    return (t.getAttribute("title") || t.textContent || "").trim().toLowerCase();
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function compileKeywordRegexes() {
    blockedKeywordRegexes = [];
    for (var i = 0; i < blockedKeywords.length; i++) {
      if (!blockedKeywords[i]) continue;
      blockedKeywordRegexes.push(new RegExp("\\b" + escapeRegExp(blockedKeywords[i]) + "\\b", "i"));
    }
  }

  function matchesKeyword(title) {
    if (!title || !blockedKeywordRegexes.length) return false;
    for (var i = 0; i < blockedKeywordRegexes.length; i++) {
      if (blockedKeywordRegexes[i].test(title)) return true;
    }
    return false;
  }

  function shouldHide(el) {
    var info = extractChannelInfo(el);
    if (info && isBlocked(info.id, info.name)) return true;
    if (!blockedKeywordRegexes.length) return false;
    var title = extractTitle(el);
    return matchesKeyword(title);
  }

  function extractChannelInfo(el) {
    var nameWrap = el.querySelector("ytd-channel-name");
    if (!nameWrap) return null;
    var link = nameWrap.querySelector("a");
    if (!link) return null;
    var href = link.getAttribute("href") || "";
        var match = href.match(CHANNEL_RE);
        if (!match) return null;
        return {
          id: match[1],
          name: (link.textContent || "").trim(),
        };
      }

      function parseChannelFromUrl(url) {
        var match = url.match(CHANNEL_RE);
    return match ? match[1] : null;
  }

  function hideVideo(el) {
    if (el.hasAttribute("omit-blocked")) return;
    el.style.display = "none";
    el.setAttribute("omit-blocked", "");
    hiddenCount++;
  }

  function showVideo(el) {
    if (!el.hasAttribute("omit-blocked")) return;
    el.style.display = "";
    el.removeAttribute("omit-blocked");
    hiddenCount--;
  }

  function isBlocked(id, name) {
    if (blockedIds.has(id)) return true;
    if (name && blockedNames.has(name.toLowerCase())) return true;
    return false;
  }

  function updateBadge() {
    try {
      chrome.runtime.sendMessage({ type: "SET_BADGE", count: hiddenCount });
    } catch (e) {
      /* background may be inactive */
    }
  }

  function scanVideos(reset) {
    if (reset) {
      var hiddenList = document.querySelectorAll("[omit-blocked]");
      hiddenList.forEach(showVideo);
    }
    var elements = document.querySelectorAll(VIDEO_SELECTORS);
    elements.forEach(function (el) {
      try {
        if (shouldHide(el)) {
          hideVideo(el);
        }
      } catch (e) {
        /* element may be torn down */
      }
    });
    updateBadge();
  }

  function injectStyles() {
    if (document.getElementById("omit-injected-styles")) return;
    var style = document.createElement("style");
    style.id = "omit-injected-styles";
    style.textContent = [
      ".omit-block-btn {",
      '  margin-left:6px;padding:1px 7px;font-size:11px;font-family:"Roboto","Arial",sans-serif;',
      "  font-weight:500;border:none;border-radius:3px;",
      "  cursor:pointer;opacity:0;transition:opacity 0.15s,background 0.15s;white-space:nowrap;",
      "  vertical-align:middle;line-height:16px;",
      "  color:#fff;background:rgba(255,255,255,0.15);",
      "}",
      "html:not([dark]) .omit-block-btn{",
      "  color:#333;background:rgba(0,0,0,0.08);",
      "}",
      ".omit-block-btn:hover{background:#7c5cfc;color:#fff;}",
      "html:not([dark]) .omit-block-btn:hover{background:#065fd4;color:#fff;}",
      "ytd-channel-name:hover .omit-block-btn,.omit-block-btn.omit-blocked{opacity:1;}",
      ".omit-block-btn.omit-blocked{background:rgba(255,255,255,0.06);color:#999;cursor:default;}",
      "html:not([dark]) .omit-block-btn.omit-blocked{background:rgba(0,0,0,0.04);color:#999;}",
      ".omit-block-btn.omit-blocked:hover{background:rgba(255,255,255,0.06);}",
      "html:not([dark]) .omit-block-btn.omit-blocked:hover{background:rgba(0,0,0,0.04);}",

      ".omit-overlay{",
      "  position:fixed;inset:0;z-index:99998;background:rgba(5,5,15,0.94);",
      "  display:flex;flex-direction:column;align-items:center;justify-content:center;",
      '  font-family:"Roboto","Arial",sans-serif;opacity:0;transition:opacity 0.25s;',
      "}",
      ".omit-overlay.omit-overlay-visible{opacity:1;}",
      ".omit-overlay-icon{font-size:48px;margin-bottom:16px;opacity:0.5;}",
      ".omit-overlay-title{font-size:18px;font-weight:600;color:#e0e0e0;margin-bottom:6px;}",
      ".omit-overlay-channel{font-size:13px;color:#777;margin-bottom:22px;}",
      ".omit-overlay-actions{display:flex;gap:10px;}",
      ".omit-overlay-btn{padding:8px 20px;border-radius:6px;font-size:13px;",
      "  font-family:inherit;cursor:pointer;border:none;transition:background 0.15s;}",
      ".omit-overlay-btn-primary{background:#7c5cfc;color:#fff;}",
      ".omit-overlay-btn-primary:hover{background:#6a4de0;}",
      ".omit-overlay-btn-secondary{background:rgba(255,255,255,0.08);color:#bbb;}",
      ".omit-overlay-btn-secondary:hover{background:rgba(255,255,255,0.14);}",

      ".omit-toast{",
      "  position:fixed;bottom:24px;left:50%;z-index:99999;",
      "  background:#fff;color:#0f0f0f;padding:16px 30px;border-radius:12px;",
      '  font-size:16px;font-family:"Roboto","Arial",sans-serif;',
      "  box-shadow:0 21px 16px rgba(0,0,0,0.12);display:flex;align-items:center;gap:10px;",
      "  transform:translateX(-50%);animation:omit-toast-in 0.2s ease-out;",
      "}",
      "html[dark] .omit-toast{",
      "  background:#272727;color:#f1f1f1;",
      "  box-shadow:0 4px 24px rgba(0,0,0,0.6);",
      "}",
      ".omit-toast.omit-toast-out{animation:omit-toast-out 0.3s ease-in forwards;}",
      ".omit-toast-undo{color:#065fd4;cursor:pointer;font-weight:600;",
      "  background:none;border:none;font-size:13px;font-family:inherit;padding:0;",
      "  text-decoration:underline;text-underline-offset:2px;}",
      ".omit-toast-undo:hover{color:#0b57d0;}",
      "html[dark] .omit-toast-undo{color:#3ea6ff;}",
      "html[dark] .omit-toast-undo:hover{color:#6bb9ff;}",
      "@keyframes omit-toast-in{",
      "  from{opacity:0;transform:translateX(-50%) translateY(12px);}",
      "  to{opacity:1;transform:translateX(-50%) translateY(0);}",
      "}",
      "@keyframes omit-toast-out{",
      "  from{opacity:1;transform:translateX(-50%) translateY(0);}",
      "  to{opacity:0;transform:translateX(-50%) translateY(12px);}",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function injectButtonToChannel(nameEl) {
    if (nameEl.querySelector(".omit-block-btn")) return;
    var link = nameEl.querySelector("a");
    if (!link) return;
    var href = link.getAttribute("href") || "";
    var match = href.match(CHANNEL_RE);
    if (!match) return;
    var channelId = match[1];
    var channelName = (link.textContent || "").trim();
    var blocked = isBlocked(channelId, channelName);

    var btn = document.createElement("button");
    btn.className = "omit-block-btn" + (blocked ? " omit-blocked" : "");
    btn.textContent = blocked ? "Blocked" : "Block";
    btn.title = blocked
      ? "This channel is blocked"
      : "Block this channel from your feed";

    if (!blocked) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        blockChannel(channelId, channelName, btn);
      });
    } else {
      btn.disabled = true;
    }

    nameEl.appendChild(btn);
  }

  function removeAllButtons() {
    var btns = document.querySelectorAll(".omit-block-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].remove();
    }
  }

  function injectBlockButtons() {
    var names = document.querySelectorAll("ytd-channel-name");
    for (var i = 0; i < names.length; i++) {
      try {
        injectButtonToChannel(names[i]);
      } catch (e) {
        /* skip */
      }
    }
  }

  function showToast(channelName, channelId) {
    dismissToast();
    var toast = document.createElement("div");
    toast.className = "omit-toast";
    toast.innerHTML =
      "<span>" +
      escapeText(channelName) +
      " blocked</span>" +
      '<button class="omit-toast-undo">Undo</button>';
    toast
      .querySelector(".omit-toast-undo")
      .addEventListener("click", function () {
        undoBlock(channelId);
        dismissToast();
      });
    document.body.appendChild(toast);
    toastTimer = setTimeout(function () {
      dismissToast();
    }, 4000);
  }

  function dismissToast() {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    var toast = document.querySelector(".omit-toast");
    if (!toast) return;
    toast.classList.add("omit-toast-out");
    toast.addEventListener(
      "animationend",
      function () {
        if (toast.parentNode) toast.remove();
      },
      { once: true },
    );
  }

  function escapeText(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  async function undoBlock(id) {
    try {
      var result = await chrome.storage.local.get(["blockedChannels"]);
      var channels = (result.blockedChannels || []).filter(function (c) {
        return c.id !== id;
      });
      await chrome.storage.local.set({ blockedChannels: channels });
    } catch (err) {
      if (
        err &&
        String(err.message || err).indexOf("Extension context invalidated") !==
          -1
      )
        return;
      console.error("[Omit] Undo failed:", err);
    }
  }

  async function blockChannel(id, name, btnElement) {
    try {
      var result = await chrome.storage.local.get(["blockedChannels"]);
      var channels = result.blockedChannels || [];
      if (
        channels.some(function (c) {
          return c.id === id;
        })
      )
        return;
      channels.push({ id: id, name: name });
      await chrome.storage.local.set({ blockedChannels: channels });
      if (btnElement) {
        btnElement.textContent = "Blocked";
        btnElement.className = "omit-block-btn omit-blocked";
        btnElement.disabled = true;
        btnElement.title = "This channel is blocked";
      }
      showToast(name, id);
    } catch (err) {
      if (
        err &&
        String(err.message || err).indexOf("Extension context invalidated") !==
          -1
      ) {
        showExtensionReloadToast(name);
        return;
      }
      console.error("[Omit] Failed to block channel:", err);
    }
  }

  function showExtensionReloadToast(channelName) {
    dismissToast();
    var toast = document.createElement("div");
    toast.className = "omit-toast";
    toast.innerHTML =
      "<span>Extension was updated. Refresh the page to block " +
      escapeText(channelName) +
      "</span>";
    document.body.appendChild(toast);
    toastTimer = setTimeout(function () {
      dismissToast();
    }, 5000);
  }

  function showOverlay() {
    overlayShown = true;
    var existing = document.querySelector(".omit-overlay");
    if (existing) existing.remove();

    var currentChannelId = parseChannelFromUrl(location.pathname);
    var channelName = channelNameMap[currentChannelId] || currentChannelId || "this channel";

    var overlay = document.createElement("div");
    overlay.className = "omit-overlay";
    overlay.innerHTML =
      '<div class="omit-overlay-icon">&#x26D4;</div>' +
      '<div class="omit-overlay-title">Channel Blocked by Omit</div>' +
      '<div class="omit-overlay-channel">' +
      escapeText(channelName) +
      "</div>" +
      '<div class="omit-overlay-actions">' +
      '<button class="omit-overlay-btn omit-overlay-btn-primary" id="omit-view-anyway">View Anyway</button>' +
      '<button class="omit-overlay-btn omit-overlay-btn-secondary" id="omit-go-back">Go Back</button>' +
      "</div>";
    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      overlay.classList.add("omit-overlay-visible");
    });

    overlay
      .querySelector("#omit-view-anyway")
      .addEventListener("click", function () {
        hideOverlay();
      });

    overlay
      .querySelector("#omit-go-back")
      .addEventListener("click", function () {
        history.back();
      });
  }

  function hideOverlay() {
    overlayShown = false;
    var overlay = document.querySelector(".omit-overlay");
    if (!overlay) return;
    overlay.classList.remove("omit-overlay-visible");
    overlay.addEventListener(
      "transitionend",
      function () {
        if (overlay.parentNode) overlay.remove();
      },
      { once: true },
    );
  }

  function checkChannelPage() {
    var channelId = parseChannelFromUrl(location.pathname);
    if (!channelId) {
      hideOverlay();
      return;
    }
    if (isBlocked(channelId, null)) {
      showOverlay();
    } else {
      hideOverlay();
    }
  }

  function fullRefresh() {
    removeAllButtons();
    injectBlockButtons();
  }

  function loadSets(channels) {
    blockedIds = new Set(
      channels.map(function (c) {
        return c.id;
      }),
    );
    blockedNames = new Set(
      channels.map(function (c) {
        return c.name.toLowerCase();
      }),
    );
    channelNameMap = {};
    channels.forEach(function (c) {
      channelNameMap[c.id] = c.name;
    });
  }

  async function loadBlocklist() {
    try {
      var result = await chrome.storage.local.get(["blockedChannels", "blockedKeywords"]);
      var channels = result.blockedChannels || [];
      blockedKeywords = result.blockedKeywords || [];
      compileKeywordRegexes();
      loadSets(channels);
      scanVideos(true);
      fullRefresh();
      checkChannelPage();
    } catch (err) {
      console.error("[Omit] Failed to load blocklist:", err);
    }
  }

  function checkNode(node) {
    if (node.nodeType !== 1) return;
    var tag = node.tagName;
    if (!tag) return;
    tag = tag.toLowerCase();

    if (VIDEO_TAGS[tag]) {
      try {
        if (shouldHide(node)) {
          hideVideo(node);
        }
      } catch (e) {}
    }

    if (node.querySelectorAll) {
      var els = node.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer, ytd-grid-video-renderer');
      for (var k = 0; k < els.length; k++) {
        try {
          if (shouldHide(els[k])) {
            hideVideo(els[k]);
          }
        } catch (e) {}
      }
    }
  }

  function processMutations(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        checkNode(nodes[j]);
      }
    }
    updateBadge();
  }

  var buttonDebounce = null;
  var observer = null;

  function setupObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(function (mutations) {
      processMutations(mutations);
      clearTimeout(buttonDebounce);
      buttonDebounce = setTimeout(injectBlockButtons, 150);
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    var needsScan = false;
    if (changes.blockedChannels) {
      var channels = changes.blockedChannels.newValue || [];
      loadSets(channels);
      fullRefresh();
      needsScan = true;
    }
    if (changes.blockedKeywords) {
      blockedKeywords = changes.blockedKeywords.newValue || [];
      compileKeywordRegexes();
      needsScan = true;
    }
    if (needsScan) {
      scanVideos(true);
      checkChannelPage();
    }
  });

  injectStyles();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      loadBlocklist();
      setupObserver();
    });
  } else {
    loadBlocklist();
    setupObserver();
  }

  var lastUrl = location.href;
  new MutationObserver(function () {
    var currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      scanVideos(true);
      injectBlockButtons();
      checkChannelPage();
    }
  }).observe(document.querySelector("title") || document.documentElement, {
    subtree: true,
    childList: true,
  });

  console.log("[Omit] Content script ready");
})();
