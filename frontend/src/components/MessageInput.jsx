import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';

export default function MessageInput({ onSendMessage, onTyping, disabled }) {
  const [content, setContent] = useState('');
  const lastTypingTimeRef = useRef(0);

  const handleChange = (e) => {
    setContent(e.target.value);
    
    // Throttle typing notification (send once every 1.5s while typing)
    const now = Date.now();
    if (now - lastTypingTimeRef.current > 1500) {
      lastTypingTimeRef.current = now;
      if (onTyping) onTyping();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;

    onSendMessage(content.trim());
    setContent('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-900/80 border-t border-slate-800/80">
      <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all shadow-inner">
        <input
          type="text"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'Join room to send messages...' : 'Type a message... (Press Enter to send)'}
          className="flex-1 px-4 py-2 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
