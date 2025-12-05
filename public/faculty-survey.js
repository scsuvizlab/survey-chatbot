// Faculty AI Adoption Survey - Frontend Logic
const API_BASE = '/api/faculty';

let sessionId = null;
let conversationEnded = false;
let timerInterval = null;
let startTime = null;
let twelveMinuteWarningShown = false;

// Section tracking (6 sections for faculty survey)
const sections = [
    { 
        id: "ai_awareness",
        label: "AI Awareness & Usage", 
        completed: false
    },
    { 
        id: "teaching_interest",
        label: "Interest in AI for Teaching", 
        completed: false
    },
    { 
        id: "concerns",
        label: "Concerns & Barriers", 
        completed: false
    },
    { 
        id: "support_needs",
        label: "Support Needs", 
        completed: false
    },
    { 
        id: "nexted_interest",
        label: "NextEd Services", 
        completed: false
    },
    { 
        id: "demographics",
        label: "Background Info", 
        completed: false
    }
];

let currentSectionIndex = 0;

// DOM Elements
const initialForm = document.getElementById('initial-form');
const userInfoForm = document.getElementById('user-info-form');
const chatInterface = document.getElementById('chat-interface');
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const summaryModal = document.getElementById('summary-modal');
const summaryText = document.getElementById('summary-text');
const modifyBtn = document.getElementById('modify-btn');
const approveBtn = document.getElementById('approve-btn');
const helpBtn = document.getElementById('help-btn');
const endConversationBtn = document.getElementById('end-conversation-btn');
const timerDisplay = document.getElementById('timer');
const helpModal = document.getElementById('help-modal');
const progressBtn = document.getElementById('progress-btn');
const progressText = document.getElementById('progress-text');
const sectionDropdown = document.getElementById('section-dropdown');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    userInfoForm.addEventListener('submit', handleInitialSubmit);
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', handleKeyPress);
    modifyBtn.addEventListener('click', handleModify);
    approveBtn.addEventListener('click', handleApprove);
    helpBtn.addEventListener('click', showHelp);
    endConversationBtn.addEventListener('click', handleEndConversation);
    progressBtn.addEventListener('click', toggleSectionDropdown);
    
    // Initialize section dropdown
    renderSections();
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!progressBtn.contains(e.target) && !sectionDropdown.contains(e.target)) {
            closeSectionDropdown();
        }
    });
});

// Section Functions
function renderSections() {
    const sectionList = document.querySelector('.topic-list');
    sectionList.innerHTML = '';
    
    sections.forEach((section, index) => {
        const item = document.createElement('div');
        item.className = `topic-item ${section.completed ? 'covered' : ''}`;
        item.innerHTML = `
            <div class="topic-checkbox ${section.completed ? 'covered' : ''}"></div>
            <span class="topic-text">${section.label}</span>
        `;
        sectionList.appendChild(item);
    });
}

function updateSectionProgress() {
    // Update current section as completed
    if (currentSectionIndex < sections.length) {
        sections[currentSectionIndex].completed = true;
    }
    
    // Move to next section
    currentSectionIndex++;
    
    // Update progress text
    if (currentSectionIndex < sections.length) {
        progressText.textContent = `Section ${currentSectionIndex + 1} of 6`;
    } else {
        progressText.textContent = `Section 6 of 6 (Final)`;
    }
    
    renderSections();
}

