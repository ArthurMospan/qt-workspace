'use client';
// src/app/workspace/chat/page.js
import React, { useState, useRef, useEffect } from 'react';
import { Hash, MessageSquare, Search, Phone, Video, Info, MoreVertical, Send, Smile, Paperclip, ChevronDown, Plus } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useWorkspaceChat } from '@/lib/hooks/useWorkspaceChat';

export default function ChatPage() {
  const { currentUser } = useAppContext();
  const [activeChannel, setActiveChannel] = useState('general');
  const [messageText, setMessageText] = useState('');
  
  const { channels, messages, loading, sendMessage } = useWorkspaceChat(activeChannel);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!messageText.trim()) return;
    const text = messageText;
    setMessageText('');
    await sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const dms = [
    { id: 'user1', name: 'Олександр М.', online: true, unread: 2 },
    { id: 'user2', name: 'Марія К.', online: false, unread: 0 },
    { id: 'user3', name: 'Іван Д.', online: true, unread: 0 },
  ];

  return (
    <div className="flex h-full bg-white overflow-hidden">
      
      {/* Sidebar (Channels & DMs) */}
      <div className="w-[260px] bg-[#f9f9f9] border-r border-[#f0f0f0] flex flex-col h-full shrink-0">
        
        {/* Workspace Header */}
        <div className="h-[60px] flex items-center justify-between px-[16px] border-b border-[#f0f0f0] hover:bg-[#f0f0f0] cursor-pointer transition-colors">
          <h2 className="font-bold text-[#1f1f1f] text-[15px] tracking-tight">QuickTeam HQ</h2>
          <ChevronDown size={16} className="text-[#9a9a9a]" />
        </div>

        <div className="flex-1 overflow-y-auto py-[16px] px-[8px] custom-scrollbar">
          
          {/* Channels Section */}
          <div className="mb-[24px]">
            <div className="flex items-center justify-between px-[8px] mb-[8px] group">
              <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Канали</span>
              <button className="text-[#9a9a9a] hover:text-[#1f1f1f] opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-[2px]">
              {channels.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveChannel(c.id)}
                  className={`flex items-center justify-between w-full px-[8px] py-[6px] rounded-[6px] transition-colors ${
                    activeChannel === c.id ? 'bg-[#1f1f1f] text-white' : 'text-[#4a4a4a] hover:bg-[#f0f0f0]'
                  }`}
                >
                  <div className="flex items-center gap-[6px] truncate">
                    <Hash size={14} className={activeChannel === c.id ? 'text-white/70' : 'text-[#9a9a9a]'} />
                    <span className={`text-[14px] truncate ${c.unread > 0 && activeChannel !== c.id ? 'font-bold text-[#1f1f1f]' : ''}`}>
                      {c.name}
                    </span>
                  </div>
                  {c.unread > 0 && (
                    <div className={`px-[6px] py-[2px] rounded-full text-[10px] font-bold ${
                      activeChannel === c.id ? 'bg-white text-[#1f1f1f]' : 'bg-[#ef4444] text-white'
                    }`}>
                      {c.unread}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* DMs Section (Hardcoded UI for now) */}
          <div>
            <div className="flex items-center justify-between px-[8px] mb-[8px] group">
              <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Особисті</span>
              <button className="text-[#9a9a9a] hover:text-[#1f1f1f] opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-[2px]">
              {dms.map(u => (
                <button
                  key={u.id}
                  onClick={() => setActiveChannel(u.id)}
                  className={`flex items-center justify-between w-full px-[8px] py-[6px] rounded-[6px] transition-colors ${
                    activeChannel === u.id ? 'bg-[#1f1f1f] text-white' : 'text-[#4a4a4a] hover:bg-[#f0f0f0]'
                  }`}
                >
                  <div className="flex items-center gap-[8px] truncate">
                    <div className="relative flex-shrink-0">
                      <div className="w-[20px] h-[20px] rounded-[4px] bg-[#e9e9e9] flex items-center justify-center overflow-hidden">
                        <UserAvatar user={{ name: u.name }} size={20} />
                      </div>
                      {u.online && (
                        <div className={`absolute -bottom-1 -right-1 w-[8px] h-[8px] rounded-full border-2 border-[#f9f9f9] ${activeChannel === u.id ? 'border-[#1f1f1f]' : ''} bg-[#10b981]`} />
                      )}
                    </div>
                    <span className={`text-[14px] truncate ${u.unread > 0 && activeChannel !== u.id ? 'font-bold text-[#1f1f1f]' : ''}`}>
                      {u.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        
        {/* Chat Header */}
        <div className="h-[60px] flex items-center justify-between px-[20px] border-b border-[#f0f0f0] shrink-0 bg-white z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-[6px]">
              {channels.some(c => c.id === activeChannel) ? (
                <Hash size={18} className="text-[#1f1f1f]" />
              ) : (
                <UserAvatar user={{ name: dms.find(d => d.id === activeChannel)?.name || activeChannel }} size={24} />
              )}
              <h3 className="font-bold text-[#1f1f1f] text-[16px]">
                {channels.find(c => c.id === activeChannel)?.name || dms.find(d => d.id === activeChannel)?.name || activeChannel}
              </h3>
            </div>
            {channels.some(c => c.id === activeChannel) && (
              <p className="text-[12px] text-[#9a9a9a] ml-[24px]">Командне обговорення</p>
            )}
          </div>

          <div className="flex items-center gap-[16px] text-[#9a9a9a]">
            <button className="hover:text-[#1f1f1f] transition-colors"><Phone size={18} /></button>
            <button className="hover:text-[#1f1f1f] transition-colors"><Video size={18} /></button>
            <div className="w-[1px] h-[24px] bg-[#f0f0f0] mx-[4px]" />
            <button className="hover:text-[#1f1f1f] transition-colors"><Search size={18} /></button>
            <button className="hover:text-[#1f1f1f] transition-colors"><Info size={18} /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-[20px] custom-scrollbar flex flex-col gap-[20px]">
           {loading && messages.length === 0 ? (
             <div className="flex-1 flex items-center justify-center">
               <div className="w-6 h-6 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
             </div>
           ) : messages.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-[#9a9a9a]">
               <MessageSquare size={32} className="mb-2 opacity-50" />
               <p className="text-[14px]">Тут поки що немає повідомлень</p>
               <p className="text-[12px]">Станьте першим, хто напише!</p>
             </div>
           ) : (
             messages.map((msg, i) => {
               const prevMsg = messages[i - 1];
               const showHeader = !prevMsg || prevMsg.senderId !== msg.senderId || msg.isSystem || (i > 0 && prevMsg.isSystem);

               if (msg.isSystem) {
                 return (
                   <div key={msg.id} className="flex justify-center my-[10px]">
                     <span className="text-[12px] text-[#9a9a9a] bg-[#f7f7f7] px-[12px] py-[4px] rounded-full">
                       {msg.text}
                     </span>
                   </div>
                 );
               }

               return (
                 <div key={msg.id} className={`flex gap-[12px] group ${!showHeader ? 'mt-[-16px]' : ''}`}>
                   {showHeader ? (
                     <div className="w-[40px] h-[40px] rounded-[8px] bg-[#f0f0f0] shrink-0 overflow-hidden mt-[4px]">
                       <UserAvatar user={{ name: msg.user, avatar: msg.avatar }} size={40} />
                     </div>
                   ) : (
                     <div className="w-[40px] shrink-0 text-right pr-[4px] opacity-0 group-hover:opacity-100 flex items-center justify-end">
                        <span className="text-[10px] text-[#9a9a9a]">{msg.time}</span>
                     </div>
                   )}
                   
                   <div className="flex flex-col min-w-0">
                     {showHeader && (
                       <div className="flex items-baseline gap-[8px] mb-[2px]">
                         <span className="font-bold text-[#1f1f1f] text-[15px]">{msg.user}</span>
                         <span className="text-[12px] text-[#9a9a9a]">{msg.time}</span>
                       </div>
                     )}
                     <p className="text-[#1f1f1f] text-[15px] leading-[1.5] bg-transparent whitespace-pre-wrap break-words">
                       {msg.text}
                     </p>
                   </div>

                   {/* Hover actions */}
                   <div className="absolute right-[20px] opacity-0 group-hover:opacity-100 bg-white border border-[#f0f0f0] rounded-[6px] shadow-sm flex items-center p-[2px] transition-opacity">
                     <button className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[4px]"><Smile size={16} /></button>
                     <button className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[4px]"><MessageSquare size={16} /></button>
                     <button className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[4px]"><MoreVertical size={16} /></button>
                   </div>
                 </div>
               );
             })
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-[20px] pt-0 shrink-0">
          <div className="bg-white border border-[#cfcfcf] rounded-[12px] focus-within:border-[#1f1f1f] focus-within:shadow-[0_0_0_1px_#1f1f1f] transition-all overflow-hidden flex flex-col shadow-sm">
            <textarea 
              placeholder={`Написати в ${channels.some(c => c.id === activeChannel) ? '#' : ''}${channels.find(c => c.id === activeChannel)?.name || activeChannel}`}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full max-h-[250px] min-h-[44px] p-[12px] px-[16px] resize-none outline-none text-[15px] text-[#1f1f1f] placeholder:text-[#9a9a9a] bg-transparent"
              rows={1}
            />
            <div className="flex items-center justify-between px-[12px] py-[8px] bg-[#fdfdfd] border-t border-[#f0f0f0]">
              <div className="flex items-center gap-[4px]">
                <button className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[6px] transition-colors">
                  <Plus size={18} />
                </button>
                <button className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[6px] transition-colors">
                  <Smile size={18} />
                </button>
                <button className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[6px] transition-colors">
                  <Paperclip size={18} />
                </button>
              </div>
              <button 
                onClick={handleSend}
                disabled={!messageText.trim() || loading}
                className={`p-[8px] rounded-[6px] transition-colors flex items-center justify-center ${
                  messageText.trim() ? 'bg-[#1f1f1f] text-white hover:bg-black' : 'bg-[#f0f0f0] text-[#9a9a9a]'
                }`}
              >
                <Send size={16} className={messageText.trim() ? 'ml-[2px]' : ''} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
