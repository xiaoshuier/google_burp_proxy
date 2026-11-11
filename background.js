const DEFAULT_PROFILE = { type: "http", host: "127.0.0.1", port: 8080, rules: "*google.com" };

chrome.runtime.onInstalled.addListener(async () => applyState(await loadState()));
chrome.runtime.onStartup.addListener(async () => applyState(await loadState()));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    let state = await loadState();
    if (message.type === "getState") {
      sendResponse({ ok: true, state });
      return;
    }
    if (message.type === "toggle") {
      state.enabled = Boolean(message.enabled);
    } else if (message.type === "selectProfile") {
      state.activeProfile = message.profileId in state.profiles ? message.profileId : state.activeProfile;
    } else if (message.type === "saveProfile") {
      state.profiles[message.profileId] = sanitizeProfile(message.profile);
      state.activeProfile = message.profileId;
    } else if (message.type === "deleteProfile") {
      if (!(message.profileId in state.profiles)) throw new Error("方案不存在");
      if (Object.keys(state.profiles).length <= 1) throw new Error("至少保留一个方案");
      delete state.profiles[message.profileId];
      if (state.activeProfile === message.profileId) state.activeProfile = Object.keys(state.profiles)[0];
    } else {
      return;
    }
    await chrome.storage.local.set(state);
    await applyState(state);
    sendResponse({ ok: true, state });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function loadState() {
  const stored = await chrome.storage.local.get(null);
  if (!stored.profiles) {
    const legacy = sanitizeProfile(stored);
    const state = { enabled: Boolean(stored.enabled), activeProfile: "burp", profiles: { burp: legacy } };
    await chrome.storage.local.set(state);
    return state;
  }
  const profiles = {};
  for (const [id, profile] of Object.entries(stored.profiles)) profiles[id] = sanitizeProfile(profile);
  if (!Object.keys(profiles).length) profiles.burp = { ...DEFAULT_PROFILE };
  return {
    enabled: Boolean(stored.enabled),
    activeProfile: stored.activeProfile in profiles ? stored.activeProfile : Object.keys(profiles)[0],
    profiles
  };
}

async function applyState(state) {
  await updateBadge(state.enabled);
  if (!state.enabled) {
    await chrome.proxy.settings.clear({ scope: "regular" });
    return;
  }
  const profile = state.profiles[state.activeProfile];
  const pacScript = buildPacScript(profile);
  await chrome.proxy.settings.set({ scope: "regular", value: { mode: "pac_script", pacScript: { data: pacScript } } });
}

async function updateBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? "ON" : "" });
  if (enabled) await chrome.action.setBadgeBackgroundColor({ color: "#36a269" });
}

function sanitizeProfile(input = {}) {
  const rules = String(input.rules ?? "").split(/[\n,]+/).map((rule) => rule.trim()).filter(Boolean).slice(0, 100);
  const port = Number.parseInt(input.port, 10);
  return {
    type: input.type === "socks5" ? "socks5" : "http",
    host: String(input.host || "127.0.0.1").trim(),
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 8080,
    rules: rules.join("\n")
  };
}

function buildPacScript({ host, port, rules, type }) {
  const serializedRules = JSON.stringify(rules.split("\n").filter(Boolean));
  const proxy = JSON.stringify(`${type === "socks5" ? "SOCKS5" : "PROXY"} ${host}:${port}`);
  return `function FindProxyForURL(url, host) {
    var rules = ${serializedRules};
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i].toLowerCase();
      var target = host.toLowerCase();
      if (rule.charAt(0) === '*') rule = rule.substring(1);
      if (rule.charAt(rule.length - 1) === '*') rule = rule.substring(0, rule.length - 1);
      if (rule && (target === rule || dnsDomainIs(target, '.' + rule) || dnsDomainIs(target, rule))) return 'DIRECT';
    }
    return ${proxy};
  }`;
}
