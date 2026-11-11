const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  const response = await chrome.runtime.sendMessage({ type: "getState" });
  if (!response?.ok) return;
  render(response.state);
  $("profile").addEventListener("change", async (event) => {
    const result = await chrome.runtime.sendMessage({ type: "selectProfile", profileId: event.target.value });
    if (result?.ok) render(result.state);
  });
  $("toggle").addEventListener("click", async () => {
    const result = await chrome.runtime.sendMessage({ type: "toggle", enabled: !$("toggle").classList.contains("on") });
    if (result?.ok) render(result.state);
  });
  $("settings").addEventListener("click", openSettings);
});

async function openSettings() {
  try { await chrome.runtime.openOptionsPage(); }
  catch (_error) { await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") }); }
}

function render(state) {
  const select = $("profile");
  select.innerHTML = "";
  for (const id of Object.keys(state.profiles)) {
    const option = document.createElement("option");
    option.value = id; option.textContent = id;
    select.appendChild(option);
  }
  select.value = state.activeProfile;
  $("toggle").classList.toggle("on", state.enabled);
  $("powerText").textContent = state.enabled ? "ON" : "OFF";
  $("status").textContent = state.enabled ? "代理已开启" : "代理已关闭";
}
