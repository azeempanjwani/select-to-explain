/***** Select-to-Explain Universal Content Script *****/

console.log("S2E Universal content script LOADED");

// Detect if we're in a PDF
const isPDF = () => {
  return document.contentType === 'application/pdf' || 
         window.location.href.includes('.pdf') ||
         document.querySelector('embed[type="application/pdf"]') ||
         window.PDFViewerApplication ||
         document.body.classList.contains('pdfjs');
};

console.log("S2E: Is PDF?", isPDF());

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("S2E: Received message:", msg);
  if (msg.cmd === "openChat") {
    const text = msg.text || getSelectedText();
    console.log("S2E: Selected text from message:", text);
    if (text) showChat(text);
  } else if (msg.cmd === "openManualInput") {
    console.log("S2E: Opening manual input");
    const text = prompt("Enter or paste the text you want explained:");
    if (text && text.trim().length > 2) {
      showChat(text.trim());
    }
  }
});

let askBtn = null;
let chatCard = null;
let currentSelectedText = "";

// Universal text selection that works for both web pages and PDFs
function getSelectedText() {
  let text = "";
  
  // Method 1: Standard selection (works for most cases)
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    text = selection.toString().trim();
  }
  
  // Method 2: PDF.js specific (if available)
  if (!text && window.PDFViewerApplication) {
    try {
      // Try different PDF.js methods
      if (window.PDFViewerApplication.pdfViewer) {
        const selectedText = window.PDFViewerApplication.pdfViewer.getSelectedText?.();
        if (selectedText) text = selectedText.trim();
      }
    } catch (e) {
      console.log("S2E: PDF.js method failed:", e);
    }
  }
  
  // Method 3: Try getting text from selection range
  if (!text && selection && selection.rangeCount > 0) {
    try {
      const range = selection.getRangeAt(0);
      text = range.toString().trim();
    } catch (e) {
      console.log("S2E: Range method failed:", e);
    }
  }
  
  console.log("S2E: Extracted text:", text.slice(0, 50));
  return text;
}

function removeAskBtn() { 
  if (askBtn) {
    askBtn.remove();
    askBtn = null;
  }
}

function removeChat() { 
  if (chatCard) {
    chatCard.remove();
    chatCard = null;
  }
}

// Enhanced selection handler that works for both web pages and PDFs
function handleSelection(e) {
  console.log("S2E: Selection event:", e.type, "target:", e.target?.tagName, "isPDF:", isPDF());
  
  // Don't interfere if clicking ask button
  if (e.target && e.target.classList.contains('ask-bubble')) {
    return;
  }

  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.sendMessage) {
    console.log("S2E: Extension context invalidated, skipping selection handler");
    return;
  }

  // Use longer delay for PDFs
  const delay = isPDF() ? 300 : 50;
  
  setTimeout(() => {
    console.log("S2E: Checking selection after delay...");
    const text = getSelectedText();
    
    removeAskBtn();
    if (!text || text.length < 2) {
      console.log("S2E: No valid text selected");
      return;
    }

    console.log("S2E: Creating ask button for text:", text.slice(0, 50));
    currentSelectedText = text;

    // Get position - enhanced for PDFs
    let rect = null;
    const selection = window.getSelection();
    
    if (selection && selection.rangeCount > 0) {
      try {
        rect = selection.getRangeAt(0).getBoundingClientRect();
        console.log("S2E: Selection rect:", {
          top: rect.top, 
          left: rect.left, 
          width: rect.width, 
          height: rect.height
        });
      } catch (e) {
        console.log("S2E: Could not get selection rect:", e);
      }
    }

    // Position the ask button with better logic
    let buttonTop, buttonLeft;
    
    if (rect && rect.height > 0 && rect.width > 0) {
      // Use selection rectangle if available
      buttonTop = rect.bottom + 5; // Position below selection
      buttonLeft = Math.min(rect.right + 5, window.innerWidth - 50); // Ensure it stays in viewport
    } else {
      // Fallback to mouse position
      buttonTop = Math.min(e.clientY + 10, window.innerHeight - 50);
      buttonLeft = Math.min(e.clientX + 10, window.innerWidth - 50);
    }
    
    // Ensure button stays within viewport
    buttonTop = Math.max(buttonTop, 10); // At least 10px from top
    buttonLeft = Math.max(buttonLeft, 10); // At least 10px from left

    // Create ask button
    askBtn = document.createElement("div");
    askBtn.className = "ask-bubble";
    askBtn.innerHTML = "?";
    askBtn.style.top = `${buttonTop}px`;
    askBtn.style.left = `${buttonLeft}px`;
    askBtn.title = "Ask AI to explain this text";
    
    // Add extra visibility properties to ensure button shows up
    askBtn.style.visibility = "visible";
    askBtn.style.display = "flex";
    askBtn.style.opacity = "1";
    askBtn.style.zIndex = "2147483647";
    
    console.log("S2E: Ask button position - top:", buttonTop, "left:", buttonLeft);
    console.log("S2E: Viewport size - width:", window.innerWidth, "height:", window.innerHeight);
    console.log("S2E: Selection rect:", rect);
    
    askBtn.addEventListener('mousedown', function(event) {
      console.log("S2E: Ask button clicked!");
      event.stopPropagation();
      event.preventDefault();
      
      setTimeout(() => {
        showChat(currentSelectedText);
        removeAskBtn();
      }, 10);
    });
    
    document.body.appendChild(askBtn);
    console.log("S2E: Ask button appended to body, should be visible now");

    // Double-check if button is actually visible
    setTimeout(() => {
      if (askBtn) {
        const computedStyle = window.getComputedStyle(askBtn);
        console.log("S2E: Button visibility check - display:", computedStyle.display, 
                   "visibility:", computedStyle.visibility, 
                   "opacity:", computedStyle.opacity,
                   "zIndex:", computedStyle.zIndex);
      }
    }, 100);

    // Auto-hide after 8 seconds (longer for PDFs)
    setTimeout(() => {
      if (askBtn) {
        askBtn.style.opacity = '0.5';
        setTimeout(removeAskBtn, 500);
      }
    }, 8000);
  }, delay);
}

