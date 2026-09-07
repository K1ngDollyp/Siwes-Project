import React, { useState, useRef } from 'react';
import { Send, Reply, X, AtSign } from 'lucide-react';

export default function MessageInput({
  onSendMessage,
  onTyping,
  disabled,
  replyingTo,
  onCancelReply,
  members = [],
  currentUserId
}) {
  const [content, setContent] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const lastTypingTimeRef = useRef(0);
  const inputRef = useRef(null);

  const filteredMembers = (members || []).filter((m) =>
    m.user_id !== currentUserId &&
    mentionQuery !== null &&
    m.username.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleSelectMention = (username) => {
    if (!inputRef.current) return;
    const cursorPos = inputRef.current.selectionStart || content.length;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    const newTextBefore = textBeforeCursor.replace(/(?:^|\s)@([a-zA-Z0-9_]*)$/, (match) => {
      const isLeadingSpace = match.startsWith(' ');
      return (isLeadingSpace ? ' ' : '') + `@${username} `;
    });

    const updatedContent = newTextBefore + textAfterCursor;
    setContent(updatedContent);
    setMentionQuery(null);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = newTextBefore.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    
    const now = Date.now();
    if (now - lastTypingTimeRef.current > 1500) {
      lastTypingTimeRef.current = now;
      if (onTyping) onTyping();
    }

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setSelectedIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;

    onSendMessage(content.trim(), replyingTo?.id || null);
    setContent('');
    setMentionQuery(null);
    if (onCancelReply) onCancelReply();
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredMembers[selectedIndex];
        if (selected) {
          handleSelectMention(selected.username);
        }
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-4 bg-slate-900/90 border-t border-slate-800/80 relative">
      {/* Mention Autocomplete Dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full mb-2 left-4 right-4 max-h-48 overflow-y-auto bg-slate-900/95 border border-indigo-500/30 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md z-30 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center gap-1">
            <AtSign className="w-3 h-3 text-indigo-400" />
            <span>Tag Room Member</span>
          </div>
          {filteredMembers.map((member, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={member.id || member.user_id}
                type="button"
                onClick={() => handleSelectMention(member.username)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/30 text-white border border-indigo-500/40 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-200 uppercase">
                    {member.username?.[0] || 'U'}
                  </div>
                  <span className="font-semibold text-sm truncate">@{member.username}</span>
                </div>

                <div className="flex items-center gap-1 ml-2">
                  {member.role === 'owner' && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Owner
                    </span>
                  )}
                  {member.role === 'admin' && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Admin
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2.5 p-2.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Reply className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-slate-400">Replying to </span>
              <span className="font-semibold text-indigo-300">
                {replyingTo.user_id === currentUserId ? 'You' : `@${replyingTo.username}`}
              </span>
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
            ref={inputRef}
            type="text"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'Join room to send messages...' : 'Type a message... Type @ to tag a member'}
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
