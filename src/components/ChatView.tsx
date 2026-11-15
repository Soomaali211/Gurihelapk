import React, { useState } from 'react';
import { ArrowLeft, Send, MapPin, Calendar, ShieldAlert } from 'lucide-react';
import { ChatThread } from '../types';

interface ChatViewProps {
  threads: ChatThread[];
  activeThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onSendMessage: (threadId: string, text: string) => void;
  onBack?: () => void;
  onOpenListingDetail?: (listingId: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onSendMessage,
  onBack,
  onOpenListingDetail,
}) => {
  const [inputText, setInputText] = useState('');
  const currentThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  // Specific conversation dialogue from Wireframe 7.6:
  // User: "Salaan, guriga weli waa banaan yahay?"
  // Broker: "Haa, waa banaan yahay. Ma rabtaa inaad timaaddo?"
  // User: "Haa, berri 4PM."
  // Broker: "Waa hagaag. Waan ku sugayaa."

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentThread) return;
    onSendMessage(currentThread.id, inputText.trim());
    setInputText('');
  };

  const handleQuickAction = (actionText: string) => {
    if (!currentThread) return;
    onSendMessage(currentThread.id, actionText);
  };

  return (
    <div className="flex flex-col bg-[#F8FAFC] flex-1 min-h-0 h-full w-full max-w-full font-sans select-none relative overflow-hidden">
      {/* Item 1: Header: [ ← ] Broker avatar + Broker name + "online" */}
      <div className="bg-white px-3.5 py-2.5 border-b border-[#C9D2CD] flex items-center justify-between shadow-2xs shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-700 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <img
              src={currentThread?.broker.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80'}
              alt={currentThread?.broker.name || 'District Broker'}
              className="w-9 h-9 rounded-full object-cover border border-[#0B7A3E]"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
              {currentThread?.broker.name || 'District Broker'}
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold">online</span>
          </div>
        </div>
      </div>

      {/* Item 2: Pinned Listing Card */}
      {/* "Villa · 250,000 USD Listing #A1042" */}
      <div
        onClick={() => {
          if (onOpenListingDetail) onOpenListingDetail('A1042');
        }}
        className="mx-3 mt-2.5 p-2.5 bg-white rounded-2xl border border-[#C9D2CD] hover:border-[#0B7A3E] shadow-2xs flex items-center justify-between gap-2 cursor-pointer transition-all shrink-0"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=200&q=80"
            alt="Villa #A1042"
            className="w-11 h-11 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-black text-[#0F3D2A] truncate">
              Villa · 250,000 USD
            </div>
            <div className="text-[10px] text-slate-500 font-medium truncate">
              Listing #A1042
            </div>
          </div>
        </div>

        <span className="text-[10px] font-bold text-[#0B7A3E] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 whitespace-nowrap">
          Eeg Faahfaahin
        </span>
      </div>

      {/* Safety Notice Warning Banner (as specified in Wireframe 7.6) */}
      {/* "Safety: Chat-ku wuxuu muujiyaa digniin joogto ah: 'Ha bixin lacag kahor intaadan guriga arag'" */}
      <div className="mx-3 mt-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center gap-2 text-[10px] text-amber-900">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="leading-tight font-medium">
          <strong>Digniin:</strong> Ha bixin lacag kahor intaadan guriga arag oo aadan xaqiijin sharciga.
        </span>
      </div>

      {/* Item 3: Messages Dialogue Bubbles */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {currentThread?.messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-2xs ${
                  isUser
                    ? 'bg-[#0B7A3E] text-white rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-[#C9D2CD] rounded-tl-xs'
                }`}
              >
                <p>{msg.body}</p>
                <div
                  className={`text-[9px] mt-0.5 text-right ${
                    isUser ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {msg.time}
                </div>
              </div>
            </div>
          );
        })}

        {/* Quick Action Chip: [ 📍 Location pin · 📅 Dhig ballan ] */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => handleQuickAction('Asc, waxaan codsanayaa inaan goobta ku kulanno 4:00 PM')}
            className="px-3.5 py-1.5 bg-[#EEF2F0] hover:bg-emerald-100 text-[#0B7A3E] text-[11px] font-bold rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1.5 transition-all active:scale-95"
          >
            <MapPin className="w-3 h-3 text-[#0B7A3E]" />
            <span>Location pin · Dhig ballan</span>
            <Calendar className="w-3 h-3 text-[#0B7A3E]" />
          </button>
        </div>
      </div>

      {/* Item 4: Composer: "Qor fariin..." and Send button */}
      <form
        onSubmit={handleSend}
        className="p-2.5 bg-white border-t border-[#C9D2CD] flex items-center gap-2 shrink-0 z-20"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Qor fariin..."
          className="flex-1 min-w-0 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0B7A3E] outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="h-9 px-3.5 sm:px-4 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors disabled:opacity-40 shrink-0"
        >
          <Send className="w-3 h-3" />
          <span>Dir</span>
        </button>
      </form>
    </div>
  );
};
