/***** Select-to-Explain content script *****/

// === DEBUG: confirm script injection ========================================
console.log("S2E content script LOADED");   // should print once per tab load
// ============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.cmd === "openChat") {
    const text = msg.text || window.getSelection().toString().trim();
    if (text) showChat(text);
  }
});


let askBtn   = null;   // floating button element
let chatCard = null;   // chat window shadow host

// Utility cleaners -----------------------------------------------------------
function removeAskBtn () { askBtn?.remove();  askBtn  = null; }
function removeChat   () { chatCard?.remove(); chatCard = null; }

// Listen for text selection (mouseup or keyup)
["mouseup", "keyup"].forEach(evt =>
  document.addEventListener(evt, e => {
    const sel  = window.getSelection();
    const text = sel ? sel.toString() : "";

    removeAskBtn();                   // always clear old
    if (!text || text.trim().length < 2) return;   // need ≥2 visible chars

    let rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); }
    catch { rect = null; }

    // Fallback to mouse pointer if rect is unusable
    const top  = rect && rect.height ? rect.top  + window.scrollY
                                     : (e.clientY + window.scrollY);
    const left = rect && rect.width  ? rect.right + window.scrollX
                                     : (e.clientX + window.scrollX);

    askBtn              = document.createElement("div");
    askBtn.className    = "ask-bubble";
    askBtn.textContent  = "?";
    askBtn.style.top    = `${Math.max(top + 4, 8)}px`;   // +4 px offset
    askBtn.style.left   = `${left + 8}px`;
    document.body.appendChild(askBtn);

    askBtn.onclick = () => { showChat(text.trim()); removeAskBtn(); };
    setTimeout(removeAskBtn, 4000);
  }, false)
);

// Build chat pop-up ----------------------------------------------------------
function showChat(selectedText) {
  console.log("S2E showChat, text =", selectedText.slice(0, 60));

  if (chatCard) removeChat();           // one card at a time

  chatCard = document.createElement("div");
  Object.assign(chatCard.style, {
    position  : "fixed",
    /* DEBUG – top-left so you can’t miss it.
       When everything works, change to right:24px, bottom:24px */
    top       : "24px",
    left      : "24px",
    width     : "320px",
    height    : "380px",
    zIndex    : "2147483647",
    background: "#fff",
    borderRadius: "8px",
    boxShadow : "0 4px 12px rgba(0,0,0,.25)",
    overflow  : "hidden"
  });

  const shadow = chatCard.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box;font-family:system-ui,sans-serif;}
      .head{padding:8px 12px;font-weight:600;border-bottom:1px solid #eee;}
      .msgs{height:280px;overflow:auto;padding:12px;}
      .msg{margin-bottom:12px;white-space:pre-line;}
      .user{font-weight:600;}
      .ai{background:#f7f7f7;padding:8px;border-radius:6px;}
      .inputWrap{display:flex;border-top:1px solid #eee;}
      textarea{flex:1;border:none;padding:8px;font-size:14px;resize:none;outline:none;}
      button{border:none;padding:0 12px;cursor:pointer;font-size:14px;background:#fff;}
      button:hover{background:#f0f0f0;}
    </style>
    <div class="head">Theia</div>
    <div id="msgs"  class="msgs"></div>
    <div class="inputWrap">
      <textarea id="q" rows="2" placeholder="Ask follow-up…"></textarea>
      <button   id="send">➤</button>
    </div>
  `;
  document.body.appendChild(chatCard);

  const msgsDiv = shadow.getElementById("msgs");
  const qInput  = shadow.getElementById("q");
  const sendBtn = shadow.getElementById("send");
  const history = [];

  function addMsg(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "ai");
    div.textContent = text;
    msgsDiv.appendChild(div);
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
    history.push({ role, content: text });
  }

  // First explanation --------------------------------------------------------
  addMsg("user", selectedText);
  talk([...history]);

  // Follow-up send -----------------------------------------------------------
  sendBtn.onclick = () => {
    const val = qInput.value.trim();
    if (!val) return;
    qInput.value = "";
    addMsg("user", val);
    talk([...history]);
  };

  // Call background → OpenAI -----------------------------------------------
  function talk(msgs) {
    addMsg("ai", "…");
    chrome.runtime.sendMessage({ msgs }, res => {
      msgsDiv.lastChild.textContent = res.ok
        ? res.text
        : "[Error] " + res.err;
    });
  }

  // Close card on outside click or Esc --------------------------------------
  function close(e) { if (!chatCard.contains(e.target)) remove(); }
  function esc(e)   { if (e.key === "Escape") remove(); }
  function remove() {
    removeChat();
    document.removeEventListener("click", close, true);
    document.removeEventListener("keydown", esc);
  }
  document.addEventListener("click", close, true);
  document.addEventListener("keydown", esc);
}