// Detect section completion and transitions from bot messages
function detectSectionChange(botMessage) {
    const lowerMessage = botMessage.toLowerCase();
    
    // Section 1: AI Awareness & Usage
    if (currentSectionIndex === 0) {
        if (lowerMessage.includes('interest in using ai') || 
            lowerMessage.includes('rate your interest') ||
            lowerMessage.includes('personalized learning') ||
            (lowerMessage.includes('next') && (lowerMessage.includes('section') || lowerMessage.includes('question')))) {
            console.log('Section transition detected: 0 → 1');
            updateSectionProgress();
            return;
        }
    }
    
    // Section 2: Interest in AI for Teaching
    if (currentSectionIndex === 1) {
        if (lowerMessage.includes('concerns') || 
            lowerMessage.includes('worried about') ||
            lowerMessage.includes('true or false') ||
            lowerMessage.includes('barriers')) {
            console.log('Section transition detected: 1 → 2');
            updateSectionProgress();
            return;
        }
    }
    
    // Section 3: Concerns & Barriers
    if (currentSectionIndex === 2) {
        if (lowerMessage.includes('support') || 
            lowerMessage.includes('what would help') ||
            lowerMessage.includes('priorities') ||
            lowerMessage.includes('rank')) {
            console.log('Section transition detected: 2 → 3');
            updateSectionProgress();
            return;
        }
    }
    
    // Section 4: Support Needs
    if (currentSectionIndex === 3) {
        if (lowerMessage.includes('nexted') || 
            lowerMessage.includes('dgx') ||
            lowerMessage.includes('workstation') ||
            lowerMessage.includes('policy board')) {
            console.log('Section transition detected: 3 → 4');
            updateSectionProgress();
            return;
        }
    }
    
    // Section 5: NextEd Services
    if (currentSectionIndex === 4) {
        if (lowerMessage.includes('background') || 
            lowerMessage.includes('department') ||
            lowerMessage.includes('how many years') ||
            lowerMessage.includes('comfort') ||
            lowerMessage.includes('final section')) {
            console.log('Section transition detected: 4 → 5');
            updateSectionProgress();
            return;
        }
    }
    
    // Section 6: Background - detect summary generation
    if (currentSectionIndex === 5) {
        if (lowerMessage.includes('summary') || 
            lowerMessage.includes('let me generate')) {
            console.log('Section transition detected: 5 → complete');
            updateSectionProgress();
            return;
        }
    }
    
    // Generic transition detection as fallback
    const transitionPhrases = [
        "let's look at",
        "now let's",
        "moving on to",
        "next section",
        "let me ask about",
        "final section",
        "lastly"
    ];
    
    const hasTransition = transitionPhrases.some(phrase => lowerMessage.includes(phrase));
    
    if (hasTransition && currentSectionIndex < sections.length - 1) {
        console.log('Generic section transition detected');
        updateSectionProgress();
    }
}

function toggleSectionDropdown() {
    const isHidden = sectionDropdown.classList.contains('hidden');
    
    if (isHidden) {
        sectionDropdown.classList.remove('hidden');
        progressBtn.classList.add('active');
    } else {
        closeSectionDropdown();
    }
}

function closeSectionDropdown() {
    sectionDropdown.classList.add('hidden');
    progressBtn.classList.remove('active');
}

