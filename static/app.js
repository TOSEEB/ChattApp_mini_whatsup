// Global state
let currentUser = null;
let currentToken = null;
let currentConversation = null;
let websocket = null;
let conversations = [];
let typingTimeout = null;
let pendingMessages = new Map(); // Track pending optimistic messages by content
let replyingToMessage = null; // Track message being replied to
let pendingFiles = []; // Track files selected but not yet sent
let messagePagination = {
    conversationId: null,
    roomId: null,
    skip: 0,
    limit: 50,
    hasMore: true,
    loading: false
};

const API_BASE = window.location.origin;

// Toast Notification System
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, duration);
    }
    
    return toast;
}

// Load token from localStorage on page load
function loadStoredSession() {
    const storedToken = localStorage.getItem('chat_token');
    const storedUser = localStorage.getItem('chat_user');
    
    if (storedToken && storedUser) {
        try {
            currentToken = storedToken;
            currentUser = JSON.parse(storedUser);
            // Verify token is still valid by fetching user info
            verifyAndRestoreSession();
        } catch (error) {
            // Error loading stored session
            clearStoredSession();
            showAuthSection();
        }
    } else {
        // No stored session
        showAuthSection();
    }
}

// Verify token and restore session
async function verifyAndRestoreSession() {
    if (!currentToken) {
        // No token, show auth section
        showAuthSection();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            // Update stored user data
            localStorage.setItem('chat_user', JSON.stringify(userData));
            
            // Restore UI (sections should already be set correctly by inline script)
            const avatarText = currentUser.username.charAt(0).toUpperCase();
            const avatarEl = document.getElementById('user-avatar-text');
            const nameEl = document.getElementById('current-user-name');
            if (avatarEl) avatarEl.textContent = avatarText;
            if (nameEl) nameEl.textContent = currentUser.username;
            
            // Ensure correct sections are visible
            const authSection = document.getElementById('auth-section');
            const chatSection = document.getElementById('chat-section');
            
            // Ensure encryption is enabled by default
            const encryptCheckbox = document.getElementById('encrypt-checkbox');
            if (encryptCheckbox) {
                encryptCheckbox.checked = true;
            }
            if (authSection) authSection.style.display = 'none';
            if (chatSection) chatSection.style.display = 'flex';
            
            await loadConversations();
        } else {
            // Token invalid, clear session
            clearStoredSession();
            showAuthSection();
        }
    } catch (error) {
        // Error verifying session
        clearStoredSession();
        showAuthSection();
    }
}

// Clear stored session
function clearStoredSession() {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    currentToken = null;
    currentUser = null;
}

// Show auth section
function showAuthSection() {
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('chat-section').style.display = 'none';
}

// Initialize on page load - check immediately
(function() {
    // Check if we have a stored session
    const storedToken = localStorage.getItem('chat_token');
    const storedUser = localStorage.getItem('chat_user');
    
    if (storedToken && storedUser) {
        // We have a session, load it immediately
        try {
            currentToken = storedToken;
            currentUser = JSON.parse(storedUser);
            // Show chat section immediately (auth is already hidden by inline script)
            const chatSection = document.getElementById('chat-section');
            if (chatSection) chatSection.style.display = 'flex';
            const authSection = document.getElementById('auth-section');
            if (authSection) authSection.style.display = 'none';
        } catch (e) {
            // Error loading session
        }
    } else {
        // No session, show auth section
        const authSection = document.getElementById('auth-section');
        if (authSection) authSection.style.display = 'flex';
        const chatSection = document.getElementById('chat-section');
        if (chatSection) chatSection.style.display = 'none';
    }
    
    // Now verify the session is still valid
    window.addEventListener('DOMContentLoaded', () => {
        loadStoredSession();
    });
})();

// Authentication Functions
function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    if (!email || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }
    
    try {
        const formData = new URLSearchParams();
        formData.append('username', email); // OAuth2PasswordRequestForm uses 'username' field, but we'll accept email
        formData.append('password', password);
        
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            const errorMessage = error.detail || 'Login failed';
            if (errorMessage.includes('Incorrect') || errorMessage.includes('password')) {
                throw new Error('Incorrect email or password. Please check your credentials or register a new account.');
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        currentToken = data.access_token;
        
        // Save token to localStorage
        localStorage.setItem('chat_token', currentToken);
        
        // Get user info
        const userResponse = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!userResponse.ok) {
            throw new Error('Failed to get user information');
        }
        
        const userData = await userResponse.json();
        currentUser = userData;
        
        // Save user data to localStorage
        localStorage.setItem('chat_user', JSON.stringify(userData));
        
        // Set user avatar and name
        const avatarText = currentUser.username.charAt(0).toUpperCase();
        document.getElementById('user-avatar-text').textContent = avatarText;
        document.getElementById('current-user-name').textContent = currentUser.username;
        
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('chat-section').style.display = 'flex';
        
        // Ensure encryption is enabled by default
        const encryptCheckbox = document.getElementById('encrypt-checkbox');
        if (encryptCheckbox) {
            encryptCheckbox.checked = true;
        }
        
        await loadConversations();
    } catch (error) {
        errorDiv.textContent = error.message;
    }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');
    
    if (!username || !email || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }
        
        // Auto login after registration
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').value = password;
        await login();
    } catch (error) {
        errorDiv.textContent = error.message;
    }
}

function logout() {
    // Clear stored session
    clearStoredSession();
    
    currentConversation = null;
    clearPendingFiles(); // Clear any pending files on logout
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('chat-section').style.display = 'none';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-username').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
}

