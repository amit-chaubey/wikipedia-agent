document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.getElementById("chat-box");
    const chatHistoryList = document.getElementById("chat-history-list");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");

    // Set your backend API URL
    const API_BASE_URL = "https://wikipedia-agent-1.onrender.com"; // Change this if running locally

    let currentSessionId = localStorage.getItem("session_id") || generateSessionId();
    localStorage.setItem("session_id", currentSessionId);

    function generateSessionId() {
        return `session-${Date.now()}`;
    }

    function appendMessage(sender, text, isStreaming = false) {
        let messageContainer = document.createElement("div");
        messageContainer.classList.add("message-container");

        let senderLabel = document.createElement("div");
        senderLabel.classList.add("message-sender");
        senderLabel.textContent = sender === "user" ? "You:" : "WikiGPT:";

        let messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender === "user" ? "user-message" : "bot-message");
        messageDiv.textContent = "";

        messageContainer.appendChild(senderLabel);
        messageContainer.appendChild(messageDiv);
        chatBox.appendChild(messageContainer);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (isStreaming) {
            let i = 0;
            function typeStream() {
                if (i < text.length) {
                    messageDiv.textContent += text[i];
                    i++;
                    setTimeout(typeStream, 50);
                }
            }
            typeStream();
        } else {
            messageDiv.textContent = text;
        }
    }

    function addChatHistory(sessionId, previewText) {
        let historyItem = document.createElement("div");
        historyItem.classList.add("chat-history-item");
        historyItem.textContent = previewText.substring(0, 30) + "...";
        historyItem.addEventListener("click", () => loadChatHistory(sessionId));
        chatHistoryList.appendChild(historyItem);
    }

    async function loadChatHistory(sessionId) {
        currentSessionId = sessionId;
        localStorage.setItem("session_id", sessionId);
        try {
            let response = await fetch(`${API_BASE_URL}/api/chat/history?session_id=${sessionId}`);
            let data = await response.json();
            chatBox.innerHTML = "";
            if (data.history.length === 0) {
                chatBox.innerHTML = "<p>No previous messages found.</p>";
            }
            data.history.forEach(msg => {
                appendMessage(msg.role === "user" ? "user" : "bot", msg.content, false);
            });
        } catch (error) {
            console.error("Error loading chat history:", error);
        }
    }

    async function sendMessage() {
        let userMessage = userInput.value.trim();
        if (!userMessage) return;

        appendMessage("user", userMessage, false);
        userInput.value = "";

        try {
            let response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage, session_id: currentSessionId })
            });

            let data = await response.json();
            let responseText = data.response || "Unexpected response format.";
            appendMessage("bot", responseText, true);
        } catch (error) {
            appendMessage("bot", "⚠️ Error: Unable to reach server.");
            console.error("Error:", error);
        }
    }

    async function loadChatSessions() {
        try {
            let response = await fetch(`${API_BASE_URL}/api/chat/sessions`);
            let data = await response.json();
            chatHistoryList.innerHTML = "";
            if (data.sessions.length === 0) {
                chatHistoryList.innerHTML = "<p>No chat history available.</p>";
            }
            data.sessions.forEach(session => addChatHistory(session.id, session.preview));

            // Auto-load the latest session
            if (data.sessions.length > 0) {
                loadChatHistory(data.sessions[data.sessions.length - 1].id);
            }
        } catch (error) {
            console.error("Error loading chat sessions:", error);
        }
    }

    sendBtn.addEventListener("click", sendMessage);
    userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    loadChatSessions();
});
