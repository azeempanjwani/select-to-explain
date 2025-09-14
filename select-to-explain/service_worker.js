/***** Explainer SaaS Service Worker *****/

const API_BASE_URL = 'https://explainer-backend-mtu0.onrender.com/api'; // You'll replace this with your domain

// Create context-menu once SW is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "explainWithAI",
    title: "Explain with AI",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "explainManual",
    title: "Ask AI (Manual Input)",
    contexts: ["page"]
  });
});

// Handle menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id || tab.id < 0) return;
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) return;
  
  if (info.menuItemId === "explainWithAI" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      cmd: "openChat", 
      text: info.selectionText
    }).catch(error => console.error("Error sending message:", error));
    
  } else if (info.menuItemId === "explainManual") {
    chrome.tabs.sendMessage(tab.id, {
      cmd: "openManualInput"
    }).catch(error => console.error("Error sending manual input message:", error));
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(cmd => {
  if (cmd === "_execute_action") {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      if (!tabs || tabs.length === 0) return;
      
      const tab = tabs[0];
      if (!tab.id || tab.id < 0) return;
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) return;
      
      chrome.tabs.sendMessage(tab.id, {
        cmd: "openChat", 
        text: null
      }).catch(error => console.error("Keyboard shortcut error:", error));
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.cmd === 'checkAuth') {
    checkUserAuth(sendResponse);
    return true;
  }
  
  if (req.cmd === 'registerUser') {
    registerUser(req.email, sendResponse);
    return true;
  }
  
  if (!req.msgs) { 
    sendResponse({ok: false, err: "No messages"}); 
    return true; 
  }

  // Send explanation request to your API
  sendExplanationRequest(req.msgs, sendResponse);
  return true;
});

// Check if user is authenticated
async function checkUserAuth(sendResponse) {
  try {
    const result = await chrome.storage.local.get(['userToken', 'userEmail']);
    
    if (!result.userToken) {
      sendResponse({authenticated: false});
      return;
    }
    
    // Verify token with your server
    const response = await fetch(`${API_BASE_URL}/user/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.userToken}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      sendResponse({
        authenticated: true, 
        email: result.userEmail,
        dailyUsage: data.dailyUsage || 0,
        dailyLimit: data.dailyLimit || 20
      });
    } else {
      sendResponse({authenticated: false});
    }
  } catch (error) {
    console.error('Auth check error:', error);
    sendResponse({authenticated: false});
  }
}

// Register new user
async function registerUser(email, sendResponse) {
  try {
    const response = await fetch(`${API_BASE_URL}/user/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Save user token
      await chrome.storage.local.set({
        userToken: data.token,
        userEmail: email
      });
      
      sendResponse({
        success: true,
        token: data.token
      });
    } else {
      sendResponse({
        success: false,
        error: data.error || 'Registration failed'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    sendResponse({
      success: false,
      error: 'Network error. Please try again.'
    });
  }
}

// Send explanation request to your API
async function sendExplanationRequest(messages, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['userToken']);
    
    if (!result.userToken) {
      sendResponse({ok: false, err: "Please register to use Explainer"});
      return;
    }
    
    const response = await fetch(`${API_BASE_URL}/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${result.userToken}`
      },
      body: JSON.stringify({ messages })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      sendResponse({
        ok: true,
        text: data.explanation,
        dailyUsage: data.dailyUsage,
        dailyLimit: data.dailyLimit
      });
    } else {
      sendResponse({
        ok: false,
        err: data.error || 'Failed to get explanation'
      });
    }
  } catch (error) {
    console.error('API error:', error);
    sendResponse({
      ok: false,
      err: 'Network error. Please check your internet connection.'
    });
  }
}