// Conversation Functions
async function loadConversations() {
    try {
        const response = await fetch(`${API_BASE}/api/conversations/`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load conversations');
        
        conversations = await response.json();
        renderConversations();
    } catch (error) {
        // Error loading conversations
    }
}

function renderConversations() {
    const list = document.getElementById('conversations-list');
    list.innerHTML = '';
    
    if (conversations.length === 0) {
        // Show tutorial button for new users
        list.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="color: #8696a0; margin-bottom: 20px;">No conversations yet. Start a new chat!</div>
                <button onclick="showTutorial()" class="tutorial-trigger-btn" style="
                    background: #25d366;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                ">📖 Show Me How to Use This App</button>
            </div>
        `;
        
        // Show tutorial automatically for first-time users (check localStorage)
        const hasSeenTutorial = localStorage.getItem('has_seen_tutorial');
        if (!hasSeenTutorial) {
            setTimeout(() => {
                showTutorial();
            }, 500); // Small delay to let UI render
        }
        return;
    }
    
    const query = document.getElementById('search-conversations').value.trim();
    const hasSearchQuery = query && query.length > 0;
    const queryLower = query.toLowerCase();
    let visibleCount = 0;
    
    conversations.forEach(conv => {
        // If searching, only show conversations that match
        if (hasSearchQuery) {
            // Check if conversation ID is in search results (message content match)
            const inSearchResults = searchResults.has(`conv-${conv.id}`);
            // Check if name matches
            const nameMatch = conv.other_username.toLowerCase().includes(queryLower);
            // Check if last message matches
            const messageMatch = (conv.last_message || '').toLowerCase().includes(queryLower);
            
            if (!inSearchResults && !nameMatch && !messageMatch) {
                return; // Skip this conversation
            }
        }
        
        visibleCount++;
        
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (currentConversation && currentConversation.id === conv.id) {
            item.classList.add('active');
        }
        item.onclick = () => openConversation(conv.id);
        
        const avatarText = conv.other_username.charAt(0).toUpperCase();
        const lastMessage = conv.last_message || 'No messages yet';
        const time = formatTime(conv.last_message_at);
        
        // Highlight search term in name and message
        let displayName = escapeHtml(conv.other_username);
        let displayMessage = escapeHtml(lastMessage);
        
        if (hasSearchQuery && queryLower) {
            const regex = new RegExp(`(${queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            displayName = displayName.replace(regex, '<mark style="background: #25d366; color: #0b141a; padding: 2px 4px; border-radius: 3px; font-weight: 600;">$1</mark>');
            displayMessage = displayMessage.replace(regex, '<mark style="background: #25d366; color: #0b141a; padding: 2px 4px; border-radius: 3px; font-weight: 600;">$1</mark>');
        }
        
        item.innerHTML = `
            <div class="conversation-avatar">${avatarText}</div>
            <div class="conversation-info">
                <div class="conversation-header">
                    <span class="conversation-name">${displayName}</span>
                    <span class="conversation-time">${time}</span>
                </div>
                <div class="conversation-preview">
                    <span class="conversation-last-message">${displayMessage}</span>
                    ${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : ''}
                </div>
            </div>
        `;
        
        list.appendChild(item);
    });
    
    // Show message if search returned no results
    if (hasSearchQuery && list.children.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #8696a0;">No conversations found matching your search.</div>';
    }
}

async function openConversation(conversationId) {
    // Close existing connection
    if (websocket) {
        websocket.close();
    }
    
    // Clear room polling if active
    if (window.roomPollInterval) {
        clearInterval(window.roomPollInterval);
        window.roomPollInterval = null;
    }
    
    // Find conversation data
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;
    
    currentConversation = conv;
    currentRoom = null; // Clear room when opening conversation
    clearPendingFiles(); // Clear any pending files when switching conversations
    renderConversations();
    
    // Update UI
    document.getElementById('no-conversation-selected').style.display = 'none';
    document.getElementById('chat-conversation').style.display = 'flex';
    
    // Hide "Add Members" button for conversations
    document.getElementById('chat-header-actions').style.display = 'none';
    
    const avatarText = conv.other_username.charAt(0).toUpperCase();
    document.getElementById('chat-avatar-text').textContent = avatarText;
    document.getElementById('chat-username').textContent = conv.other_username;
    
    // Update online status and last seen
    updateChatStatus(conv.other_user_online, conv.other_user_last_seen);
    
    document.getElementById('messages-container').innerHTML = '';
    
    // Load message history
    await loadMessages(conversationId);
    
    // Connect WebSocket
    connectWebSocket(conversationId);
}

async function loadMessages(conversationId, skip = 0, limit = 50, append = false) {
    try {
        if (messagePagination.loading) return;
        messagePagination.loading = true;
        
        const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages?skip=${skip}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load messages');
        
        const messages = await response.json();
        const container = document.getElementById('messages-container');
        
        if (!append) {
            container.innerHTML = '';
        }
        
        // Store scroll position before adding messages
        const wasAtTop = container.scrollTop < 100;
        const oldScrollHeight = container.scrollHeight;
        
        if (append) {
            // Add older messages at the top
            messages.reverse().forEach(msg => {
                const messageElement = addMessageToUI(msg, false, true); // true = prepend
            });
            
            // Restore scroll position
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
        } else {
            // Add messages normally
            messages.forEach(msg => {
                addMessageToUI(msg);
            });
            scrollToBottom();
        }
        
        // Update pagination state
        messagePagination.skip = skip + messages.length;
        messagePagination.hasMore = messages.length === limit;
        messagePagination.loading = false;
        
        // Show/hide load more indicator
        const loadMoreIndicator = document.getElementById('load-more-indicator');
        if (loadMoreIndicator) {
            loadMoreIndicator.style.display = messagePagination.hasMore ? 'block' : 'none';
        }
    } catch (error) {
        // Error loading messages
        messagePagination.loading = false;
    }
}

// Load older messages on scroll up
function setupInfiniteScroll() {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    container.addEventListener('scroll', () => {
        if (container.scrollTop < 100 && messagePagination.hasMore && !messagePagination.loading) {
            if (currentConversation) {
                loadMessages(currentConversation.id, messagePagination.skip, 50, true);
            } else if (currentRoom) {
                loadRoomMessages(currentRoom.id, messagePagination.skip, 50, true);
            }
        }
    });
}

let currentWebSocketConversationId = null;

function connectWebSocket(conversationId) {
    if (!currentToken) {
        return;
    }
    
    // Don't reconnect if already connected to the same conversation
    if (websocket && 
        websocket.readyState === WebSocket.OPEN && 
        currentWebSocketConversationId === conversationId) {
        return;
    }
    
    // Close existing connection if connecting to a different conversation
    if (websocket && websocket.readyState !== WebSocket.CLOSED) {
        websocket.close();
        websocket = null;
    }
    
    currentWebSocketConversationId = conversationId;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/conversation/${conversationId}?token=${currentToken}`;
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
        // WebSocket connected successfully
    };
    
    websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            // Silently handle parsing errors
        }
    };
    
    websocket.onerror = () => {
        // WebSocket error - connection will be handled by onclose
    };
    
    websocket.onclose = (event) => {
        currentWebSocketConversationId = null;
        // Code 1005 = No Status Received (normal closure - browser/tab closed)
        // Code 1008 = Policy Violation (token expired/invalid)
        if (event.code === 1008) {
            showToast('Your session has expired. Please refresh the page and login again.', 'error', 6000);
        }
        // Don't reconnect automatically - let user action trigger reconnection
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'message':
            // Check if message already exists by ID (prevent duplicates)
            const container = document.getElementById('messages-container');
            const existingById = container.querySelector(`[data-message-id="${data.id}"]`);
            if (existingById) {
                // Message already exists, just update status if needed
                if (data.status) {
                    updateMessageStatus(data.id, data.status);
                }
                return; // Don't process further
            }
            
            // Check if this is a confirmation of a pending message (only for our own messages)
            const isOurMessage = parseInt(data.sender_id) === parseInt(currentUser.id);
            if (isOurMessage) {
                const messageKey = `${data.content}-${data.sender_id}`;
                const pendingElement = pendingMessages.get(messageKey);
                
                if (pendingElement) {
                    // Check if the pending element still exists in DOM
                    if (pendingElement.parentNode) {
                        // Replace the pending message with the real one
                        const realMessage = {
                            id: data.id,
                            content: data.content,
                            sender_id: data.sender_id,
                            sender_username: data.sender_username,
                            status: data.status,
                            message_type: data.message_type || 'text',
                            file_path: data.file_path,
                            file_name: data.file_name,
                            is_encrypted: data.is_encrypted || false,
                            created_at: data.timestamp || data.created_at
                        };
                        
                        // Remove the pending message from DOM
                        pendingElement.parentNode.removeChild(pendingElement);
                        pendingMessages.delete(messageKey);
                        
                        // Add the real message
                        addMessageToUI(realMessage);
                    } else {
                        // Pending element was already removed, just add the real message
                        pendingMessages.delete(messageKey);
                        addMessageToUI({
                            id: data.id,
                            content: data.content,
                            sender_id: data.sender_id,
                            sender_username: data.sender_username,
                            status: data.status,
                            message_type: data.message_type || 'text',
                            file_path: data.file_path,
                            file_name: data.file_name,
                            is_encrypted: data.is_encrypted || false,
                            created_at: data.timestamp || data.created_at
                        });
                    }
                } else {
                    // No pending message found, check if we already have this content
                    const allSentMessages = container.querySelectorAll('.message.sent');
                    let foundDuplicate = false;
                    for (let msg of allSentMessages) {
                        const msgContent = msg.querySelector('.message-content');
                        if (msgContent && msgContent.textContent.trim() === data.content.trim()) {
                            // Found duplicate, update its ID and status
                            msg.setAttribute('data-message-id', data.id);
                            const statusEl = msg.querySelector('.message-status');
                            if (statusEl) {
                                statusEl.setAttribute('data-message-id', data.id);
                                statusEl.className = `message-status ${data.status || 'sent'}`;
                            }
                            foundDuplicate = true;
                            break;
                        }
                    }
                    
                    if (!foundDuplicate) {
                        // Add as new message
                        addMessageToUI({
                            id: data.id,
                            content: data.content,
                            sender_id: data.sender_id,
                            sender_username: data.sender_username,
                            status: data.status,
                            message_type: data.message_type || 'text',
                            file_path: data.file_path,
                            file_name: data.file_name,
                            is_encrypted: data.is_encrypted || false,
                            created_at: data.timestamp || data.created_at
                        });
                    }
                }
            } else {
                // Message from another user - always add it (no duplicates expected)
                addMessageToUI({
                    id: data.id,
                    content: data.content,
                    sender_id: data.sender_id,
                    sender_username: data.sender_username,
                    status: data.status,
                    created_at: data.timestamp
                });
            }
            
            scrollToBottom();
            // Reload conversations to update last message
            loadConversations();
            break;
        
        case 'message_sent':
            // Handle message sent confirmation (backward compatibility)
            // The message should already be displayed via 'message' type
            break;
        
        case 'typing':
            showTypingIndicator(data.username, data.is_typing);
            break;
        
        case 'status_update':
            updateMessageStatus(data.message_id, data.status);
            break;
        
        case 'user_status':
            // Update online status of other user
            if (currentConversation && data.user_id === currentConversation.other_user_id) {
                updateChatStatus(data.is_online, data.last_seen ? new Date(data.last_seen) : null);
            }
            break;
    }
}

function addMessageToUI(message, isRoomMessage = false, prepend = false) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    // Check if message already exists by ID (to avoid duplicates)
    const existingMessage = container.querySelector(`[data-message-id="${message.id}"]`);
    if (existingMessage) {
        // Update existing message status if needed
        if (message.status) {
            const statusElement = existingMessage.querySelector(`.message-status[data-message-id="${message.id}"]`);
            if (statusElement) {
                statusElement.className = `message-status ${message.status}`;
            }
        }
        return existingMessage;
    }
    
    const messageDiv = document.createElement('div');
    
    // Ensure we compare numbers correctly (convert to int if needed)
    const senderId = parseInt(message.sender_id);
    const userId = parseInt(currentUser.id);
    const isSent = senderId === userId;
    
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // For room messages, show sender name for received messages (add before content)
    if (isRoomMessage && !isSent && message.sender_username) {
        const senderName = document.createElement('div');
        senderName.className = 'message-sender-name';
        senderName.textContent = message.sender_username;
        senderName.style.fontSize = '12px';
        senderName.style.color = '#53bdeb';
        senderName.style.marginBottom = '2px';
        senderName.style.fontWeight = '500';
        bubble.appendChild(senderName);
    }
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    // Handle different message types
    if (message.message_type === 'file' || message.message_type === 'image') {
        // Check if file is uploading
        if (message.is_uploading || message.status === 'uploading') {
            // Show loading state
            const loadingContainer = document.createElement('div');
            loadingContainer.className = 'file-upload-container';
            
            if (message.message_type === 'image') {
                // For images, show preview with loading overlay
                const imgContainer = document.createElement('div');
                imgContainer.className = 'image-upload-container';
                
                // Create image preview from file if available
                const img = document.createElement('div');
                img.className = 'image-upload-preview';
                img.style.background = '#2a3942';
                img.style.minHeight = '200px';
                img.style.borderRadius = '8px';
                img.style.display = 'flex';
                img.style.alignItems = 'center';
                img.style.justifyContent = 'center';
                img.style.position = 'relative';
                
                const loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'upload-loading-overlay';
                loadingOverlay.innerHTML = `
                    <div class="upload-spinner"></div>
                    <div class="upload-text">Uploading...</div>
                `;
                
                img.appendChild(loadingOverlay);
                imgContainer.appendChild(img);
                loadingContainer.appendChild(imgContainer);
            } else {
                // For files, show file info with loading spinner
                const fileInfo = document.createElement('div');
                fileInfo.className = 'file-upload-info';
                fileInfo.innerHTML = `
                    <div class="file-upload-icon">📎</div>
                    <div class="file-upload-details">
                        <div class="file-upload-name">${escapeHtml(message.file_name || 'File')}</div>
                        <div class="file-upload-size">${formatFileSize(message.file_size || 0)}</div>
                    </div>
                    <div class="upload-spinner"></div>
                `;
                loadingContainer.appendChild(fileInfo);
            }
            
            content.appendChild(loadingContainer);
        } else if (message.file_path) {
            // File is uploaded, show normal file display
            // Get token from currentToken or localStorage
            const token = currentToken || localStorage.getItem('chat_token') || '';
            // Append token to file URL for authentication
            const fileUrl = message.file_path + (message.file_path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
            
            const fileLink = document.createElement('a');
            fileLink.href = fileUrl;
            fileLink.target = '_blank';
            fileLink.className = 'file-message';
            fileLink.download = message.file_name || '';
            
            if (message.message_type === 'image') {
                const img = document.createElement('img');
                img.src = fileUrl;
                img.alt = message.file_name || 'Image';
                img.className = 'message-image';
                img.loading = 'lazy';
                // Handle image load errors
                img.onerror = function() {
                    // Failed to load image
                    this.style.display = 'none';
                    const errorText = document.createElement('span');
                    errorText.textContent = '📎 ' + (message.file_name || 'Image') + ' (Click to download)';
                    if (!fileLink.querySelector('span')) {
                        fileLink.appendChild(errorText);
                    }
                };
                fileLink.appendChild(img);
            } else {
                fileLink.textContent = `📎 ${message.file_name || 'File'}`;
            }
            
            content.appendChild(fileLink);
        } else {
            content.textContent = escapeHtml(message.content);
        }
    } else {
        // Text message - support emojis and line breaks
        content.innerHTML = escapeHtml(message.content).replace(/\n/g, '<br>');
    }
    
    // Add reply preview if message is a reply
    if (message.reply_to_id && message.reply_to_content) {
        const replyPreview = document.createElement('div');
        replyPreview.className = 'reply-preview';
        replyPreview.innerHTML = `
            <div class="reply-preview-line"></div>
            <div class="reply-preview-content">
                <div class="reply-preview-sender">${escapeHtml(message.reply_to_sender || 'Unknown')}</div>
                <div class="reply-preview-text">${escapeHtml(message.reply_to_content)}</div>
            </div>
        `;
        bubble.insertBefore(replyPreview, content);
    }
    
    // All messages are encrypted by default, no need to show lock icon
    
    // Show "edited" indicator if message was edited
    if (message.is_edited) {
        const editedLabel = document.createElement('span');
        editedLabel.textContent = ' (edited)';
        editedLabel.className = 'edited-label';
        editedLabel.style.fontSize = '11px';
        editedLabel.style.color = '#8696a0';
        editedLabel.style.fontStyle = 'italic';
        content.appendChild(editedLabel);
    }
    
    bubble.appendChild(content);
    
    const footer = document.createElement('div');
    footer.className = 'message-footer';
    
    const time = document.createElement('span');
    time.className = 'message-time';
    // Debug: log timestamp to see what we're receiving
    // console.log('Message timestamp:', message.created_at, 'Formatted:', formatMessageTime(message.created_at));
    time.textContent = formatMessageTime(message.created_at);
    
    footer.appendChild(time);
    
    // Only show status indicators for sent messages
    if (isSent) {
        const status = document.createElement('span');
        status.className = `message-status ${message.status || 'sent'}`;
        status.setAttribute('data-message-id', message.id);
        footer.appendChild(status);
    }
    
    bubble.appendChild(footer);
    
    // Add message actions (edit/delete/reply) for sent messages
    if (isSent && !message.is_deleted) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="msg-action-btn" onclick="replyToMessage(${message.id})" title="Reply">↩️</button>
            <button class="msg-action-btn" onclick="editMessage(${message.id})" title="Edit">✏️</button>
            <button class="msg-action-btn" onclick="deleteMessage(${message.id})" title="Delete">🗑️</button>
        `;
        messageDiv.appendChild(actions);
    }
    
    // Add reply button for received messages
    if (!isSent && !message.is_deleted) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="msg-action-btn" onclick="replyToMessage(${message.id})" title="Reply">↩️</button>
        `;
        messageDiv.appendChild(actions);
    }
    
    messageDiv.appendChild(bubble);
    
    // Append or prepend based on parameter
    if (prepend) {
        const loadMoreIndicator = container.querySelector('#load-more-indicator');
        if (loadMoreIndicator) {
            container.insertBefore(messageDiv, loadMoreIndicator.nextSibling);
        } else {
            container.insertBefore(messageDiv, container.firstChild);
        }
    } else {
        container.appendChild(messageDiv);
    }
    
    return messageDiv; // Return the element so we can track it
}

function updateMessageStatus(messageId, status) {
    const statusElement = document.querySelector(`.message-status[data-message-id="${messageId}"]`);
    if (statusElement) {
        statusElement.className = `message-status ${status}`;
    }
}

function updateChatStatus(isOnline, lastSeen) {
    const statusElement = document.getElementById('chat-status');
    if (!statusElement) return;
    
    if (isOnline) {
        statusElement.textContent = 'online';
        statusElement.className = 'chat-status online';
    } else if (lastSeen) {
        const lastSeenDate = new Date(lastSeen);
        const now = new Date();
        const diffMs = now - lastSeenDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let statusText = 'last seen ';
        if (diffMins < 1) {
            statusText += 'just now';
        } else if (diffMins < 60) {
            statusText += `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            statusText += `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            statusText += `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            statusText += lastSeenDate.toLocaleDateString();
        }
        
        statusElement.textContent = statusText;
        statusElement.className = 'chat-status offline';
    } else {
        statusElement.textContent = 'offline';
        statusElement.className = 'chat-status offline';
    }
}

