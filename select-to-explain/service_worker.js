/***** Select-to-Explain service worker *****/

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if(!req.msgs){ sendResponse({ok:false, err:"No messages"}); return true; }

  chrome.storage.local.get(["openai_key","max_tokens"], async ({openai_key, max_tokens}) => {
    if(!openai_key){
      sendResponse({ok:false, err:"API key missing. Click extension → Options → Save key."});
      return;
    }

    try{
      const body = {
        model: "gpt-3.5-turbo",
        max_tokens: max_tokens || 512,
        messages: [
          { role: "system", content: "Explain the user's text in grade-7 English. No more than 5 short sentences." },
          ...req.msgs
        ]
      };

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + openai_key
        },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      sendResponse({ok:true, text: json.choices[0].message.content.trim()});
    } catch(err){
      sendResponse({ok:false, err: err.message});
    }
  });
  return true; // keep channel alive

  // Create context-menu once SW is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "explainWithTheia",
    title: "Explain with Theia",
    contexts: ["selection"]
  });
});

// Handle menu click or keyboard shortcut
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "explainWithTheia" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {cmd: "openChat", text: info.selectionText});
  }
});

chrome.commands.onCommand.addListener(cmd => {
  if (cmd === "_execute_action") {
    chrome.tabs.query({active:true, currentWindow:true}, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, {cmd: "openChat", text: null});
    });
  }
});

});
