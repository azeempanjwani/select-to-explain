// Load saved values on open
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["openai_key","max_tokens"], res => {
    if(res.openai_key) document.getElementById("key").value = res.openai_key;
    if(res.max_tokens)  document.getElementById("max").value = res.max_tokens;
  });
});

// Save button
document.getElementById("save").addEventListener("click", () => {
  const openai_key = document.getElementById("key").value.trim();
  const max_tokens = parseInt(document.getElementById("max").value,10);
  chrome.storage.local.set({ openai_key, max_tokens }, () => {
    document.getElementById("tick").hidden = false;
    setTimeout(() => document.getElementById("tick").hidden = true, 1500);
  });
});