function showTypingIndicator(username, isTyping) {
    const indicator = document.getElementById('typing-indicator');
    if (isTyping && username !== currentUser.username) {
        indicator.textContent = `${username} is typing...`;
    } else {
        indicator.textContent = '';
    }
}

// Message Functions
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    // Check if we have files to send or text content
    if (!content && pendingFiles.length === 0) {
        return;
    }
    
    // Encryption is enabled by default
    const encrypt = document.getElementById('encrypt-checkbox')?.checked !== false; // Default to true
    const replyToId = replyingToMessage ? replyingToMessage.id : null;
    
    // If there are pending files, upload them first
    if (pendingFiles.length > 0) {
        const filesToUpload = [...pendingFiles]; // Copy array
        clearPendingFiles(); // Clear preview immediately
        
        for (let file of filesToUpload) {
            await uploadFile(file);
        }
    }
    
    // If there's text content, send it
    if (content) {
        // If it's a room, use HTTP API
        if (currentRoom) {
            await sendRoomMessage(content, encrypt, replyToId);
            input.value = '';
            cancelReply();
            return;
        }
        
        // For conversations, use WebSocket
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            // WebSocket is not connected
            showToast('Connection lost. Please refresh the page.', 'error', 5000);
            return;
        }
        
        // Track pending message by content (we'll replace it when server confirms)
        const messageKey = `${content}-${currentUser.id}`;
        
        // Optimistically add message to UI immediately
        // Use current local time for immediate display (will be replaced by server timestamp)
        const now = new Date();
        const tempMessage = {
            id: `temp-${Date.now()}`, // Temporary ID with prefix
            content: content,
            sender_id: currentUser.id,
            sender_username: currentUser.username,
            status: 'sent',
            reply_to_id: replyToId,
            reply_to_content: replyingToMessage ? replyingToMessage.content : null,
            reply_to_sender: replyingToMessage ? replyingToMessage.sender : null,
            created_at: now.toISOString() // UTC timestamp - will be converted to local time in formatMessageTime
        };
        
        const messageElement = addMessageToUI(tempMessage);
        if (messageElement) {
            pendingMessages.set(messageKey, messageElement);
        }
        
        scrollToBottom();
        
        // Send to server via WebSocket
        websocket.send(JSON.stringify({
            type: 'message',
            content: content,
            encrypt: encrypt,
            message_type: 'text',
            reply_to_id: replyToId
        }));
        
        input.value = '';
        cancelReply();
        clearTypingIndicator();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendRoomMessage(content, encrypt, replyToId = null) {
    if (!currentRoom) return;
    
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content: content,
                encrypt: encrypt,
                message_type: 'text',
                reply_to_id: replyToId
            })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
            throw new Error(error.detail || 'Failed to send message');
        }
        
        const message = await response.json();
        
        // Add message to UI (mark as room message)
        addMessageToUI(message, true);
        scrollToBottom();
        
        // Reload room messages to get latest
        await loadRoomMessages(currentRoom.id);
        
        // Reload rooms list to update last message
        await loadRooms();
    } catch (error) {
        // Error sending room message
        showToast('Failed to send message. Please try again.', 'error');
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

let typingTimer = null;
function handleTyping() {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    
    websocket.send(JSON.stringify({
        type: 'typing',
        is_typing: true
    }));
    
    clearTimeout(typingTimer);
    
    typingTimer = setTimeout(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'typing',
                is_typing: false
            }));
        }
    }, 3000);
}

