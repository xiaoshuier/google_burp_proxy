const $ = (id) => document.getElementById(id);
let state;

document.addEventListener("DOMContentLoaded", async () => {
  const response = await chrome.runtime.sendMessage({ type: "getState" });
  if (!response?.ok) return;
  state = response.state;
  renderProfiles();
  loadProfile(state.activeProfile);
  $("profileId").addEventListener("change", () => loadProfile($("profileId").value));
  $("save").addEventListener("click", save);
});

function loadProfile(id) {
  const profile = state.profiles[id] || { type: "http", host: "127.0.0.1", port: 8080, rules: "" };
  $("profileId").value = id;
  $("type").value = profile.type; $("host").value = profile.host; $("port").value = profile.port; $("rules").value = profile.rules;
}

function renderProfiles() {
  const list = $("profiles");
  list.innerHTML = "";
  for (const [id, profile] of Object.entries(state.profiles)) {
    const item = document.createElement("div");
    item.className = `profile-item${id === state.activeProfile ? " active" : ""}`;
    item.innerHTML = `<div><div class="profile-name"></div><div class="profile-meta"></div></div><button class="delete-profile" type="button">删除</button>`;
    item.querySelector(".profile-name").textContent = id;
    item.querySelector(".profile-meta").textContent = `${profile.type === "socks5" ? "SOCKS5" : "HTTP / Burp"} · ${profile.host}:${profile.port}`;
    item.addEventListener("click", () => loadProfile(id));
    item.querySelector(".delete-profile").addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!confirm(`删除方案“${id}”？`)) return;
      const response = await chrome.runtime.sendMessage({ type: "deleteProfile", profileId: id });
      if (response?.ok) {
        state = response.state; renderProfiles(); loadProfile(state.activeProfile); $("status").textContent = "已删除";
      } else $("status").textContent = response?.error || "删除失败";
    });
    list.appendChild(item);
  }
}

async function save() {
  const profileId = $("profileId").value.trim().replace(/[^\w-]/g, "");
  if (!profileId) { $("status").textContent = "请输入方案名称"; return; }
  const response = await chrome.runtime.sendMessage({ type: "saveProfile", profileId, profile: { type: $("type").value, host: $("host").value, port: $("port").value, rules: $("rules").value } });
  if (response?.ok) { state = response.state; renderProfiles(); $("status").textContent = "已保存，可在主页面选择"; }
  else $("status").textContent = "保存失败";
  setTimeout(() => { $("status").textContent = ""; }, 2200);
}
