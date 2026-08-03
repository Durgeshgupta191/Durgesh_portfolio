(() => {
  const STORAGE_KEY = 'durgesh_portfolio_chat_session';
  const DEFAULT_API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3001' : '';

  class PortfolioChatbot {
    constructor() {
      this.messages = [];
      this.isOpen = false;
      this.isWaiting = false;
      this.container = null;
      this.windowEl = null;
      this.messagesEl = null;
      this.inputEl = null;
      this.sendButtonEl = null;
      this.suggestionsEl = null;
      this.typingMessageId = null;
      this.promptEl = null;
      this.promptTimer = null;
      this.promptLoop = null;
      this.apiBase = window.PORTFOLIO_CHATBOT_API_BASE || this.getDefaultApiBase();
    }

    getDefaultApiBase() {
      if (window.location.protocol === 'file:') {
        return 'http://localhost:3001';
      }

      if (window.location.port === '3001') {
        return '';
      }

      return 'http://localhost:3001';
    }

    init() {
      if (window.__portfolioChatbotInitialized) return;
      window.__portfolioChatbotInitialized = true;

      window.addEventListener('load', () => {
        this.buildUI();
        this.bindEvents();
        this.loadSession();
        this.renderMessages();
        this.startPromptLoop();
      });
    }

    buildUI() {
      const shell = document.createElement('div');
      shell.className = 'chatbot-shell';
      shell.innerHTML = `
        <button class="chatbot-toggle" type="button" aria-label="Open Durgesh AI assistant">
          <i class="fas fa-robot"></i>
        </button>
        <div class="chatbot-prompt is-hidden" aria-live="polite">Wanna help?</div>
        <div class="chatbot-window" role="dialog" aria-label="Durgesh AI assistant">
          <div class="chatbot-header">
            <div class="chatbot-brand">
              <div class="chatbot-avatar">
                <i class="fas fa-robot"></i>
              </div>
              <div class="chatbot-title-group">
                <h3>Durgesh AI</h3>
                <p>Personal Portfolio Assistant</p>
              </div>
            </div>
            <div class="chatbot-status">
              <span class="chatbot-status-dot"></span>
              <span>Online</span>
            </div>
            <button class="chatbot-close" type="button" aria-label="Close assistant">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="chatbot-body">
            <div class="chatbot-messages"></div>
            <div class="chatbot-suggestions"></div>
            <div class="chatbot-input-row">
              <input type="text" placeholder="Ask about my projects, skills, resume..." aria-label="Chat message input" />
              <button type="button" aria-label="Send message">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(shell);
      this.container = shell;
      this.windowEl = shell.querySelector('.chatbot-window');
      this.messagesEl = shell.querySelector('.chatbot-messages');
      this.suggestionsEl = shell.querySelector('.chatbot-suggestions');
      this.inputEl = shell.querySelector('.chatbot-input-row input');
      this.sendButtonEl = shell.querySelector('.chatbot-input-row button');
      this.toggleButtonEl = shell.querySelector('.chatbot-toggle');
      this.closeButtonEl = shell.querySelector('.chatbot-close');
      this.promptEl = shell.querySelector('.chatbot-prompt');
    }

    bindEvents() {
      this.toggleButtonEl.addEventListener('click', () => this.toggle());
      this.closeButtonEl.addEventListener('click', () => this.close());
      this.sendButtonEl.addEventListener('click', () => this.handleSend());
      this.promptEl.addEventListener('click', () => {
        this.showPrompt(false);
        this.open();
        this.inputEl.focus();
      });

      this.inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          this.handleSend();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          this.open();
          this.inputEl.focus();
        }

        if (event.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });

      this.suggestionsEl.addEventListener('click', (event) => {
        const button = event.target.closest('.chatbot-chip');
        if (button) {
          this.handleSend(button.dataset.message);
        }
      });
    }

    startPromptLoop() {
      this.stopPromptLoop();
      this.promptLoop = window.setInterval(() => {
        if (!this.isOpen && !this.isWaiting) {
          this.showPrompt(true);
        }
      }, 10000);
    }

    stopPromptLoop() {
      if (this.promptLoop) {
        clearInterval(this.promptLoop);
        this.promptLoop = null;
      }
      if (this.promptTimer) {
        clearTimeout(this.promptTimer);
        this.promptTimer = null;
      }
    }

    showPrompt(visible) {
      if (!this.promptEl) return;
      if (visible) {
        this.promptEl.classList.add('is-visible');
        this.promptEl.classList.remove('is-hidden');
        if (this.promptTimer) clearTimeout(this.promptTimer);
        this.promptTimer = window.setTimeout(() => this.showPrompt(false), 2800);
      } else {
        this.promptEl.classList.remove('is-visible');
        this.promptEl.classList.add('is-hidden');
      }
    }

    loadSession() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
          this.messages = [];
          return;
        }

        const parsed = JSON.parse(raw);
        this.messages = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.warn('Unable to restore chatbot session', error);
        this.messages = [];
      }
    }

    persistSession() {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      this.isOpen = true;
      this.windowEl.classList.add('is-open');
      this.showPrompt(false);
      this.inputEl.focus();
      if (!this.messages.length) {
        this.showWelcomeMessage();
      }
    }

    close() {
      this.isOpen = false;
      this.windowEl.classList.remove('is-open');
    }

    showWelcomeMessage() {
      const welcomeText = [
        'Hi 👋',
        '',
        "I'm Durgesh AI.",
        '',
        'You can ask me anything about:',
        '• My Projects',
        '• My Skills',
        '• Experience',
        '• Resume',
        '• Certifications',
        '• Education',
        '• Achievements',
        '• Contact Information',
        '',
        'How can I help you today?'
      ].join('\n');

      this.messages = [];
      this.addMessage('assistant', welcomeText, { isWelcome: true });
      this.renderMessages();
      this.persistSession();
    }

    renderSuggestions() {
      this.suggestionsEl.innerHTML = '';
      const suggestions = [
        'Contact Details',
        'Experience',
        'Achievements'
      ];

      suggestions.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chatbot-chip';
        button.dataset.message = item;
        button.textContent = item;
        this.suggestionsEl.appendChild(button);
      });
    }

    renderMessages() {
      this.messagesEl.innerHTML = '';
      if (!this.messages.length) {
        this.messagesEl.innerHTML = '<div class="chatbot-empty-state">Start a conversation with Durgesh AI.</div>';
        this.renderSuggestions();
        return;
      }

      this.messages.forEach((message) => {
        const wrapper = document.createElement('div');
        wrapper.className = `chatbot-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}`;
        const bubble = document.createElement('div');
        bubble.className = 'chatbot-bubble';
        bubble.innerHTML = `<div>${this.renderMarkdown(message.content)}</div><span class="chatbot-time">${message.timestamp || ''}</span>`;
        wrapper.appendChild(bubble);
        this.messagesEl.appendChild(wrapper);
      });

      this.renderSuggestions();
      requestAnimationFrame(() => this.scrollToBottom());
    }

    renderMarkdown(text) {
      const escaped = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      let html = escaped
        .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

      const lines = html.split(/\n/);
      const rendered = [];
      let inList = false;

      lines.forEach((line) => {
        if (/^[-*]\s+/.test(line)) {
          if (!inList) {
            rendered.push('<ul>');
            inList = true;
          }
          rendered.push(`<li>${line.replace(/^[-*]\s+/, '')}</li>`);
          return;
        }

        if (inList) {
          rendered.push('</ul>');
          inList = false;
        }

        rendered.push(line ? `<p>${line}</p>` : '<br>');
      });

      if (inList) {
        rendered.push('</ul>');
      }

      return rendered.join('');
    }

    scrollToBottom() {
      if (this.messagesEl) {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      }
    }

    async handleSend(messageText = null) {
      const text = (messageText || this.inputEl.value).trim();
      if (!text || this.isWaiting) return;

      if (!this.isOpen) {
        this.open();
      }

      this.addMessage('user', text);
      this.inputEl.value = '';
      this.renderMessages();
      this.showTypingIndicator();
      this.setLoading(true);

      try {
        const history = this.messages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .slice(-10)
          .map((message) => ({ role: message.role, content: message.content }));

        const response = await fetch(`${this.apiBase}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history })
        });

        if (!response.ok) {
          throw new Error('server_error');
        }

        const data = await response.json();
        this.replaceTypingIndicator(data.reply || 'Something went wrong. Please try again.');
      } catch (error) {
        const isOffline = error?.name === 'TypeError' || error?.message === 'Failed to fetch';
        const message = isOffline || error?.message === 'server_error'
          ? 'Unable to connect to AI assistant.'
          : 'Something went wrong. Please try again.';
        this.replaceTypingIndicator(message);
      } finally {
        this.setLoading(false);
        this.persistSession();
      }
    }

    addMessage(role, content, options = {}) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.messages.push({ role, content, timestamp, ...options });
      this.persistSession();
    }

    showTypingIndicator() {
      const wrapper = document.createElement('div');
      wrapper.className = 'chatbot-message is-assistant';
      wrapper.innerHTML = `
        <div class="chatbot-bubble">
          <div class="chatbot-typing" aria-live="polite">
            <span></span><span></span><span></span>
            <span style="margin-left:0.35rem;">Durgesh AI is typing...</span>
          </div>
        </div>
      `;
      this.messagesEl.appendChild(wrapper);
      this.typingMessageId = this.messages.length;
      requestAnimationFrame(() => this.scrollToBottom());
    }

    replaceTypingIndicator(content) {
      const typingNode = this.messagesEl.querySelector('.chatbot-typing')?.closest('.chatbot-message');
      if (typingNode) {
        typingNode.remove();
      }

      this.addMessage('assistant', content);
      this.renderMessages();
      this.typingMessageId = null;
    }

    setLoading(isPending) {
      this.isWaiting = isPending;
      this.inputEl.disabled = isPending;
      this.sendButtonEl.disabled = isPending;
      this.inputEl.placeholder = isPending ? 'Waiting for answer...' : 'Ask about my projects, skills, resume...';
    }
  }

  window.PortfolioChatbot = PortfolioChatbot;
  window.addEventListener('DOMContentLoaded', () => {
    const chatbot = new PortfolioChatbot();
    chatbot.init();
  });
})();
