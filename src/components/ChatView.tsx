import React, { useState } from 'react';
import { ArrowLeft, Send, MessageSquarePlus, ShieldAlert } from 'lucide-react';
import { ChatThread } from '../types';
import { resolveApiUrl } from '../lib/apiClient';

interface ChatViewProps {
  threads: ChatThread[];
  activeThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onSendMessage: (threadId: string, text: string) => void;
  onStartSupportThread?: () => void;
  onBack?: () => void;
  onOpenListingDetail?: (listingId: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  threads,
  activeThreadId,
  onSendMessage,
  onStartSupportThread,
  onBack,
  onOpenListingDetail,
}) => {
  const [inputText, setInputText] = useState('');
  const currentThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentThread) return;
    onSendMessage(currentThread.id, inputText.trim());
    setInputText('');
  };

  if (!currentThread) {
    return (
      <div className="flex flex-col bg-[#F8FAFC] flex-1 min-h-0 h-full w-full font-sans select-none">
        <div className="bg-white px-3.5 py-3 border-b border-[#C9D2CD] flex items-center gap-2.5 shrink-0">
          {onBack && (
            <button type="button" onClick={onBack} className="p-1 hover:bg-slate-100 rounded-full text-[#0B7A3E]">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h3 className="text-sm font-extrabold text-slate-900">Messages</h3>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <img
            src="/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png"
            alt="GuriHel"
            className="w-12 h-12 rounded-2xl shadow-xs"
          />
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-slate-900">No Conversations Yet</h4>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Start an inquiry on any property listing or open a direct support conversation with GuriHel.
            </p>
          </div>
          {onStartSupportThread && (
            <button
              type="button"
              onClick={onStartSupportThread}
              className="px-4 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Message GuriHel Support</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#F8FAFC] flex-1 min-h-0 h-full w-full font-sans select-none relative overflow-hidden">
      {/* Header */}
      <div className="bg-white px-3.5 py-2.5 border-b border-[#C9D2CD] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-700"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <img
            src={
              currentThread.broker.avatar
                ? resolveApiUrl(currentThread.broker.avatar)
                : '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png'
            }
            alt={currentThread.broker.name}
            className="w-9 h-9 rounded-full object-cover border border-[#0B7A3E]"
          />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
              {currentThread.broker.name}
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {currentThread.broker.phone}
            </span>
          </div>
        </div>
      </div>

      {/* Pinned Listing Card */}
      {currentThread.listingId && (
        <div
          onClick={() => onOpenListingDetail?.(currentThread.listingId!)}
          className="mx-3 mt-2.5 p-2.5 bg-white rounded-2xl border border-[#C9D2CD] hover:border-[#0B7A3E] flex items-center justify-between gap-2 cursor-pointer shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={
                currentThread.listingImage
                  ? resolveApiUrl(currentThread.listingImage)
                  : '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png'
              }
              alt={currentThread.listingTitle || 'Property'}
              className="w-11 h-11 rounded-xl object-cover shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-black text-[#0F3D2A] truncate">
                {currentThread.listingTitle}
                {currentThread.listingPrice ? ` · $${currentThread.listingPrice.toLocaleString()}` : ''}
              </div>
              <div className="text-[10px] text-slate-500 font-medium truncate">
                Listing #{currentThread.listingId}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#0B7A3E] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
            View
          </span>
        </div>
      )}

      {/* Safety Notice */}
      <div className="mx-3 mt-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center gap-2 text-[10px] text-amber-900">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="leading-tight font-medium">
          <strong>Safety:</strong> Never transfer funds before inspecting the property and verifying ownership.
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {currentThread.messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-2xs ${
                  isUser
                    ? 'bg-[#0B7A3E] text-white rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-[#C9D2CD] rounded-tl-xs'
                }`}
              >
                <p>{msg.body}</p>
                <div className={`text-[9px] mt-0.5 text-right ${isUser ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {msg.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="p-2.5 bg-white border-t border-[#C9D2CD] flex items-center gap-2 shrink-0 z-20"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Write a message..."
          className="flex-1 min-w-0 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0B7A3E] outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="h-9 px-3.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-40 shrink-0"
        >
          <Send className="w-3 h-3" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