function clearTypingIndicator() {
    if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
    }
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'typing',
            is_typing: false
        }));
    }
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

// Search Functions
let searchResults = new Set(); // Store IDs of conversations/rooms that match search
let messageSearchTimeout = null; // Timeout for message search debouncing

async function searchConversations() {
    const query = document.getElementById('search-conversations').value.trim();
    const searchInput = document.getElementById('search-conversations');
    
    // Clear previous timeout
    clearTimeout(messageSearchTimeout);
    
    // If query is empty, show all conversations/rooms
    if (!query || query.length === 0) {
        searchResults.clear();
        renderConversations();
        if (document.getElementById('rooms-list').style.display !== 'none') {
            renderRooms();
        }
        return;
    }
    
    // Debounce search - wait 300ms after user stops typing
    messageSearchTimeout = setTimeout(async () => {
        try {
            const token = currentToken || localStorage.getItem('chat_token');
            searchResults.clear();
            
            // Search in conversations (chats)
            if (document.getElementById('chats-tab').classList.contains('active')) {
                const convResponse = await fetch(`${API_BASE}/api/conversations/search/messages?q=${encodeURIComponent(query)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (convResponse.ok) {
                    const convMatches = await convResponse.json();
                    // Handle both array of IDs and array of objects with id property
                    convMatches.forEach(match => {
                        const convId = typeof match === 'object' ? match.id : match;
                        if (convId) {
                            searchResults.add(`conv-${convId}`);
                        }
                    });
                }
            }
            
            // Search in rooms
            if (document.getElementById('rooms-tab').classList.contains('active')) {
                const roomResponse = await fetch(`${API_BASE}/api/rooms/search/messages?q=${encodeURIComponent(query)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (roomResponse.ok) {
                    const roomMatches = await roomResponse.json();
                    roomMatches.forEach(match => {
                        const roomId = typeof match === 'object' ? match.id : match;
                        if (roomId) {
                            searchResults.add(`room-${roomId}`);
                        }
                    });
                }
            }
            
            // Re-render with search filter
            if (document.getElementById('chats-tab').classList.contains('active')) {
                renderConversations();
            } else {
                renderRooms();
            }
            
        } catch (error) {
            // Error searching messages
            showToast('Search failed. Using name-based search.', 'warning');
            // Fallback to name-based search
            const queryLower = query.toLowerCase();
            const items = document.querySelectorAll('.conversation-item');
            items.forEach(item => {
                const name = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
                if (name.includes(queryLower)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        }
    }, 300);
    
    // Also do immediate name-based filtering for better UX
    const queryLower = query.toLowerCase();
    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
        const name = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
        const lastMessage = item.querySelector('.conversation-last-message')?.textContent.toLowerCase() || '';
        if (name.includes(queryLower) || lastMessage.includes(queryLower)) {
            item.style.display = 'flex';
        } else if (query.length > 0) {
            // Hide if doesn't match name or preview, but wait for API search
            // Don't hide immediately to avoid flicker
        }
    });
}

let allUsersList = []; // Store all users for the New Chat modal

async function showSearchUsers() {
    const modal = document.getElementById('search-users-modal');
    const resultsDiv = document.getElementById('search-users-results');
    
    modal.style.display = 'flex';
    document.getElementById('search-users-input').focus();
    
    // Load all users when modal opens
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/conversations/users/all`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        allUsersList = await response.json();
        renderAllUsersInModal(allUsersList);
    } catch (error) {
        // Error loading users
        resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #8696a0;">Failed to load users. Please try again.</div>';
    }
}

function closeSearchUsersModal() {
    document.getElementById('search-users-modal').style.display = 'none';
    document.getElementById('search-users-input').value = '';
    document.getElementById('search-users-results').innerHTML = '';
    allUsersList = [];
}

function renderAllUsersInModal(users) {
    const resultsDiv = document.getElementById('search-users-results');
    resultsDiv.innerHTML = '';
    
    if (users.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #8696a0;">No users found</div>';
        return;
    }
    
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-result-item';
        item.onclick = async () => {
            await startConversation(user.id);
            closeSearchUsersModal();
        };
        
        const avatarText = user.username.charAt(0).toUpperCase();
        item.innerHTML = `
            <div class="user-result-avatar">${avatarText}</div>
            <div class="user-result-info">
                <div class="user-result-name">${escapeHtml(user.username)}</div>
                <div class="user-result-email">${escapeHtml(user.email)}</div>
            </div>
        `;
        
        resultsDiv.appendChild(item);
    });
}

let searchUsersTimeout = null;
function searchUsers() {
    const query = document.getElementById('search-users-input').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('search-users-results');
    
    clearTimeout(searchUsersTimeout);
    
    // If no query, show all users
    if (!query || query.length === 0) {
        renderAllUsersInModal(allUsersList);
        return;
    }
    
    // Filter users client-side (instant search)
    const filteredUsers = allUsersList.filter(user => {
        const usernameMatch = user.username.toLowerCase().includes(query);
        const emailMatch = user.email.toLowerCase().includes(query);
        return usernameMatch || emailMatch;
    });
    
    renderAllUsersInModal(filteredUsers);
}

async function startConversation(userId) {
    try {
        const response = await fetch(`${API_BASE}/api/conversations/with/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to start conversation');
        
        const conversation = await response.json();
        await loadConversations();
        await openConversation(conversation.id);
    } catch (error) {
        // Error starting conversation
        showToast('Failed to start conversation. Please try again.', 'error');
    }
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateString) {
    if (!dateString) return '';
    
    // Parse the date string - JavaScript automatically converts UTC to local time
    let date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '';
    }
    
    // Get current date in local timezone for comparison
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Calculate time difference
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // If message is from today, show time in local timezone
    if (messageDateStart.getTime() === todayStart.getTime()) {
        // Show time in 12-hour format with AM/PM (local time)
        return date.toLocaleTimeString(navigator.language || 'en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        // This week - show day name
        return date.toLocaleDateString(navigator.language || 'en-US', { weekday: 'short' });
    } else {
        // Older - show date
        return date.toLocaleDateString(navigator.language || 'en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }
}

function formatMessageTime(dateString) {
    if (!dateString) return '';
    
    // Parse the date string - always treat ISO strings as UTC if no timezone specified
    let date;
    try {
        if (typeof dateString === 'string') {
            // Check if it's an ISO string (contains 'T')
            if (dateString.includes('T')) {
                // Check if it has timezone info (ends with Z, +HH:MM, or -HH:MM)
                const hasTimezone = dateString.endsWith('Z') || 
                                   /[+-]\d{2}:?\d{2}$/.test(dateString) ||
                                   /[+-]\d{4}$/.test(dateString);
                
                if (!hasTimezone) {
                    // ISO string without timezone - treat as UTC by appending 'Z'
                    date = new Date(dateString + 'Z');
                } else {
                    // Has timezone info - parse directly
                    date = new Date(dateString);
                }
            } else {
                // Not an ISO string - try to parse as-is
                date = new Date(dateString);
            }
        } else {
            date = new Date(dateString);
        }
    } catch (e) {
            // Error parsing date
        return '';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        // Invalid date
        return '';
    }
    
    // Get current date in local timezone for comparison
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get message date in local timezone (extract year, month, day from local time)
    const messageYear = date.getFullYear();
    const messageMonth = date.getMonth();
    const messageDay = date.getDate();
    const messageDateStart = new Date(messageYear, messageMonth, messageDay);
    
    // Calculate time difference
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    
    // Extract local time values (these are already in local timezone)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const timeStr = `${displayHours}:${displayMinutes} ${ampm}`;
    
    // If message is from today, show only time in local timezone
    if (messageDateStart.getTime() === todayStart.getTime()) {
        return timeStr;
    } else if (diffDays === 1) {
        // Yesterday - show "Yesterday" and time
        return `Yesterday ${timeStr}`;
    } else if (diffDays < 7) {
        // This week - show day name and time
        const dayName = date.toLocaleDateString(navigator.language || 'en-US', { weekday: 'short' });
        return `${dayName} ${timeStr}`;
    } else {
        // Older - show date and time
        const month = date.toLocaleDateString(navigator.language || 'en-US', { month: 'short' });
        const day = date.getDate();
        const year = date.getFullYear() !== now.getFullYear() ? `, ${date.getFullYear()}` : '';
        return `${month} ${day}${year} ${timeStr}`;
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('search-users-modal');
    if (event.target === modal) {
        closeSearchUsersModal();
    }
}

// Auto-refresh conversations every 30 seconds
setInterval(() => {
    if (currentUser && currentToken) {
        loadConversations();
    }
}, 30000);

// Global state for rooms
let currentRoom = null;
let rooms = [];
let currentTab = 'chats';

// Emoji picker
const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😴', '😭', '😡', '👍', '👎', '❤️', '🔥', '💯', '🎉', '✅', '❌', '⭐', '💪', '🙏', '👏', '🎊', '🎈', '🎁', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️‍🔥', '❤️‍🩹', '💋', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️‍🔥', '❤️‍🩹', '💋', '💘'];

function initEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    
    picker.innerHTML = '';
    EMOJIS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.className = 'emoji-item';
        btn.onclick = () => insertEmoji(emoji);
        picker.appendChild(btn);
    });
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    
    if (picker.style.display === 'none' || !picker.style.display) {
        picker.style.display = 'grid';
        if (picker.children.length === 0) {
            initEmojiPicker();
        }
    } else {
        picker.style.display = 'none';
    }
}

function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    if (input) {
        input.value += emoji;
        input.focus();
    }
    toggleEmojiPicker();
}

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emoji-picker');
    const emojiBtn = document.querySelector('.emoji-btn');
    if (picker && emojiBtn && !picker.contains(e.target) && !emojiBtn.contains(e.target)) {
        picker.style.display = 'none';
    }
});