// Timer Functions
function startTimer() {
    startTime = Date.now();
    twelveMinuteWarningShown = false;
    let lastWarningMinute = 0;
    
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Check for 10-minute intervals (10, 20, 30)
        if (minutes > 0 && minutes % 10 === 0 && minutes !== lastWarningMinute) {
            lastWarningMinute = minutes;
            addMessage('bot', `⏰ We've been going for ${minutes} minutes. Feel free to continue or click "I'm Done" whenever you're ready to wrap up.`);
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Help Modal Functions
function showHelp() {
    helpModal.classList.remove('hidden');
}

function hideHelp() {
    helpModal.classList.add('hidden');
}

// Make these globally accessible
window.showHelp = showHelp;
window.hideHelp = hideHelp;

// Handle initial form submission
async function handleInitialSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    
    if (!name || !email) return;
    
    try {
        const response = await fetch(`${API_BASE}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionId = data.session_id;
            
            // Hide form, show chat
            initialForm.classList.add('hidden');
            chatInterface.classList.remove('hidden');
            
            // Display bot's greeting
            addMessage('bot', data.message);
            
            // Start timer
            startTimer();
            
            // Focus on input
            userInput.focus();
        } else {
            alert('Error starting survey: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to connect to server. Please try again.');
    }
}

// Handle "I'm Done" button
async function handleEndConversation() {
    if (conversationEnded) return;
    
    // Stop timer
    stopTimer();
    
    // Disable controls
    setInputEnabled(false);
    endConversationBtn.disabled = true;
    closeSectionDropdown();
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_BASE}/summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        
        const data = await response.json();
        
        hideTypingIndicator();
        
        if (response.ok) {
            // Show summary modal
            showSummaryModal(data.summary);
        } else {
            alert('Error generating summary: ' + data.error);
            setInputEnabled(true);
            endConversationBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        alert('Failed to end survey. Please try again.');
        setInputEnabled(true);
        endConversationBtn.disabled = false;
    }
}

// Handle sending messages
async function handleSendMessage() {
    if (conversationEnded) return;
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Display user message
    addMessage('user', message);
    
    // Clear input
    userInput.value = '';
    
    // Disable input while processing
    setInputEnabled(false);
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_BASE}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, message })
        });
        
        const data = await response.json();
        
        hideTypingIndicator();
        
        if (response.ok) {
            // Display bot response
            addMessage('bot', data.message);
            
            // Detect section changes
            detectSectionChange(data.message);
            
            // Check if this is a summary
            if (isSummaryMessage(data.message)) {
                // Bot initiated summary - stop timer and show modal
                stopTimer();
                closeSectionDropdown();
                setTimeout(() => showSummaryModal(data.message), 1000);
            } else {
                setInputEnabled(true);
            }
        } else {
            alert('Error: ' + data.error);
            setInputEnabled(true);
        }
    } catch (error) {
        console.error('Error:', error);
        hideTypingIndicator();
        alert('Failed to send message. Please try again.');
        setInputEnabled(true);
    }
}

// Handle Enter key (newline only, no send)
function handleKeyPress(e) {
    // Allow normal enter for newlines
    // Users must click Send button
}

// Add message to chat
function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = content;
    
    messageDiv.appendChild(bubbleDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Check if message is a summary (more flexible detection)
function isSummaryMessage(message) {
    // Look for key structural indicators of a complete summary
    const hasMultipleSections = (message.match(/\*\*[A-Z][^*]+:\*\*/g) || []).length >= 3;
    const hasConfirmation = message.toLowerCase().includes('does this') && 
                           (message.toLowerCase().includes('capture') || message.toLowerCase().includes('accurate'));
    const looksLikeSummary = message.includes('Usage') && 
                            message.includes('Interest') && 
                            message.includes('Concerns');
    
    console.log('Summary detection:', { hasMultipleSections, hasConfirmation, looksLikeSummary });
    
    // Only trigger if it has the structure of a complete summary
    return hasMultipleSections && hasConfirmation && looksLikeSummary;
}

// Show/hide typing indicator
function showTypingIndicator() {
    typingIndicator.classList.remove('hidden');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.classList.add('hidden');
}

// Enable/disable input
function setInputEnabled(enabled) {
    userInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    endConversationBtn.disabled = !enabled;
}

// Show summary modal
function showSummaryModal(summaryContent) {
    summaryText.textContent = summaryContent;
    summaryModal.classList.remove('hidden');
}

// Hide summary modal
function hideSummaryModal() {
    summaryModal.classList.add('hidden');
}

// Handle modify button
function handleModify() {
    hideSummaryModal();
    setInputEnabled(true);
    startTimer(); // Restart timer if they want to continue
    userInput.focus();
    addMessage('bot', 'Please share any clarifications or additions you\'d like to make.');
}

// Handle approve button
async function handleApprove() {
    try {
        const summary = summaryText.textContent;
        
        const response = await fetch(`${API_BASE}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                session_id: sessionId, 
                summary: summary,
                user_edits: null 
            })
        });
        
        if (response.ok) {
            hideSummaryModal();
            addMessage('bot', 'Thank you for completing the survey! Your responses have been saved. You may now close this window.');
            conversationEnded = true;
            setInputEnabled(false);
            stopTimer();
        } else {
            alert('Error completing survey. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to complete survey. Please try again.');
    }
}