// Listen for selection events
document.addEventListener('mouseup', handleSelection, false);
document.addEventListener('keyup', handleSelection, false);

// PDF-specific event listeners
if (isPDF()) {
  console.log("S2E: Setting up PDF-specific listeners");
  
  // Listen for PDF viewer load
  window.addEventListener('load', () => {
    console.log("S2E: PDF window loaded");
    
    // Try to add listeners to PDF viewer elements
    setTimeout(() => {
      const viewer = document.getElementById('viewer');
      const viewerContainer = document.getElementById('viewerContainer');
      
      if (viewer) {
        console.log("S2E: Adding listeners to PDF viewer");
        viewer.addEventListener('mouseup', handleSelection, false);
        viewer.addEventListener('keyup', handleSelection, false);
      }
      
      if (viewerContainer) {
        console.log("S2E: Adding listeners to PDF viewerContainer");
        viewerContainer.addEventListener('mouseup', handleSelection, false);
        viewerContainer.addEventListener('keyup', handleSelection, false);
      }
    }, 1000);
  });
}

// Chat implementation
function showChat(selectedText) {
  console.log("S2E: showChat called with:", selectedText.slice(0, 50));
  
  if (chatCard) removeChat();

  chatCard = document.createElement("div");
  chatCard.className = "explainer-chat-container";
  
  Object.assign(chatCard.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "500px",
    height: "650px",
    zIndex: "2147483647",
    background: "#f5f5f0",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.1), 0 8px 25px rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
    fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
    border: "1px solid rgba(0, 0, 0, 0.05)"
  });

  const shadow = chatCard.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      .chat-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #f5f5f0;
        font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        animation: fadeIn 0.2s ease-out;
      }
      
      .chat-header {
        padding: 20px 24px 16px 24px;
        background: #f5f5f0;
        border-bottom: 1px solid #e5e5db;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      }
      
      .chat-title {
        font-size: 18px;
        font-weight: 500;
        color: #2d2d2d;
        letter-spacing: -0.01em;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      
      .close-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: #f0f0eb;
        cursor: pointer;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: #6b7280;
        transition: all 0.15s ease;
        font-weight: 400;
      }
      
      .close-btn:hover {
        background: #e8e8e3;
        color: #374151;
      }
      
      .messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 0;
        background: #f5f5f0;
        scroll-behavior: smooth;
      }
      
      .message {
        padding: 24px;
        display: flex;
        gap: 16px;
      }
      
      .message:last-child {
        border-bottom: none;
      }
      
      .message.user {
        background: transparent;
      }
      
      .message.assistant {
        background: transparent;
      }
      
      .message-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 500;
        color: white;
        font-family: ui-sans-serif, system-ui, sans-serif;
        border: 1px solid rgba(0, 0, 0, 0.1);
      }
      
      .message.user .message-avatar {
        background: #2d5a3d;
      }
      
      .message.assistant .message-avatar {
        background: #8e8e93;
      }
      
      .message-content {
        flex: 1;
        font-size: 15px;
        line-height: 1.6;
        color: #2d2d2d;
        word-wrap: break-word;
        padding-top: 2px;
        font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        font-weight: 400;
      }
      
      .message.user .message-content {
        background: #f0f0f0;
        color: #2d2d2d;
        padding: 12px 16px;
        border-radius: 18px;
        max-width: fit-content;
        border: 1px solid #e8e8e8;
      }
      
      .message.assistant .message-content {
        background: transparent;
        padding: 0;
      }
      
      .message.assistant .message-content.loading {
        color: #6b7280;
        font-style: italic;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .message.assistant .message-content.loading::before {
        content: '';
        width: 16px;
        height: 16px;
        border: 2px solid #e5e5db;
        border-top: 2px solid #8e8e93;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      .message.assistant .message-content.error {
        color: #dc2626;
        background: #fef2f2;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #fecaca;
        font-size: 14px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .input-container {
        padding: 20px 24px 24px 24px;
        background: #f0f0eb;
        border-top: 1px solid #e5e5db;
      }
      
      .input-wrapper {
        position: relative;
        display: flex;
        align-items: flex-end;
        background: #f8f8f3;
        border: 1px solid #d1d1cc;
        border-radius: 12px;
        padding: 12px;
        transition: all 0.15s ease;
      }
      
      .input-wrapper:focus-within {
        border-color: #8e8e93;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(142, 142, 147, 0.1);
      }
      
      .input-field {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 15px;
        font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        resize: none;
        outline: none;
        line-height: 1.5;
        color: #2d2d2d;
        min-height: 24px;
        max-height: 120px;
        padding: 6px 0;
        font-weight: 400;
        display: flex;
        align-items: center;
      }
      
      .input-field::placeholder {
        color: #8e8e93;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      
      .send-btn {
        width: 36px;
        height: 36px;
        background: #8e8e93;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 0.15s ease;
        margin-left: 8px;
        flex-shrink: 0;
      }
      
      .send-btn:hover:not(:disabled) {
        background: #6d6d70;
        transform: translateY(-1px);
      }
      
      .send-btn:disabled {
        background: #d1d1cc;
        cursor: not-allowed;
        transform: none;
      }
      
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    </style>
    
    <div class="chat-container">
      <div class="chat-header">
        <div class="chat-title">AI Assistant ${isPDF() ? '- PDF' : ''}</div>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      
      <div class="messages-container" id="messagesContainer">
      </div>
      
      <div class="input-container">
        <div class="input-wrapper">
          <textarea 
            class="input-field" 
            id="messageInput" 
            placeholder="${isPDF() ? 'Ask about this PDF text...' : 'Message AI Assistant...'}"
            rows="1"
          ></textarea>
          <button class="send-btn" id="sendBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(chatCard);

  const messagesContainer = shadow.getElementById("messagesContainer");
  const messageInput = shadow.getElementById("messageInput");
  const sendBtn = shadow.getElementById("sendBtn");
  const closeBtn = shadow.getElementById("closeBtn");
  
  const history = [];

  // Auto-resize textarea
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // Add message to UI
  function addMessage(role, content, isLoading = false, isError = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "You" : "AI";
    
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    if (isLoading) messageContent.classList.add("loading");
    if (isError) messageContent.classList.add("error");
    messageContent.textContent = content;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    if (!isLoading && !isError) {
      history.push({ role, content });
    }
    
    return messageContent;
  }

  // Send message to OpenAI
  function sendMessage(content) {
    console.log("S2E: Sending message to service worker");
    
    const loadingElement = addMessage("assistant", "Thinking...", true);
    sendBtn.disabled = true;
    
    // Check if chrome.runtime is available and context is valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.error("S2E: chrome.runtime not available or context invalidated");
      loadingElement.textContent = "Extension context lost. Please refresh the page (F5) and try again.";
      loadingElement.classList.remove("loading");
      loadingElement.classList.add("error");
      sendBtn.disabled = false;
      return;
    }
    
    try {
      chrome.runtime.sendMessage({ msgs: [...history] }, (response) => {
        // Check for context invalidation
        if (chrome.runtime.lastError) {
          console.error("S2E: Runtime error:", chrome.runtime.lastError);
          
          if (chrome.runtime.lastError.message.includes("context invalidated") || 
              chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
            loadingElement.textContent = "Extension was reloaded. Please refresh this page (F5) and try again.";
          } else {
            loadingElement.textContent = `Error: ${chrome.runtime.lastError.message}`;
          }
          
          loadingElement.classList.remove("loading");
          loadingElement.classList.add("error");
          sendBtn.disabled = false;
          return;
        }
        
        sendBtn.disabled = false;
        
        if (response && response.ok) {
          loadingElement.textContent = response.text;
          loadingElement.classList.remove("loading");
          history.push({ role: "assistant", content: response.text });
          console.log("S2E: Message sent successfully");
          
          // Show usage info if provided
          if (response.dailyUsage !== undefined) {
            console.log(`Daily usage: ${response.dailyUsage}/${response.dailyLimit}`);
          }
        } else {
          const errorMsg = response ? response.err : "No response from service worker";
          
          // Handle authentication errors
          if (errorMsg.includes("register") || errorMsg.includes("Please register")) {
            loadingElement.textContent = "Please click the Explainer extension icon to register for free access.";
          } else {
            loadingElement.textContent = `${errorMsg}`;
          }
          
          loadingElement.classList.remove("loading");
          loadingElement.classList.add("error");
          console.error("S2E: Error from service worker:", errorMsg);
        }
      });
    } catch (error) {
      console.error("S2E: Error sending message:", error);
      if (error.message.includes("context invalidated")) {
        loadingElement.textContent = "Extension context lost. Please refresh the page (F5) to continue.";
      } else {
        loadingElement.textContent = `Error: ${error.message}`;
      }
      loadingElement.classList.remove("loading");
      loadingElement.classList.add("error");
      sendBtn.disabled = false;
    }
  }

  // Handle send button click
  sendBtn.addEventListener("click", () => {
    const content = messageInput.value.trim();
    if (!content) return;
    
    addMessage("user", content);
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendMessage(content);
  });

  // Handle Enter key
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Close button
  closeBtn.addEventListener("click", closeChat);

  // Close on escape or outside click
  function closeChat() {
    removeChat();
    document.removeEventListener("click", handleOutsideClick, true);
    document.removeEventListener("keydown", handleEscapeKey);
  }

  function handleOutsideClick(e) {
    if (!chatCard.contains(e.target)) {
      closeChat();
    }
  }

  function handleEscapeKey(e) {
    if (e.key === "Escape") {
      closeChat();
    }
  }

  // Start with the selected text
  addMessage("user", selectedText);
  sendMessage(selectedText);

  // Add event listeners
  document.addEventListener("click", handleOutsideClick, true);
  document.addEventListener("keydown", handleEscapeKey);

  // Focus input
  setTimeout(() => messageInput.focus(), 100);
}

// === PRACTICAL PDF SOLUTION ===
if (isPDF()) {
  console.log("S2E: Adding practical PDF solution");
  
  // Add a simple helper button for PDFs
  setTimeout(() => {
    const helperBtn = document.createElement("div");
    helperBtn.style.cssText = `
      position: fixed !important;
      top: 10px !important;
      right: 10px !important;
      z-index: 999999999 !important;
      background: #10b981 !important;
      color: white !important;
      padding: 10px 15px !important;
      cursor: pointer !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
      border: none !important;
      font-weight: 600 !important;
    `;
    helperBtn.textContent = "Ask AI";
    helperBtn.title = "Click to explain any text";
    
    helperBtn.onclick = () => {
      // Show a simple prompt for manual text input
      const text = prompt("Paste or type the text you want explained:");
      if (text && text.trim().length > 2) {
        console.log("S2E: Manual text input for PDF:", text.slice(0, 50));
        showChat(text.trim());
      }
    };
    
    document.body.appendChild(helperBtn);
    console.log("S2E: Added PDF helper button");
  }, 2000);
  
  // Still try basic selection detection for PDFs that might work
  let selectionTimeout = null;
  
  function simpleSelectionCheck() {
    if (selectionTimeout) clearTimeout(selectionTimeout);
    
    selectionTimeout = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";
      
      if (text && text.length >= 2) {
        console.log("S2E: Simple PDF selection worked:", text.slice(0, 50));
        
        // Remove old button
        removeAskBtn();
        
        // Create ask button
        const rect = selection.rangeCount > 0 ? 
          selection.getRangeAt(0).getBoundingClientRect() : 
          { top: 100, left: 100, width: 0, height: 0 };
        
        const top = rect.height > 0 ? rect.bottom + window.scrollY + 5 : window.scrollY + 100;
        const left = rect.width > 0 ? rect.right + window.scrollX + 5 : window.scrollX + 100;
        
        askBtn = document.createElement("div");
        askBtn.className = "ask-bubble";
        askBtn.innerHTML = "?";
        askBtn.style.top = `${top}px`;
        askBtn.style.left = `${left}px`;
        askBtn.title = "Ask AI to explain this text";
        
        askBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          console.log("S2E: PDF ask button clicked");
          showChat(text);
          removeAskBtn();
        });
        
        document.body.appendChild(askBtn);
        console.log("S2E: Simple PDF ask button created");
        
        // Auto-hide
        setTimeout(() => {
          if (askBtn) {
            askBtn.style.opacity = '0.3';
            setTimeout(removeAskBtn, 1000);
          }
        }, 8000);
      }
    }, 200);
  }
  
  // Add simple selection listeners
  document.addEventListener('mouseup', simpleSelectionCheck);
  document.addEventListener('selectionchange', simpleSelectionCheck);
  
  console.log("S2E: Practical PDF solution ready");
}