// File upload
function handleFileSelect(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (!currentConversation && !currentRoom) {
        showToast('Please select a conversation or room first.', 'warning');
        event.target.value = '';
        return;
    }
    
    // Add files to pending files list
    for (let file of Array.from(files)) {
        pendingFiles.push(file);
    }
    
    // Show preview
    showFilePreview();
    
    // Reset input to allow selecting same file again
    event.target.value = '';
}

function showFilePreview() {
    const container = document.getElementById('file-preview-container');
    if (!container) return;
    
    if (pendingFiles.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.innerHTML = '';
    container.style.display = 'block';
    
    pendingFiles.forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        
        const fileIcon = getFileIcon(file);
        const fileSize = formatFileSize(file.size);
        
        previewItem.innerHTML = `
            <div class="file-preview-icon">${fileIcon}</div>
            <div class="file-preview-info">
                <div class="file-preview-name">${file.name}</div>
                <div class="file-preview-size">${fileSize}</div>
            </div>
            <button class="file-preview-remove" onclick="removePendingFile(${index})" title="Remove">×</button>
        `;
        
        // Show image preview if it's an image
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgPreview = document.createElement('img');
                imgPreview.src = e.target.result;
                imgPreview.className = 'file-preview-image';
                previewItem.querySelector('.file-preview-icon').innerHTML = '';
                previewItem.querySelector('.file-preview-icon').appendChild(imgPreview);
            };
            reader.readAsDataURL(file);
        }
        
        container.appendChild(previewItem);
    });
}

