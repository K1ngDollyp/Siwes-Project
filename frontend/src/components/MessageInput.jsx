import React, { useState, useRef } from 'react';
import { Send, Reply, X } from 'lucide-react';

export default function MessageInput({
  onSendMessage,
  onTyping,
  disabled,
  replyingTo,
  onCancelReply
}) {
  const [content, setContent] = useState('');
  const lastTypingTimeRef = useRef(0);

  const handleChange = (e) => {
    setContent(e.target.value);
    
    const now = Date.now();
    if (now - lastTypingTimeRef.current > 1500) {
      lastTypingTimeRef.current = now;
      if (onTyping) onTyping();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;

    onSendMessage(content.trim(), replyingTo?.id || null);
    setContent('');
    if (onCancelReply) onCancelReply();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-4 bg-slate-900/90 border-t border-slate-800/80">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2.5 p-2.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Reply className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-slate-400">Replying to </span>
              <span className="font-semibold text-indigo-300">@{replyingTo.username}</span>
              <span className="text-slate-400 mx-1.5">:</span>
              <span className="text-slate-300 italic truncate">"{replyingTo.content}"</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            title="Cancel Reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
    </div>
  );
}
