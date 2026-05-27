'use client';
// src/app/workspace/chat/page.js
import React, { useState, useRef, useEffect } from 'react';
import { Hash, MessageSquare, Search, Phone, Video, Info, MoreVertical, Send, Smile, Paperclip, ChevronDown, Plus, Edit2, Trash2, X } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useWorkspaceChat } from '@/lib/hooks/useWorkspaceChat';
import { useOrganization }  from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import MessageContent from '@/components/workspace/MessageContent';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { uploadFile } from '@/lib/utils/uploadFile';
import { WorkspaceHeaderRight } from '@/components/WorkspaceHeader';

export default function ChatPage() {
  const { currentUser, projects, signOut } = useAppContext();
  const { members } = useOrganization();
  const showToast   = useWorkspaceStore(s => s.showToast);
  const chatSearch  = useWorkspaceStore(s => s.chatSearch);   // synced with header
  const [activeChannel, setActiveChannel] = useState({ id: 'general', type: 'channel' });
  const [messageText, setMessageText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchQuery = chatSearch; // use global store value
  
  // Create a predictable DM room ID by sorting UIDs
  const getRoomId = () => {
    if (activeChannel.type === 'channel' || activeChannel.type === 'project') return activeChannel.id;
    const myUid = currentUser?.id || currentUser?.uid;
    const otherUid = activeChannel.id;
    if (!myUid || !otherUid) return 'general';
    return [myUid, otherUid].sort().join('_');
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const threadFileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { channels, messages, loading, activeChannelData, activeThreadId, threadMessages, activeDMs, readState, sendMessage, deleteMessage, editMessage, toggleReaction, createChannel, setTyping, openThread, closeThread, sendThreadMessage, markAsRead, deleteReply, getUnreadCount } = useWorkspaceChat(getRoomId(), activeChannel.type);
  
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editMsgText, setEditMsgText] = useState('');
  const [reactingMsgId, setReactingMsgId] = useState(null);
  
  const [mentionType, setMentionType] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionCursor, setMentionCursor] = useState(0);
  
  const [recentIssues, setRecentIssues] = useState([]);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const pIds = projects.map(p => p.id).slice(0, 10);
    const q = query(collection(db, 'issues'), where('projectId', 'in', pIds));
    getDocs(q).then(snap => {
       setRecentIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [projects]);

  // Mark channel as read when user switches to it
  useEffect(() => {
    if (activeChannel) {
      markAsRead(getRoomId());
      setIsScrolledUp(false);
      setUnreadWhileScrolled(0);
      setLastMessageCount(0);
    }
  }, [activeChannel?.id, activeChannel?.type]);

  // Track scroll position
  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      setIsScrolledUp(!isAtBottom);
      if (isAtBottom) setUnreadWhileScrolled(0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Track new messages while scrolled up
  useEffect(() => {
    if (isScrolledUp && messages.length > lastMessageCount) {
      setUnreadWhileScrolled(messages.length - lastMessageCount);
    }
    setLastMessageCount(messages.length);
  }, [messages.length, isScrolledUp, lastMessageCount]);

  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const handleCreateChannelSubmit = async (e) => {
    if (e.key === 'Enter') {
      const id = await createChannel(newChannelName);
      if (id) {
        setIsCreatingChannel(false);
        setNewChannelName('');
        setActiveChannel({ id, type: 'channel' });
      } else {
        showToast('Помилка при створенні каналу', 'error');
      }
    } else if (e.key === 'Escape') {
      setIsCreatingChannel(false);
      setNewChannelName('');
    }
  };
  
  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const threadScrollRef = useRef(null);
  const [threadText, setThreadText] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, activeChannelData?.typing]);

  useEffect(() => {
    threadScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  const [threadAttachment, setThreadAttachment] = useState(null);
  const [threadUploading, setThreadUploading] = useState(false);

  const handleThreadSend = async () => {
    if (!threadText.trim() && !threadAttachment) return;
    
    setThreadUploading(true);
    let uploadedAttach = null;
    if (threadAttachment?.file) {
      try {
        uploadedAttach = await uploadFile(threadAttachment.file, `organizations/${currentUser?.orgId || 'quickteam'}/attachments`);
      } catch (e) {
        showToast('Помилка завантаження файлу', 'error');
        setThreadUploading(false);
        return;
      }
    }
    
    await sendThreadMessage(threadText, uploadedAttach ? [uploadedAttach] : []);
    setThreadText('');
    setThreadAttachment(null);
    setThreadUploading(false);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() && !attachment) return;
    
    // Clear typing
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
    setTyping(false);

    // If there's an attachment but no text, or both
    const text = messageText;
    const currentAttachment = attachment;
    
    setMessageText('');
    setAttachment(null);
    setShowEmojiPicker(false);
    
    setUploading(true);
    let uploadedAttach = null;
    if (currentAttachment?.file) {
      try {
        uploadedAttach = await uploadFile(currentAttachment.file, `organizations/${currentUser?.orgId || 'quickteam'}/attachments`);
      } catch (e) {
        showToast('Помилка завантаження файлу', 'error');
        setUploading(false);
        return;
      }
    }
    
    await sendMessage(text, uploadedAttach ? [uploadedAttach] : []);
    setUploading(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // simple local preview
    const url = URL.createObjectURL(file);
    setAttachment({ file, url, type: file.type });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setMessageText(val);
    
    // Auto-expand
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 250) + 'px';
    }

    // Mention trigger
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const matchUser = textBefore.match(/@([a-zA-Zа-яА-ЯіІїЇєЄ0-9_]*)$/);
    const matchIssue = textBefore.match(/#([a-zA-Z0-9-]*)$/);
    
    if (matchUser) {
       setMentionType('user');
       setMentionQuery(matchUser[1]);
       setMentionCursor(cursor);
    } else if (matchIssue) {
       setMentionType('issue');
       setMentionQuery(matchIssue[1]);
       setMentionCursor(cursor);
    } else {
       setMentionType(null);
       setMentionQuery(null);
    }

    // Typing indicator
    if (!typingTimeoutRef.current) {
      setTyping(true);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    if (!members.length) return;
    
    const uids = members.map(m => m.id || m.uid);
    if (uids.length === 0) return;
    const q = query(collection(db, 'users'), where('__name__', 'in', uids.slice(0, 30)));
    const unsub = onSnapshot(q, (snap) => {
      const pMap = {};
      snap.forEach(d => {
        pMap[d.id] = d.data().lastActive;
      });
      setPresenceMap(prev => ({...prev, ...pMap}));
    });
    return () => unsub();
  }, [members]);

  const myUid = currentUser?.uid || currentUser?.id;

  // Build DM list: show all members, but highlight active DMs
  const activeDMSet = new Set(activeDMs);
  if (activeChannel.type === 'dm') {
    activeDMSet.add(activeChannel.id);
  }

  const dms = members
    .filter(m => {
      const id = m.uid || m.id;
      return id !== myUid;
    })
    .map(m => {
      const id = m.uid || m.id;
      const lastActive = presenceMap[id] || m.lastActive;
      return {
        id,
        name: m.name || m.email,
        online: lastActive && (Date.now() - new Date(lastActive).getTime() < 120000),
        avatar: m.avatar,
        isActive: activeDMSet.has(id)
      };
    })
    .sort((a, b) => {
      // Sort: active conversations first, then by name
      if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const isActive = (id) => activeChannel.id === id;

  const activeThreadParent = activeThreadId ? messages.find(m => m.id === activeThreadId) : null;

  return (
    <div className="flex h-full bg-white overflow-hidden">
      
      {/* Sidebar (Channels & DMs) */}
      <div className="w-[240px] bg-[#fafafa] border-r border-[#f0f0f0] flex flex-col h-full shrink-0">
        
        {/* Workspace Header */}
        <div className="h-[56px] flex items-center justify-between px-[24px] border-b border-[#f0f0f0] hover:bg-[#f0f0f0] cursor-pointer transition-colors">
          <h2 className="font-bold text-[#1f1f1f] text-[15px] tracking-tight">QuickTeam HQ</h2>
          <ChevronDown size={16} className="text-[#9a9a9a]" />
        </div>

        <div className="flex-1 overflow-y-auto py-[16px] px-[12px] custom-scrollbar">
          
          {/* Channels Section */}
          <div className="mb-[24px]">
            <div className="flex items-center justify-between px-[8px] mb-[8px] group">
              <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Канали</span>
              <button 
                onClick={() => setIsCreatingChannel(true)}
                className="text-[#9a9a9a] hover:text-[#1f1f1f] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus size={14} />
              </button>
            </div>
            
            <div className="flex flex-col gap-[2px]">
              {isCreatingChannel && (
                <div className="px-[8px] py-[4px]">
                  <input
                    autoFocus
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onKeyDown={handleCreateChannelSubmit}
                    onBlur={() => { setIsCreatingChannel(false); setNewChannelName(''); }}
                    placeholder="назва-каналу"
                    className="w-full text-[13px] bg-white border border-[#1f1f1f] rounded-[8px] px-2 py-1 outline-none"
                  />
                  <p className="text-[10px] text-[#9a9a9a] mt-1 ml-1">Enter - зберегти, Esc - скасувати</p>
                </div>
              )}
              {channels.map(c => {
                const unreadCount = getUnreadCount(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveChannel({ id: c.id, type: 'channel' })}
                    className={`flex items-start justify-between w-full px-[8px] py-[6px] rounded-[8px] transition-colors group ${
                      isActive(c.id) ? 'bg-[#1f1f1f] text-white' : 'text-[#4a4a4a] hover:bg-[#f0f0f0]'
                    }`}
                  >
                    <div className="flex items-start gap-[6px] truncate flex-1">
                      <Hash size={13} className={`shrink-0 mt-[2px] ${isActive(c.id) ? 'text-white/60' : 'text-[#9a9a9a]'}`} />
                      <div className="truncate flex-1 min-w-0">
                        <p className={`text-[13px] truncate ${unreadCount > 0 && !isActive(c.id) ? 'font-bold text-[#1f1f1f]' : ''}`}>
                          {c.name}
                        </p>
                        {c.lastMessageText && (
                          <p className={`text-[11px] truncate ${isActive(c.id) ? 'text-white/60' : 'text-[#9a9a9a]'}`}>
                            {c.lastMessageSender}: {c.lastMessageText}
                          </p>
                        )}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <div className={`shrink-0 px-[6px] py-[1px] rounded-full text-[10px] font-bold ml-1 ${
                        isActive(c.id) ? 'bg-white/20 text-white' : 'bg-[#1f1f1f] text-white'
                      }`}>
                        {unreadCount}
                      </div>
                    )}
                  </button>
                );
              })}

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
              {dms.map((u, idx, arr) => {
                const showSeparator = idx > 0 && arr[idx - 1].isActive && !u.isActive;
                const dmRoomId = [myUid, u.id].sort().join('_');
                const unreadCount = getUnreadCount(dmRoomId);
                return (
                  <React.Fragment key={u.id}>
                    {showSeparator && (
                      <div className="my-1 border-t border-[#e9e9e9]" />
                    )}
                    <button
                      onClick={() => setActiveChannel({ id: u.id, type: 'dm' })}
                      className={`flex items-start justify-between w-full px-[8px] py-[6px] rounded-[8px] transition-colors group ${
                        isActive(u.id) ? 'bg-[#1f1f1f] text-white' : 'text-[#4a4a4a] hover:bg-[#f0f0f0]'
                      }`}
                    >
                      <div className="flex items-start gap-[8px] truncate flex-1">
                        <div className="relative flex-shrink-0 mt-[2px]">
                          <div className="w-[20px] h-[20px] rounded-full bg-[#e9e9e9] flex items-center justify-center overflow-hidden">
                            <UserAvatar user={{ name: u.name, avatar: u.avatar }} size={20} />
                          </div>
                          {u.online && (
                            <div className="absolute -bottom-[1px] -right-[1px] w-[7px] h-[7px] rounded-full border-2 border-[#fafafa] bg-[#10b981]" />
                          )}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <p className={`text-[13px] truncate ${unreadCount > 0 && !isActive(u.id) ? 'font-bold text-[#1f1f1f]' : ''}`}>
                            {u.name}
                          </p>
                          {/* Note: DM rooms don't have lastMessageText like channels - would need to fetch separately */}
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <div className={`shrink-0 px-[6px] py-[1px] rounded-full text-[10px] font-bold ml-1 ${
                          isActive(u.id) ? 'bg-white/20 text-white' : 'bg-[#1f1f1f] text-white'
                        }`}>
                          {unreadCount}
                        </div>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        
        {/* Chat Header */}
        <div className="h-[56px] flex items-center justify-between px-[24px] border-b border-[#f0f0f0] shrink-0 bg-white z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-[6px]">
              {(activeChannel.type === 'channel' || activeChannel.type === 'project') ? (
                <Hash size={18} className="text-[#1f1f1f]" />
              ) : (
                <UserAvatar user={{ name: dms.find(d => d.id === activeChannel.id)?.name || 'User', avatar: dms.find(d => d.id === activeChannel.id)?.avatar }} size={24} />
              )}
              <h3 className="font-bold text-[#1f1f1f] text-[16px]">
                {(activeChannel.type === 'channel' || activeChannel.type === 'project')
                  ? (channels.find(c => c.id === activeChannel.id)?.name || activeChannel.id)
                  : (dms.find(d => d.id === activeChannel.id)?.name || 'Особисті повідомлення')}
              </h3>
            </div>
            {(activeChannel.type === 'channel' || activeChannel.type === 'project') && (
              <p className="text-[12px] text-[#9a9a9a] ml-[24px]">{activeChannel.type === 'project' ? 'Проектний чат' : 'Командне обговорення'}</p>
            )}
          </div>

          <div className="flex items-center gap-[16px]">
            <button className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"><Info size={18} /></button>
            <div className="h-[24px] w-[1px] bg-[#f0f0f0]"></div>
            <WorkspaceHeaderRight currentUser={currentUser} signOut={signOut} />
          </div>
        </div>

        {/* Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-[20px] custom-scrollbar flex flex-col gap-[8px]">
           {loading && messages.length === 0 ? (
             <div className="flex-1 flex items-center justify-center">
               <div className="w-6 h-6 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
             </div>
           ) : messages.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-[#9a9a9a]">
               <MessageSquare size={32} className="mb-2 opacity-50" />
               <p className="text-[14px]">Тут поки що немає повідомлень</p>
               <p className="text-[12px]">Почніть розмову першим!</p>
             </div>
           ) : (() => {
             const displayMessages = chatSearch.trim() ? messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase())) : messages;
             return displayMessages.map((msg, i) => {
               // Find the actual previous message in the original messages array for proper grouping
               const msgIndex = messages.findIndex(m => m.id === msg.id);
               const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;

               const showHeader = !prevMsg || prevMsg.senderId !== msg.senderId || msg.isSystem || prevMsg.isSystem || (msg.createdAt?.toMillis() - prevMsg.createdAt?.toMillis() > 300000); // 5 mins gap

               // Check if we need to show date separator (new day)
               const showDateSeparator = prevMsg && msg.createdAt && prevMsg.createdAt &&
                 new Date(msg.createdAt.toDate()).toDateString() !== new Date(prevMsg.createdAt.toDate()).toDateString();

               const msgDate = msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleDateString('uk-UA', { weekday: 'long', month: 'short', day: 'numeric' }) : '';

               return (
                 <React.Fragment key={msg.id}>
                   {showDateSeparator && (
                     <div className="flex items-center gap-3 my-4">
                       <div className="flex-1 h-px bg-[#f0f0f0]" />
                       <span className="text-[11px] font-bold text-[#9a9a9a]">{msgDate}</span>
                       <div className="flex-1 h-px bg-[#f0f0f0]" />
                     </div>
                   )}

                   {msg.isSystem ? (
                     <div className="flex justify-center my-[16px]">
                       <span className="text-[12px] text-[#9a9a9a] bg-[#f7f7f7] px-[12px] py-[4px] rounded-full">
                         {msg.text}
                       </span>
                     </div>
                   ) : (
                     <div key={msg.id} className={`flex gap-[12px] group px-[8px] py-[4px] hover:bg-[#f8f8f8] -mx-[8px] rounded-[8px] transition-colors relative ${!showHeader ? 'mt-[-4px]' : 'mt-[12px]'}`}>
                   {showHeader ? (
                     <div className="w-[36px] h-[36px] rounded-[8px] shrink-0 overflow-hidden mt-[2px]">
                       <UserAvatar user={{ name: msg.user, avatar: msg.avatar }} size={36} />
                     </div>
                   ) : (
                     <div className="w-[36px] shrink-0 text-right pr-[4px] opacity-0 group-hover:opacity-100 flex items-center justify-end">
                        <span className="text-[10px] text-[#9a9a9a]">{msg.time}</span>
                     </div>
                   )}
                   
                   <div className="flex flex-col min-w-0 flex-1">
                     {showHeader && (
                       <div className="flex items-baseline gap-[8px] mb-[2px]">
                         <span className="font-bold text-[#1f1f1f] text-[15px] hover:underline cursor-pointer">{msg.user}</span>
                         <span className="text-[11px] text-[#9a9a9a] hover:underline cursor-pointer">{msg.time}</span>
                       </div>
                     )}
                     
                     {editingMsgId === msg.id ? (
                        <div className="mt-1 flex flex-col gap-2">
                           <textarea
                             value={editMsgText}
                             onChange={e => setEditMsgText(e.target.value)}
                             className="w-full bg-[#f7f7f7] border border-[#1f1f1f] rounded-[10px] p-2 text-[14px] outline-none"
                             rows={3}
                           />
                           <div className="flex gap-2">
                             <button onClick={() => setEditingMsgId(null)} className="px-3 py-1 bg-[#f7f7f7] hover:bg-[#f0f0f0] rounded-[8px] text-[12px] font-medium transition-colors">Скасувати</button>
                             <button onClick={() => { editMessage(msg.id, editMsgText); setEditingMsgId(null); }} disabled={!editMsgText.trim()} className="px-3 py-1 bg-[#1f1f1f] hover:bg-[#303030] disabled:opacity-40 text-white rounded-[8px] text-[12px] font-medium transition-colors">Зберегти</button>
                           </div>
                        </div>
                     ) : (
                       <div className="text-[#333333] text-[15px] leading-[1.46] whitespace-pre-wrap break-words">
                         <MessageContent text={msg.text} members={members} />
                         {msg.isEdited && <span className="text-[11px] text-[#9a9a9a] ml-1">(відредаговано)</span>}
                         
                         {msg.attachments && msg.attachments.length > 0 && (
                           <div className="mt-2 flex flex-col gap-2">
                             {msg.attachments.map((att, i) => (
                               <div key={i} className="max-w-[300px]">
                                 {att.type?.startsWith('image/') ? (
                                   <a href={att.url} target="_blank" rel="noopener">
                                     <img src={att.url} alt={att.name} className="rounded-[8px] border border-[#e9e9e9] max-h-[200px] object-cover hover:opacity-90 transition-opacity" />
                                   </a>
                                 ) : (
                                   <a href={att.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-2 rounded-[8px] border border-[#e9e9e9] bg-[#f7f7f7] hover:bg-[#f0f0f0] transition-colors">
                                     <Paperclip size={16} className="text-[#9a9a9a]" />
                                     <span className="text-[13px] font-medium text-[#1f1f1f] truncate flex-1">{att.name}</span>
                                     <span className="text-[10px] text-[#9a9a9a]">{Math.round(att.size / 1024)} KB</span>
                                   </a>
                                 )}
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                     )}

                     {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                       <div className="flex flex-wrap gap-1 mt-1">
                         {Object.entries(msg.reactions).map(([emoji, users]) => {
                           const hasReacted = users.includes(myUid);
                           return (
                             <button
                               key={emoji}
                               onClick={() => toggleReaction(msg.id, emoji)}
                               className={`flex items-center gap-1 px-[6px] py-[2px] rounded-[12px] text-[11px] border transition-colors ${hasReacted ? 'bg-[#eef2ff] border-[#6366f1]/30 text-[#4f46e5]' : 'bg-[#f0f0f0] border-transparent text-[#4a4a4a] hover:bg-[#e9e9e9]'}`}
                             >
                               <span>{emoji}</span>
                               <span className="font-bold">{users.length}</span>
                             </button>
                           );
                         })}
                       </div>
                     )}

                     {msg.replyCount > 0 && (
                       <div className="mt-1">
                         <button onClick={() => openThread(msg.id)} className="text-[12px] text-[#6366f1] font-bold hover:underline flex items-center gap-1 px-2 py-[3px] rounded-[8px] hover:bg-[#eef2ff] transition-colors">
                           <MessageSquare size={11} />
                           {msg.replyCount} {msg.replyCount === 1 ? 'відповідь' : msg.replyCount > 1 && msg.replyCount < 5 ? 'відповіді' : 'відповідей'}
                         </button>
                       </div>
                     )}
                   </div>

                   {/* Hover actions */}
                   <div className="absolute right-[20px] top-[-10px] opacity-0 group-hover:opacity-100 bg-white border border-[#e9e9e9] rounded-[6px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex items-center p-[2px] transition-opacity z-10">
                     <div className="relative">
                       <button onClick={() => setReactingMsgId(reactingMsgId === msg.id ? null : msg.id)} className={`p-[6px] hover:text-[#1f1f1f] hover:bg-[#f8f8f8] rounded-[4px] transition-colors ${reactingMsgId === msg.id ? 'text-[#1f1f1f] bg-[#f0f0f0]' : 'text-[#616061]'}`}>
                         <Smile size={16} />
                       </button>
                       {reactingMsgId === msg.id && (
                         <div className="absolute right-0 top-[32px] bg-white border border-[#e9e9e9] rounded-[8px] shadow-lg p-2 grid grid-cols-6 gap-1 z-20 w-[220px]">
                           {['👍','❤️','🔥','😂','🎉','👀','🙌','💯','🤔','✅','🚀','👋'].map(emoji => (
                             <button
                               key={emoji}
                               onClick={() => {
                                 toggleReaction(msg.id, emoji);
                                 setReactingMsgId(null);
                               }}
                               className="w-8 h-8 flex items-center justify-center hover:bg-[#f0f0f0] rounded-[6px] text-[16px] transition-colors"
                             >
                               {emoji}
                             </button>
                           ))}
                         </div>
                       )}
                     </div>
                     <button onClick={() => openThread(msg.id)} className="p-[6px] text-[#616061] hover:text-[#1f1f1f] hover:bg-[#f8f8f8] rounded-[4px] transition-colors"><MessageSquare size={16} /></button>
                     {msg.senderId === myUid && (
                       <>
                         <button onClick={() => { setEditingMsgId(msg.id); setEditMsgText(msg.text); setReactingMsgId(null); }} className="p-[6px] text-[#616061] hover:text-[#1f1f1f] hover:bg-[#f8f8f8] rounded-[4px] transition-colors"><Edit2 size={16} /></button>
                         <button onClick={() => { if(confirm('Ви впевнені, що хочете видалити це повідомлення?')) deleteMessage(msg.id); }} className="p-[6px] text-[#616061] hover:text-[#ef4444] hover:bg-red-50 rounded-[4px] transition-colors"><Trash2 size={16} /></button>
                       </>
                     )}
                   </div>
                 </div>
                   )}
                 </React.Fragment>
               );
             });
             })()}

            {activeChannelData?.typing?.length > 0 && activeChannelData.typing.some(uid => uid !== myUid) && (
              <div className="flex items-center gap-2 mt-2 px-[8px]">
                <div className="flex gap-1">
                  <span className="w-[5px] h-[5px] bg-[#cfcfcf] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-[5px] h-[5px] bg-[#cfcfcf] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-[5px] h-[5px] bg-[#cfcfcf] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[12px] text-[#9a9a9a] italic">
                  {activeChannelData.typing.filter(uid => uid !== myUid).map(uid => members.find(m => (m.id || m.uid) === uid)?.name || 'Хтось').join(', ')} друкує...
                </span>
              </div>
            )}

            {unreadWhileScrolled > 0 && isScrolledUp && (
              <div className="fixed bottom-[80px] left-1/2 transform -translate-x-1/2 z-20">
                <button
                  onClick={() => {
                    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1f1f1f] text-white rounded-full shadow-lg hover:bg-[#303030] transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <span className="text-[12px] font-bold">{unreadWhileScrolled} нових повідомлень</span>
                  <ChevronDown size={16} />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-[20px] pt-[10px] shrink-0 relative">
          {/* Simple Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-[100%] left-[20px] mb-2 bg-white border border-[#e9e9e9] rounded-[10px] shadow-lg p-2 grid grid-cols-6 gap-1 z-20">
              {['😀','😂','🥰','😎','🤔','👍','🎉','🔥','❤️','✨','🙌','💯'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    setMessageText(prev => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[#f0f0f0] rounded-[6px] text-[18px] transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {mentionType === 'user' && mentionQuery !== null && (
            <div className="absolute bottom-[100%] left-[20px] mb-2 bg-white border border-[#e9e9e9] rounded-[8px] shadow-lg py-1 w-[200px] z-20">
              {members.filter(m => (m.name||m.email).toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5).map(m => (
                <button
                  key={m.uid||m.id}
                  onClick={() => {
                    const before = messageText.slice(0, mentionCursor - mentionQuery.length - 1);
                    const after = messageText.slice(mentionCursor);
                    setMessageText(before + `@${(m.name||m.email).replace(/\s+/g,'_')} ` + after);
                    setMentionQuery(null);
                    setMentionType(null);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#f0f0f0] text-[13px] flex items-center gap-2 transition-colors"
                >
                  <UserAvatar user={m} size={16} />
                  <span className="truncate">{m.name || m.email}</span>
                </button>
              ))}
            </div>
          )}

          {mentionType === 'issue' && mentionQuery !== null && (
            <div className="absolute bottom-[100%] left-[20px] mb-2 bg-white border border-[#e9e9e9] rounded-[8px] shadow-lg py-1 w-[240px] z-20">
              {recentIssues.filter(iss => iss.issueKey?.toLowerCase().includes(mentionQuery.toLowerCase()) || iss.title?.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5).map(iss => (
                <button
                  key={iss.id}
                  onClick={() => {
                    const before = messageText.slice(0, mentionCursor - mentionQuery.length - 1);
                    const after = messageText.slice(mentionCursor);
                    setMessageText(before + `#${iss.issueKey} ` + after);
                    setMentionQuery(null);
                    setMentionType(null);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#f0f0f0] flex flex-col gap-1 transition-colors"
                >
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="font-bold text-[#c026d3]">{iss.issueKey}</span>
                    <span className="text-[#9a9a9a] truncate flex-1">{iss.title}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="bg-[#f7f7f7] rounded-[16px] focus-within:ring-2 focus-within:ring-[#1f1f1f]/10 transition-all overflow-visible flex flex-col">
            {attachment && (
              <div className="px-[12px] pt-[8px] flex items-center gap-2">
                <div className="relative inline-block">
                  {attachment.type.startsWith('image/') ? (
                    <img src={attachment.url} alt="attachment" className="h-[60px] rounded-[6px] object-cover border border-[#e9e9e9]" />
                  ) : (
                    <div className="h-[60px] px-4 flex items-center bg-[#f7f7f7] rounded-[6px] border border-[#e9e9e9] text-[12px] font-medium text-[#1f1f1f]">
                      📎 {attachment.file.name}
                    </div>
                  )}
                  <button 
                    onClick={() => setAttachment(null)}
                    className="absolute -top-2 -right-2 bg-white border border-[#e9e9e9] rounded-full p-1 text-red-500 hover:bg-red-50 shadow-sm"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
            <textarea 
              ref={textareaRef}
              placeholder={`Повідомлення до ${activeChannel.type === 'channel' ? '#' : ''}${activeChannel.type === 'channel' ? (channels.find(c => c.id === activeChannel.id)?.name || activeChannel.id) : (dms.find(d => d.id === activeChannel.id)?.name || 'користувача')}`}
              value={messageText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              className="w-full max-h-[250px] min-h-[44px] p-[12px] px-[16px] resize-none outline-none text-[15px] text-[#1f1f1f] placeholder:text-[#9a9a9a] bg-transparent"
              rows={1}
            />
            <div className="flex items-center justify-between px-[12px] py-[8px] border-t border-[#ebebeb]">
              <div className="flex items-center gap-[4px]">
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-[6px] rounded-[6px] transition-colors ${showEmojiPicker ? 'bg-[#f0f0f0] text-[#1f1f1f]' : 'text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0]'}`}>
                  <Smile size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[6px] transition-colors disabled:opacity-50">
                  <Paperclip size={18} />
                </button>
              </div>
              <button 
                onClick={handleSend}
                disabled={(!messageText.trim() && !attachment) || loading || uploading}
                className={`p-[6px] px-[10px] rounded-[10px] transition-all flex items-center justify-center ${
                  messageText.trim() || attachment ? 'bg-[#1f1f1f] text-white hover:bg-[#303030]' : 'text-[#cfcfcf] cursor-not-allowed'
                }`}
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={15} className={messageText.trim() || attachment ? 'mr-[4px]' : ''} />
                    {(messageText.trim() || attachment) && <span className="text-[13px] font-bold">Надіслати</span>}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Thread Panel */}
      {activeThreadId && activeThreadParent && (
        <div className="w-[340px] bg-white border-l border-[#f7f7f7] flex flex-col h-full shrink-0 relative z-20">
          <div className="h-[56px] flex items-center justify-between px-[16px] border-b border-[#f7f7f7] shrink-0">
            <h3 className="font-bold text-[#1f1f1f] text-[14px]">Гілка відповідей</h3>
            <button onClick={closeThread} className="text-[#9a9a9a] hover:text-[#1f1f1f] p-1 rounded hover:bg-[#f0f0f0] transition-colors"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-[16px] custom-scrollbar flex flex-col gap-[16px]">
            {/* Parent Message */}
            <div className="flex gap-[12px]">
              <div className="w-[36px] h-[36px] rounded-[8px] shrink-0 overflow-hidden mt-[2px]">
                <UserAvatar user={{ name: activeThreadParent.user, avatar: activeThreadParent.avatar }} size={36} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-baseline gap-[8px] mb-[2px]">
                  <span className="font-bold text-[#1f1f1f] text-[15px]">{activeThreadParent.user}</span>
                  <span className="text-[11px] text-[#9a9a9a]">{activeThreadParent.time}</span>
                </div>
                <div className="text-[#333333] text-[15px] leading-[1.46] whitespace-pre-wrap break-words">
                  <MessageContent text={activeThreadParent.text} members={members} />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2 mb-1">
               <div className="h-[1px] flex-1 bg-[#e9e9e9]" />
               <span className="text-[11px] font-bold text-[#9a9a9a]">{activeThreadParent.replyCount || threadMessages.length} {activeThreadParent.replyCount === 1 || threadMessages.length === 1 ? 'відповідь' : 'відповідей'}</span>
               <div className="h-[1px] flex-1 bg-[#e9e9e9]" />
            </div>

            {/* Replies */}
            {threadMessages.map(msg => (
              <div key={msg.id} className="flex gap-[12px] hover:bg-[#f0f0f0]/50 -mx-[8px] px-[8px] py-[4px] rounded-[8px] transition-colors group relative">
                <div className="w-[28px] h-[28px] rounded-[6px] shrink-0 overflow-hidden mt-[2px]">
                  <UserAvatar user={{ name: msg.user, avatar: msg.avatar }} size={28} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-baseline gap-[8px] mb-[2px]">
                    <span className="font-bold text-[#1f1f1f] text-[14px]">{msg.user}</span>
                    <span className="text-[11px] text-[#9a9a9a]">{msg.time}</span>
                  </div>
                  <div className="text-[#333333] text-[14px] leading-[1.46] whitespace-pre-wrap break-words">
                    <MessageContent text={msg.text} members={members} />
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 flex flex-col gap-2">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="max-w-[260px]">
                            {att.type?.startsWith('image/') ? (
                              <a href={att.url} target="_blank" rel="noopener">
                                <img src={att.url} alt={att.name} className="rounded-[8px] border border-[#e9e9e9] max-h-[150px] object-cover hover:opacity-90 transition-opacity" />
                              </a>
                            ) : (
                              <a href={att.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-2 rounded-[8px] border border-[#e9e9e9] bg-[#f7f7f7] hover:bg-[#f0f0f0] transition-colors">
                                <Paperclip size={14} className="text-[#9a9a9a]" />
                                <span className="text-[11px] font-medium text-[#1f1f1f] truncate flex-1">{att.name}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {msg.senderId === myUid && (
                  <button
                    onClick={() => { if (confirm('Видалити відповідь?')) deleteReply(activeThreadId, msg.id); }}
                    className="opacity-0 group-hover:opacity-100 p-[6px] text-[#616061] hover:text-[#ef4444] hover:bg-red-50 rounded-[4px] transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <div ref={threadScrollRef} className="h-2" />
          </div>

          <div className="p-[16px] shrink-0">
            <div className="bg-[#f7f7f7] rounded-[14px] focus-within:ring-2 focus-within:ring-[#1f1f1f]/10 transition-all flex flex-col">
              {threadAttachment && (
                <div className="px-[10px] pt-[8px] flex items-center gap-2">
                  <div className="relative inline-block">
                    {threadAttachment.type.startsWith('image/') ? (
                      <img src={threadAttachment.url} alt="attachment" className="h-[40px] rounded-[4px] object-cover border border-[#e9e9e9]" />
                    ) : (
                      <div className="h-[40px] px-3 flex items-center bg-[#f7f7f7] rounded-[4px] border border-[#e9e9e9] text-[10px] font-medium text-[#1f1f1f]">
                        📎 {threadAttachment.file.name}
                      </div>
                    )}
                    <button 
                      onClick={() => setThreadAttachment(null)}
                      className="absolute -top-1 -right-1 bg-white border border-[#e9e9e9] rounded-full p-[2px] text-red-500 hover:bg-red-50 shadow-sm"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              )}
              <textarea
                value={threadText}
                onChange={e => setThreadText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleThreadSend();
                  }
                }}
                placeholder="Відповісти..."
                className="w-full max-h-[150px] min-h-[40px] resize-none outline-none text-[14px] text-[#1f1f1f] bg-transparent custom-scrollbar p-[10px]"
                rows={1}
              />
              <div className="flex justify-between items-center p-[6px] border-t border-[#ebebeb]">
                <div className="flex items-center">
                  <input 
                    type="file" 
                    ref={threadFileInputRef} 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setThreadAttachment({ file, url: URL.createObjectURL(file), type: file.type });
                    }} 
                    className="hidden" 
                  />
                  <button onClick={() => threadFileInputRef.current?.click()} disabled={threadUploading} className="p-[4px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[4px] transition-colors disabled:opacity-50">
                    <Paperclip size={16} />
                  </button>
                </div>
                <button 
                  onClick={handleThreadSend}
                  disabled={(!threadText.trim() && !threadAttachment) || threadUploading}
                  className={`p-[6px] px-[10px] rounded-[8px] transition-all flex items-center justify-center ${threadText.trim() || threadAttachment ? 'bg-[#1f1f1f] text-white hover:bg-[#303030]' : 'text-[#cfcfcf] cursor-not-allowed'}`}
                >
                  {threadUploading ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={14} className={(threadText.trim() || threadAttachment) ? "mr-1" : ""} />
                      {(threadText.trim() || threadAttachment) && <span className="text-[12px] font-bold">Відповісти</span>}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