function getFileIcon(file) {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.startsWith('video/')) return '🎥';
    if (file.type.startsWith('audio/')) return '🎵';
    if (file.type.includes('pdf')) return '📄';
    if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) return '📝';
    if (file.type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) return '📊';
    if (file.type.includes('zip') || file.type.includes('rar')) return '📦';
    return '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function removePendingFile(index) {
    pendingFiles.splice(index, 1);
    showFilePreview();
}

function clearPendingFiles() {
    pendingFiles = [];
    showFilePreview();
}

let uploadingFiles = new Map(); // Track uploading files: fileId -> messageElement

async function uploadFile(file) {
    // Get token from currentToken or localStorage
    const token = currentToken || localStorage.getItem('chat_token');
    if (!token) {
        showToast('You must be logged in to upload files.', 'warning');
        return;
    }
    
    // Create optimistic message with loading indicator
    const fileId = `upload-${Date.now()}-${Math.random()}`;
    const isImage = file.type.startsWith('image/');
    const now = new Date();
    
    const optimisticMessage = {
        id: fileId,
        content: isImage ? '📷 Photo' : `📎 ${file.name}`,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        status: 'uploading',
        message_type: isImage ? 'image' : 'file',
        file_name: file.name,
        file_size: file.size,
        file_path: null, // Will be set after upload
        created_at: now.toISOString(),
        is_uploading: true,
        uploadFile: file // Store file object for preview
    };
    
    // Add optimistic message to UI
    const messageElement = addMessageToUI(optimisticMessage, !!currentRoom);
    if (messageElement) {
        uploadingFiles.set(fileId, messageElement);
        
        // If it's an image, show preview
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgPreview = messageElement.querySelector('.image-upload-preview');
                if (imgPreview) {
                    imgPreview.style.backgroundImage = `url(${e.target.result})`;
                    imgPreview.style.backgroundSize = 'cover';
                    imgPreview.style.backgroundPosition = 'center';
                }
            };
            reader.readAsDataURL(file);
        }
    }
    scrollToBottom();
    
    const formData = new FormData();
    formData.append('file', file);
    
    if (currentConversation) {
        formData.append('conversation_id', String(currentConversation.id));
    } else if (currentRoom) {
        formData.append('room_id', String(currentRoom.id));
    }
    
    // Encryption is enabled by default
    const encrypt = document.getElementById('encrypt-checkbox')?.checked !== false; // Default to true
    formData.append('encrypt', encrypt ? 'true' : 'false');
    
    try {
        const response = await fetch(`${API_BASE}/api/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'File upload failed' }));
            throw new Error(errorData.detail || 'File upload failed');
        }
        
        const data = await response.json();
        
        // Remove optimistic message
        if (uploadingFiles.has(fileId)) {
            const optimisticElement = uploadingFiles.get(fileId);
            if (optimisticElement && optimisticElement.parentNode) {
                optimisticElement.remove();
            }
            uploadingFiles.delete(fileId);
        }
        
        // Reload messages to show the actual file message
        if (currentConversation) {
            await loadMessages(currentConversation.id);
        } else if (currentRoom) {
            await loadRoomMessages(currentRoom.id);
        }
        
        // Reload conversations/rooms
        if (currentTab === 'chats') {
            await loadConversations();
        } else {
            await loadRooms();
        }
        
        scrollToBottom();
    } catch (error) {
        // Remove optimistic message on error
        if (uploadingFiles.has(fileId)) {
            const optimisticElement = uploadingFiles.get(fileId);
            if (optimisticElement && optimisticElement.parentNode) {
                optimisticElement.remove();
            }
            uploadingFiles.delete(fileId);
        }
        showToast('Failed to upload file. Please try again.', 'error');
    }
}


// Group Rooms Functions
function switchTab(tab) {
    currentTab = tab;
    
    document.getElementById('chats-tab').classList.toggle('active', tab === 'chats');
    document.getElementById('rooms-tab').classList.toggle('active', tab === 'rooms');
    
    document.getElementById('conversations-list').style.display = tab === 'chats' ? 'block' : 'none';
    document.getElementById('rooms-list').style.display = tab === 'rooms' ? 'block' : 'none';
    
    if (tab === 'chats') {
        loadConversations();
    } else {
        loadRooms();
    }
}

async function loadRooms() {
    if (!currentToken) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/rooms/`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load rooms');
        
        rooms = await response.json();
        renderRooms();
    } catch (error) {
        // Error loading rooms
    }
}

function renderRooms() {
    const container = document.getElementById('rooms-list');
    container.innerHTML = '';
    
    if (rooms.length === 0) {
        container.innerHTML = '<div class="no-conversations">No rooms yet. Create one to get started!</div>';
        return;
    }
    
    const query = document.getElementById('search-conversations').value.trim();
    const hasSearchQuery = query && query.length > 0;
    
    rooms.forEach(room => {
        // If searching, only show rooms that match
        if (hasSearchQuery && !searchResults.has(`room-${room.id}`)) {
            // Check if name matches as fallback
            const nameMatch = room.name.toLowerCase().includes(query.toLowerCase());
            const messageMatch = (room.last_message || '').toLowerCase().includes(query.toLowerCase());
            if (!nameMatch && !messageMatch) {
                return; // Skip this room
            }
        }
        
        const roomDiv = document.createElement('div');
        roomDiv.className = `conversation-item ${currentRoom && currentRoom.id === room.id ? 'active' : ''}`;
        roomDiv.onclick = () => openRoom(room.id);
        
        const avatar = document.createElement('div');
        avatar.className = 'conversation-avatar';
        avatar.textContent = room.name.charAt(0).toUpperCase();
        
        const info = document.createElement('div');
        info.className = 'conversation-info';
        
        const name = document.createElement('div');
        name.className = 'conversation-name';
        name.textContent = room.name;
        
        const lastMsg = document.createElement('div');
        lastMsg.className = 'conversation-last-message';
        lastMsg.textContent = room.last_message || 'No messages yet';
        
        const time = document.createElement('div');
        time.className = 'conversation-time';
        time.textContent = room.last_message_at ? formatTime(room.last_message_at) : '';
        
        info.appendChild(name);
        info.appendChild(lastMsg);
        
        roomDiv.appendChild(avatar);
        roomDiv.appendChild(info);
        roomDiv.appendChild(time);
        
        container.appendChild(roomDiv);
    });
    
    // Show message if search returned no results
    if (hasSearchQuery && container.children.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #8696a0;">No rooms found matching your search.</div>';
    }
}

async function openRoom(roomId) {
    if (websocket) {
        websocket.close();
    }
    
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    currentRoom = room;
    currentConversation = null;
    clearPendingFiles(); // Clear any pending files when switching rooms
    renderRooms();
    
    document.getElementById('no-conversation-selected').style.display = 'none';
    document.getElementById('chat-conversation').style.display = 'flex';
    
    const avatarText = room.name.charAt(0).toUpperCase();
    document.getElementById('chat-avatar-text').textContent = avatarText;
    document.getElementById('chat-username').textContent = room.name;
    
    // Show header actions for rooms
    const headerActions = document.getElementById('chat-header-actions');
    if (room) {
        headerActions.style.display = 'flex';
        
        // "See Members" button (👥) - visible to ALL room members
        const infoBtn = document.getElementById('room-info-btn');
        if (infoBtn) {
            infoBtn.style.display = 'block';
        }
        
        // "Add Members" button (➕) - visible ONLY to room creator/admin
        const addBtn = document.getElementById('add-members-btn');
        if (addBtn) {
            if (room.creator_id === currentUser.id) {
                addBtn.style.display = 'block'; // Show for creator
            } else {
                addBtn.style.display = 'none'; // Hide for regular members
            }
        }
    } else {
        headerActions.style.display = 'none';
    }
    
    document.getElementById('messages-container').innerHTML = '';
    
    await loadRoomMessages(roomId);
    
    // Set up polling to refresh room messages every 3 seconds
    if (window.roomPollInterval) {
        clearInterval(window.roomPollInterval);
    }
    window.roomPollInterval = setInterval(async () => {
        if (currentRoom && !currentConversation) {
            await loadRoomMessages(currentRoom.id);
        }
    }, 3000);
}

async function loadRoomMessages(roomId) {
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/rooms/${roomId}/messages?limit=50`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to load messages' }));
            throw new Error(error.detail || 'Failed to load messages');
        }
        
        const messages = await response.json();
        const container = document.getElementById('messages-container');
        if (!container) return;
        
        // Check if this is initial load (container is empty) or polling update
        const isInitialLoad = container.children.length === 0;
        
        if (isInitialLoad) {
            // Initial load - clear and add all messages
            container.innerHTML = '';
            messages.forEach(msg => {
                addMessageToUI(msg, true); // Pass true to indicate it's a room message
            });
            scrollToBottom();
        } else {
            // Polling update - only add new messages
            const existingIds = new Set();
            container.querySelectorAll('[data-message-id]').forEach(el => {
                const id = el.getAttribute('data-message-id');
                if (id && !id.startsWith('temp-')) {
                    existingIds.add(parseInt(id));
                }
            });
            
            // Store scroll position
            const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
            
            // Add only new messages
            let hasNewMessages = false;
            messages.forEach(msg => {
                if (!existingIds.has(msg.id)) {
                    addMessageToUI(msg, true);
                    hasNewMessages = true;
                }
            });
            
            // Scroll to bottom if user was at bottom and there are new messages
            if (wasAtBottom && hasNewMessages) {
                scrollToBottom();
            }
        }
    } catch (error) {
        // Error loading room messages
        // Only show alert on initial load, not on polling errors
        const container = document.getElementById('messages-container');
        if (container && container.children.length === 0) {
            showToast('Failed to load messages. Please refresh.', 'error');
        }
    }
}

function openCreateRoomModal() {
    document.getElementById('create-room-modal').style.display = 'block';
}

function closeCreateRoomModal() {
    document.getElementById('create-room-modal').style.display = 'none';
    document.getElementById('room-name-input').value = '';
    document.getElementById('room-description-input').value = '';
    document.getElementById('room-error').textContent = '';
}

async function createRoom() {
    const name = document.getElementById('room-name-input').value.trim();
    const description = document.getElementById('room-description-input').value.trim();
    const errorDiv = document.getElementById('room-error');
    
    if (!name) {
        errorDiv.textContent = 'Room name is required';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/rooms/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                name: name,
                description: description || null
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create room');
        }
        
        closeCreateRoomModal();
        await loadRooms();
        switchTab('rooms');
    } catch (error) {
        errorDiv.textContent = error.message;
    }
}

// Room Members Management
let allUsers = [];
let roomMembers = [];

// Room Info Modal
async function openRoomInfoModal() {
    if (!currentRoom) return;
    
    document.getElementById('room-info-modal').style.display = 'block';
    document.getElementById('room-info-title').textContent = currentRoom.name;
    document.getElementById('room-info-name').textContent = currentRoom.name;
    document.getElementById('room-info-description').textContent = currentRoom.description || 'No description';
    
    await loadRoomMembersForInfo();
}

function closeRoomInfoModal() {
    document.getElementById('room-info-modal').style.display = 'none';
}

async function loadRoomMembersForInfo() {
    if (!currentRoom) return;
    
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}/members`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load room members');
        
        const members = await response.json();
        const container = document.getElementById('room-members-list');
        const countEl = document.getElementById('room-info-member-count');
        
        if (countEl) countEl.textContent = members.length;
        
        if (!container) return;
        container.innerHTML = '';
        
        if (members.length === 0) {
            container.innerHTML = '<div class="no-conversations">No members</div>';
            return;
        }
        
        members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'conversation-item';
            
            const avatar = document.createElement('div');
            avatar.className = 'conversation-avatar';
            avatar.textContent = member.username.charAt(0).toUpperCase();
            
            const info = document.createElement('div');
            info.className = 'conversation-info';
            info.style.flex = '1';
            
            const name = document.createElement('div');
            name.className = 'conversation-name';
            name.textContent = member.username;
            if (member.user_id === currentRoom.creator_id) {
                name.textContent += ' (Admin)';
                name.style.color = '#25d366';
            }
            
            const email = document.createElement('div');
            email.className = 'conversation-last-message';
            email.textContent = member.email;
            
            info.appendChild(name);
            info.appendChild(email);
            
            memberDiv.appendChild(avatar);
            memberDiv.appendChild(info);
            
            // Show remove button if current user is creator and member is not creator
            if (currentRoom.creator_id === currentUser.id && member.user_id !== currentRoom.creator_id) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-member-btn';
                removeBtn.textContent = 'Remove';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Remove ${member.username} from the room?`)) {
                        removeMemberFromRoom(member.user_id);
                    }
                };
                memberDiv.appendChild(removeBtn);
            }
            
            container.appendChild(memberDiv);
        });
    } catch (error) {
        // Error loading room members
    }
}

async function removeMemberFromRoom(userId) {
    if (!currentRoom) return;
    
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to remove member');
        }
        
        // Reload members list
        await loadRoomMembersForInfo();
        // Reload rooms to update member count
        await loadRooms();
    } catch (error) {
        // Error removing member
        showToast('Failed to remove member. Please try again.', 'error');
    }
}

async function openAddMembersModal() {
    if (!currentRoom) return;
    
    // Check if user is the creator
    if (currentRoom.creator_id !== currentUser.id) {
        showToast('Only the room creator can add members.', 'warning');
        return;
    }
    
    document.getElementById('add-members-modal').style.display = 'block';
    await loadAllUsers();
    await loadRoomMembers();
}

function closeAddMembersModal() {
    document.getElementById('add-members-modal').style.display = 'none';
    document.getElementById('search-members-input').value = '';
    document.getElementById('add-members-error').textContent = '';
}

async function loadAllUsers() {
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/conversations/users/all`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        allUsers = await response.json();
        renderAllUsers();
    } catch (error) {
        // Error loading users
        document.getElementById('add-members-error').textContent = 'Failed to load users';
    }
}

async function loadRoomMembers() {
    if (!currentRoom) return;
    
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}/members`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load room members');
        
        roomMembers = await response.json();
        renderAllUsers(); // Re-render to update member status
    } catch (error) {
        // Error loading room members
    }
}

function renderAllUsers() {
    const container = document.getElementById('all-users-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (allUsers.length === 0) {
        container.innerHTML = '<div class="no-conversations">No users found</div>';
        return;
    }
    
    // Get member user IDs
    const memberIds = new Set(roomMembers.map(m => m.user_id));
    
    allUsers.forEach(user => {
        // Skip current user
        if (user.id === currentUser.id) return;
        
        const userDiv = document.createElement('div');
        userDiv.className = 'conversation-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'conversation-avatar';
        avatar.textContent = user.username.charAt(0).toUpperCase();
        
        const info = document.createElement('div');
        info.className = 'conversation-info';
        info.style.flex = '1';
        
        const name = document.createElement('div');
        name.className = 'conversation-name';
        name.textContent = user.username;
        
        const email = document.createElement('div');
        email.className = 'conversation-last-message';
        email.textContent = user.email;
        
        info.appendChild(name);
        info.appendChild(email);
        
        userDiv.appendChild(avatar);
        userDiv.appendChild(info);
        
        // Check if user is already a member
        if (memberIds.has(user.id)) {
            const status = document.createElement('div');
            status.className = 'member-status';
            status.textContent = '✓ Member';
            status.style.color = '#25d366';
            userDiv.appendChild(status);
        } else {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-member-btn';
            addBtn.textContent = '+ Add';
            addBtn.onclick = (e) => {
                e.stopPropagation();
                addMemberToRoom(user.id);
            };
            userDiv.appendChild(addBtn);
        }
        
        container.appendChild(userDiv);
    });
}

function filterMembers() {
    const query = document.getElementById('search-members-input').value.toLowerCase();
    const items = document.querySelectorAll('#all-users-list .conversation-item');
    
    items.forEach(item => {
        const name = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
        const email = item.querySelector('.conversation-last-message')?.textContent.toLowerCase() || '';
        if (name.includes(query) || email.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

async function addMemberToRoom(userId) {
    if (!currentRoom) return;
    
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to add member');
        }
        
        // Reload room members and users list
        await loadRoomMembers();
        document.getElementById('add-members-error').textContent = '';
        
        // Show success message
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            showToast(`${user.username} has been added to the room!`, 'success');
        }
    } catch (error) {
        // Error adding member
        document.getElementById('add-members-error').textContent = error.message;
    }
}

// Close room modal when clicking outside
window.onclick = function(event) {
    const roomModal = document.getElementById('create-room-modal');
    if (event.target === roomModal) {
        closeCreateRoomModal();
    }
    const userModal = document.getElementById('search-users-modal');
    if (event.target === userModal) {
        closeSearchUsersModal();
    }
    const addMembersModal = document.getElementById('add-members-modal');
    if (event.target === addMembersModal) {
        closeAddMembersModal();
    }
    const roomInfoModal = document.getElementById('room-info-modal');
    if (event.target === roomInfoModal) {
        closeRoomInfoModal();
    }
    const tutorialModal = document.getElementById('tutorial-modal');
    if (event.target === tutorialModal) {
        closeTutorial();
    }
}

// Message Actions: Edit, Delete, Reply
function replyToMessage(messageId) {
    const message = Array.from(document.querySelectorAll('[data-message-id]')).find(
        el => parseInt(el.getAttribute('data-message-id')) === messageId
    );
    if (!message) return;
    
    const content = message.querySelector('.message-content')?.textContent || '';
    const sender = message.querySelector('.message-sender-name')?.textContent || 
                   (message.classList.contains('sent') ? currentUser.username : currentConversation?.other_username);
    
    replyingToMessage = {
        id: messageId,
        content: content.substring(0, 50),
        sender: sender
    };
    
    // Show reply preview in input area
    showReplyPreview();
}

function showReplyPreview() {
    const inputContainer = document.querySelector('.message-input-container');
    if (!inputContainer) return;
    
    // Remove existing reply preview
    const existing = document.getElementById('reply-preview-bar');
    if (existing) existing.remove();
    
    if (replyingToMessage) {
        const preview = document.createElement('div');
        preview.id = 'reply-preview-bar';
        preview.className = 'reply-preview-bar';
        preview.innerHTML = `
            <div class="reply-preview-bar-content">
                <div class="reply-preview-bar-line"></div>
                <div class="reply-preview-bar-text">
                    <div class="reply-preview-bar-sender">${escapeHtml(replyingToMessage.sender)}</div>
                    <div class="reply-preview-bar-msg">${escapeHtml(replyingToMessage.content)}</div>
                </div>
            </div>
            <button class="reply-preview-bar-close" onclick="cancelReply()">×</button>
        `;
        inputContainer.insertBefore(preview, inputContainer.firstChild);
    }
}

function cancelReply() {
    replyingToMessage = null;
    const preview = document.getElementById('reply-preview-bar');
    if (preview) preview.remove();
}

async function editMessage(messageId) {
    const message = Array.from(document.querySelectorAll('[data-message-id]')).find(
        el => parseInt(el.getAttribute('data-message-id')) === messageId
    );
    if (!message) return;
    
    const contentEl = message.querySelector('.message-content');
    if (!contentEl) return;
    
    const currentContent = contentEl.textContent.replace(' (edited)', '').trim();
    const newContent = prompt('Edit message:', currentContent);
    
    if (newContent === null || newContent === currentContent) return;
    
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/conversations/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content: newContent })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to edit message' }));
            throw new Error(error.detail || 'Failed to edit message');
        }
        
        const updatedMessage = await response.json();
        
        // Update UI
        contentEl.textContent = newContent;
        if (!contentEl.querySelector('.edited-label')) {
            const editedLabel = document.createElement('span');
            editedLabel.textContent = ' (edited)';
            editedLabel.className = 'edited-label';
            editedLabel.style.fontSize = '11px';
            editedLabel.style.color = '#8696a0';
            editedLabel.style.fontStyle = 'italic';
            contentEl.appendChild(editedLabel);
        }
        
        // Update message in database
        message.setAttribute('data-message-id', updatedMessage.id);
        
    } catch (error) {
        // Error editing message
        showToast('Failed to edit message. Please try again.', 'error');
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
        const token = currentToken || localStorage.getItem('chat_token');
        const response = await fetch(`${API_BASE}/api/conversations/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to delete message' }));
            throw new Error(error.detail || 'Failed to delete message');
        }
        
        // Update UI
        const message = Array.from(document.querySelectorAll('[data-message-id]')).find(
            el => parseInt(el.getAttribute('data-message-id')) === messageId
        );
        if (message) {
            const contentEl = message.querySelector('.message-content');
            if (contentEl) {
                contentEl.textContent = 'This message was deleted';
                contentEl.style.fontStyle = 'italic';
                contentEl.style.color = '#8696a0';
            }
            // Remove action buttons
            const actions = message.querySelector('.message-actions');
            if (actions) actions.remove();
        }
        
    } catch (error) {
        // Error deleting message
        showToast('Failed to delete message. Please try again.', 'error');
    }
}

// Tutorial/Onboarding Functions
let currentTutorialStep = 1;
const totalTutorialSteps = 6;

function showTutorial() {
    const modal = document.getElementById('tutorial-modal');
    modal.style.display = 'flex';
    currentTutorialStep = 1;
    updateTutorialStep();
}

function closeTutorial() {
    const modal = document.getElementById('tutorial-modal');
    modal.style.display = 'none';
    // Mark tutorial as seen
    localStorage.setItem('has_seen_tutorial', 'true');
}

function nextTutorialStep() {
    if (currentTutorialStep < totalTutorialSteps) {
        currentTutorialStep++;
        updateTutorialStep();
    }
}

function previousTutorialStep() {
    if (currentTutorialStep > 1) {
        currentTutorialStep--;
        updateTutorialStep();
    }
}

function updateTutorialStep() {
    // Hide all steps
    for (let i = 1; i <= totalTutorialSteps; i++) {
        const step = document.getElementById(`tutorial-step-${i}`);
        if (step) {
            step.classList.remove('active');
        }
    }
    
    // Show current step
    const currentStep = document.getElementById(`tutorial-step-${currentTutorialStep}`);
    if (currentStep) {
        currentStep.classList.add('active');
    }
    
    // Update progress
    document.getElementById('tutorial-current-step').textContent = currentTutorialStep;
    document.getElementById('tutorial-total-steps').textContent = totalTutorialSteps;
    
    // Update buttons
    const prevBtn = document.getElementById('tutorial-prev-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    const skipBtn = document.getElementById('tutorial-skip-btn');
    
    if (currentTutorialStep === 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'inline-block';
        skipBtn.style.display = 'none';
    } else if (currentTutorialStep === totalTutorialSteps) {
        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'none';
        skipBtn.style.display = 'inline-block';
    } else {
        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'inline-block';
        skipBtn.style.display = 'none';
    }
}
