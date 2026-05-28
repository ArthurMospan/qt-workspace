'use client';
// src/app/workspace/chat/page.js - Clean zoning with colors only
import React, { useState, useRef, useEffect } from 'react';
import { Hash, MessageSquare, Info, Send, Smile, Paperclip, Plus, Edit2, Trash2, X, Pin, ChevronDown } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useWorkspaceChat } from '@/lib/hooks/useWorkspaceChat';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import MessageContent from '@/components/workspace/MessageContent';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore';
import { uploadFile } from '@/lib/utils/uploadFile';
import EmojiPicker from 'emoji-picker-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/Feedback/LoadingSpinner';
import { Card } from '@/components/ui/Card';

export default function ChatPage() {
  const { currentUser, projects, activeOrgId } = useAppContext();
  const { members } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);
  const chatSearch = useWorkspaceStore(s => s.chatSearch);
  const [activeChannel, setActiveChannel] = useState({ id: 'general', type: 'channel' });
  const [messageText, setMessageText] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  const getRoomId = () => {
    if (activeChannel.type === 'channel') return activeChannel.id;
    const myUid = currentUser?.id || currentUser?.uid;
    const otherUid = activeChannel.id;
    if (!myUid || !otherUid) return 'general';
    return [myUid, otherUid].sort().join('_');
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const threadFileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { channels, messages, loading, activeChannelData, activeThreadId, threadMessages, activeDMs, readState, sendMessage, deleteMessage, editMessage, toggleReaction, createChannel, setTyping, openThread, closeThread, sendThreadMessage, markAsRead, deleteReply } = useWorkspaceChat(getRoomId(), activeChannel.type);

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
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showChannelInfo, setShowChannelInfo] = useState(false);

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const pIds = projects.map(p => p.id).slice(0, 10);
    const q = query(collection(db, 'issues'), where('projectId', 'in', pIds));
    getDocs(q).then(snap => setRecentIssues(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [projects]);

  useEffect(() => {
    const roomId = getRoomId();
    const savedDraft = localStorage.getItem(`draft_${roomId}`);
    if (savedDraft) setMessageText(savedDraft);
    else setMessageText('');
  }, [activeChannel?.id]);

  useEffect(() => {
    const roomId = getRoomId();
    const timer = setTimeout(() => {
      if (messageText.trim()) localStorage.setItem(`draft_${roomId}`, messageText);
      else localStorage.removeItem(`draft_${roomId}`);
    }, 1000);
    return () => clearTimeout(timer);
  }, [messageText, activeChannel?.id]);

  useEffect(() => {
    if (activeChannel) {
      markAsRead(getRoomId());
      setIsScrolledUp(false);
      setUnreadWhileScrolled(0);
      setLastMessageCount(0);
    }
  }, [activeChannel?.id, activeChannel?.type]);

  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const [threadText, setThreadText] = useState('');
  const threadScrollRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => scrollToBottom(), [messages.length, activeChannelData?.typing]);
  useEffect(() => threadScrollRef.current?.scrollIntoView({ behavior: 'smooth' }), [threadMessages.length]);

  const [threadAttachments, setThreadAttachments] = useState([]);
  const [threadUploading, setThreadUploading] = useState(false);

  const handleThreadSend = async () => {
    if (!threadText.trim() && threadAttachments.length === 0) return;
    setThreadUploading(true);
    let uploadedAttaches = [];
    if (threadAttachments.length > 0) {
      try {
        uploadedAttaches = await Promise.all(threadAttachments.map(att => 
          uploadFile(att.file, `organizations/${currentUser?.orgId || 'quickteam'}/attachments`)
        ));
      } catch (e) {
        showToast('Помилка завантаження файлу', 'error');
        setThreadUploading(false);
        return;
      }
    }
    await sendThreadMessage(threadText, uploadedAttaches);
    setThreadText('');
    setThreadAttachments([]);
    setThreadUploading(false);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() && attachments.length === 0) return;

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
    setTyping(false);

    const text = messageText;
    const currentAttachments = attachments;

    setMessageText('');
    localStorage.removeItem(`draft_${getRoomId()}`);
    setAttachments([]);
    setShowEmojiPicker(false);

    setUploading(true);
    let uploadedAttaches = [];
    if (currentAttachments.length > 0) {
      try {
        uploadedAttaches = await Promise.all(currentAttachments.map(att => 
          uploadFile(att.file, `organizations/${currentUser?.orgId || 'quickteam'}/attachments`)
        ));
      } catch (e) {
        showToast('Помилка завантаження файлу', 'error');
        setUploading(false);
        return;
      }
    }

    await sendMessage(text, uploadedAttaches);
    setUploading(false);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newAttachments = files.map(file => ({ file, url: URL.createObjectURL(file), type: file.type, name: file.name, size: file.size }));
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

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

  const handleTextChange = (e) => {
    const val = e.target.value;
    setMessageText(val);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 250) + 'px';
    }

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

    if (!typingTimeoutRef.current) setTyping(true);
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

  const activeDMSet = new Set(activeDMs);
  if (activeChannel.type === 'dm') activeDMSet.add(activeChannel.id);

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
      if (a.isActive !== b.isActive) return b.isActive ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const isActive = (id) => activeChannel.id === id;
  const activeThreadParent = activeThreadId ? messages.find(m => m.id === activeThreadId) : null;

  const handleUpdateChannelDescription = async () => {
    if (activeChannel.type !== 'channel' || !activeOrgId) return;
    try {
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', activeChannel.id);
      await updateDoc(channelRef, { description: newDescription });
      setEditingDescription(false);
      showToast('Опис оновлено ✓');
    } catch (err) {
      console.error('Error updating description:', err);
      showToast('Помилка при збереженні опису', 'error');
    }
  };

  const currentChannel = channels.find(c => c.id === activeChannel.id);

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

  useEffect(() => {
    if (isScrolledUp && messages.length > lastMessageCount) {
      setUnreadWhileScrolled(messages.length - lastMessageCount);
    }
    setLastMessageCount(messages.length);
  }, [messages.length, isScrolledUp, lastMessageCount]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header with search */}
      <WorkspaceHeader />

      {/* Two-zone layout: LEFT gray (channels), RIGHT split into header and messages */}
      <div className="flex-1 flex overflow-hidden gap-[12px] px-[12px] pb-[12px] pt-0">

        {/* LEFT: Channels & DMs (GRAY ZONE - ROUNDED CARD) */}
        <div className="w-[280px] bg-[#f7f7f7] rounded-[24px] flex flex-col overflow-hidden">
          {/* Channels & DMs list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Channels */}
            <div className="px-[16px] py-[12px]">
              <div className="flex items-center justify-between mb-[12px] group">
                <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Канали</span>
                <Button
                  size="icon"
                  style="ghost"
                  color="dark"
                  onClick={() => setIsCreatingChannel(true)}
                  icon={Plus}
                  iconSize={14}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>

              <div className="flex flex-col gap-[2px]">
                {isCreatingChannel && (
                  <div className="px-[8px] py-[4px] mb-[4px]">
                    <Input
                      autoFocus
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      onKeyDown={handleCreateChannelSubmit}
                      onBlur={() => { setIsCreatingChannel(false); setNewChannelName(''); }}
                      placeholder="назва-каналу"
                      className="text-[13px]"
                    />
                  </div>
                )}
                {channels
                  .filter(c => c.status !== 'archived' && c.name && c.name.toLowerCase().includes(chatSearch.toLowerCase()))
                  .map(c => {
                  const hasUnread = readState[c.id] && c.lastMessageAt && (c.lastMessageAt?.toMillis?.() ?? 0) > (readState[c.id]?.toMillis?.() ?? 0);
                  return (
                    <Button
                      key={c.id}
                      onClick={() => setActiveChannel({ id: c.id, type: 'channel' })}
                      style={isActive(c.id) ? 'secondary' : 'ghost'}
                      color="dark"
                      size="md"
                      icon={Hash}
                      iconSize={13}
                      className={`w-full justify-start px-[8px] py-[6px] h-auto ${!isActive(c.id) ? 'text-[#9a9a9a] hover:text-[#1f1f1f]' : ''}`}
                    >
                      <span className={`text-[13px] truncate flex-1 text-left ${hasUnread && !isActive(c.id) ? 'font-bold' : ''}`}>
                        {c.name}
                      </span>
                      {hasUnread && !isActive(c.id) && (
                        <div className="shrink-0 w-[6px] h-[6px] rounded-full ml-auto bg-[#6366f1]" />
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* DMs */}
            <div className="px-[16px] py-[12px] border-t border-[#e9e9e9]">
              <div className="flex items-center justify-between mb-[12px] group">
                <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Особисті</span>
                <Button
                  size="icon"
                  style="ghost"
                  color="dark"
                  icon={Plus}
                  iconSize={14}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="flex flex-col gap-[2px]">
                {dms
                  .filter(u => u.name.toLowerCase().includes(chatSearch.toLowerCase()))
                  .map(u => (
                    <Button
                      key={u.id}
                      onClick={() => setActiveChannel({ id: u.id, type: 'dm' })}
                      style={isActive(u.id) ? 'secondary' : 'ghost'}
                      color="dark"
                      size="md"
                      className={`w-full justify-start px-[8px] py-[6px] h-auto gap-[8px] ${!isActive(u.id) ? 'text-[#9a9a9a] hover:text-[#1f1f1f]' : ''}`}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-[20px] h-[20px] rounded-full bg-white flex items-center justify-center overflow-hidden">
                          <UserAvatar user={{ name: u.name, avatar: u.avatar }} size={20} />
                        </div>
                        {u.online && (
                          <div className="absolute -bottom-[1px] -right-[1px] w-[6px] h-[6px] rounded-full border-2 border-[#f7f7f7] bg-[#10b981]" />
                        )}
                      </div>
                      <p className={`text-[13px] truncate flex-1 text-left ${u.isActive && !isActive(u.id) ? 'font-bold' : ''}`}>
                        {u.name}
                      </p>
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Chat Area - SINGLE GRAY ROUNDED CARD */}
        <div className="flex-1 bg-[#f7f7f7] rounded-[24px] flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="h-[56px] flex items-center justify-between px-[32px] shrink-0">
            <div className="flex items-center gap-[12px]">
              {activeChannel.type === 'channel' ? (
                <Hash size={18} className="text-[#1f1f1f]" />
              ) : (
                <div className="w-[32px] h-[32px] rounded-full overflow-hidden">
                  <UserAvatar user={{ name: dms.find(d => d.id === activeChannel.id)?.name || 'User', avatar: dms.find(d => d.id === activeChannel.id)?.avatar }} size={32} />
                </div>
              )}
              <div>
                <h3 className="font-bold text-[#1f1f1f] text-[15px]">
                  {activeChannel.type === 'channel'
                    ? (channels.find(c => c.id === activeChannel.id)?.name || activeChannel.id)
                    : (dms.find(d => d.id === activeChannel.id)?.name || 'Особисті повідомлення')}
                </h3>
                {activeChannel.type === 'channel' && !editingDescription && (
                  <p className="text-[11px] text-[#9a9a9a]">Командне обговорення</p>
                )}
                {activeChannel.type === 'channel' && editingDescription && (
                  <div className="flex items-center gap-2 mt-[4px]">
                    <Input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Опис каналу..."
                      className="flex-1 text-[11px] h-auto py-[2px]"
                    />
                    <Button
                      onClick={handleUpdateChannelDescription}
                      style="primary"
                      color="dark"
                      size="sm"
                      className="text-[10px] px-[8px] py-[2px] h-auto"
                    >
                      OK
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => activeChannel.type === 'channel' && setEditingDescription(!editingDescription)}
              style="ghost"
              color="dark"
              size="icon"
              icon={Info}
              iconSize={18}
              title={activeChannel.type === 'channel' ? 'Інформація про канал' : ''}
              className="text-[#9a9a9a] hover:text-[#1f1f1f]"
            />
          </div>

          {/* Messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col px-[32px] py-[16px]">
            {loading && messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <MessageSquare size={40} className="mb-4 text-[#9a9a9a] opacity-40" />
                <p className="text-[15px] font-medium text-[#9a9a9a]">Тут поки що немає повідомлень</p>
                <p className="text-[13px] text-[#9a9a9a] mt-1">Почніть розмову першим! 👋</p>
              </div>
            ) : (() => {
              const displayMessages = chatSearch.trim() ? messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase())) : messages;
              return displayMessages.map((msg) => {
                const msgIndex = messages.findIndex(m => m.id === msg.id);
                const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
                const showHeader = !prevMsg || prevMsg.senderId !== msg.senderId || msg.isSystem || prevMsg.isSystem || (msg.createdAt?.toMillis() - prevMsg.createdAt?.toMillis() > 300000);
                const showDateSeparator = prevMsg && msg.createdAt && prevMsg.createdAt &&
                  new Date(msg.createdAt.toDate()).toDateString() !== new Date(prevMsg.createdAt.toDate()).toDateString();
                const msgDate = msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleDateString('uk-UA', { weekday: 'long', month: 'short', day: 'numeric' }) : '';

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex items-center gap-2 my-[16px]">
                        <div className="flex-1 h-px bg-[#e9e9e9]" />
                        <span className="text-[11px] font-bold text-[#9a9a9a]">{msgDate}</span>
                        <div className="flex-1 h-px bg-[#e9e9e9]" />
                      </div>
                    )}

                    {msg.isSystem ? (
                      <div className="flex justify-center my-[16px]">
                        <span className="text-[12px] text-[#9a9a9a] bg-[#f7f7f7] px-[12px] py-[4px] rounded-full">
                          {msg.text}
                        </span>
                      </div>
                    ) : (
                      <div className={`relative flex gap-[12px] group px-[12px] py-[4px] hover:bg-[#f5f5f5] -mx-[12px] transition-colors ${!showHeader ? 'mt-[0px]' : 'mt-[8px]'}`}>
                        {showHeader ? (
                          <div className="w-[40px] h-[40px] rounded-[8px] shrink-0 overflow-hidden">
                            <UserAvatar user={{ name: msg.user, avatar: msg.avatar }} size={40} />
                          </div>
                        ) : (
                          <div className="w-[40px] shrink-0 text-right text-[10px] text-[#9a9a9a] opacity-0 group-hover:opacity-100 flex items-center justify-end">
                            {msg.time}
                          </div>
                        )}

                        <div className="flex flex-col min-w-0 flex-1">
                          {showHeader && (
                            <div className="flex items-baseline gap-[8px] mb-[2px]">
                              <span className="font-bold text-[#1f1f1f] text-[15px]">{msg.user}</span>
                              <span className="text-[11px] text-[#9a9a9a]">{msg.time}</span>
                            </div>
                          )}

                          {editingMsgId === msg.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editMsgText}
                                onChange={e => setEditMsgText(e.target.value)}
                                className="w-full bg-[#f7f7f7] border border-[#1f1f1f] rounded-[10px] p-2 text-[14px] outline-none"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button onClick={() => setEditingMsgId(null)} style="secondary" color="dark" size="sm">Скасувати</Button>
                                <Button onClick={() => { editMessage(msg.id, editMsgText); setEditingMsgId(null); }} disabled={!editMsgText.trim()} style="primary" color="dark" size="sm">Зберегти</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[#333333] text-[15px] leading-[1.46]">
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
                                  <Button
                                    key={emoji}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    style={hasReacted ? 'secondary' : 'ghost'}
                                    color="dark"
                                    size="sm"
                                    className={`px-[6px] py-[2px] h-auto text-[11px] ${hasReacted ? 'bg-[#eef2ff] border-[#6366f1]/30 text-[#4f46e5]' : 'text-[#4a4a4a]'}`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="font-bold">{users.length}</span>
                                  </Button>
                                );
                              })}
                            </div>
                          )}

                          {msg.replyCount > 0 && (
                            <div className="mt-1">
                              <Button onClick={() => openThread(msg.id)} style="ghost" color="dark" size="sm" icon={MessageSquare} iconSize={11} className="text-[12px] text-[#6366f1] hover:text-[#6366f1] px-2 py-[3px] h-auto">
                                {msg.replyCount} {msg.replyCount === 1 ? 'відповідь' : msg.replyCount > 1 && msg.replyCount < 5 ? 'відповіді' : 'відповідей'}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Hover actions */}
                        <div className="absolute right-[32px] bottom-[calc(100%_+_8px)] opacity-0 group-hover:opacity-100 bg-white border border-[#e9e9e9] rounded-[6px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex items-center p-[2px] transition-opacity z-10">
                          <Button onClick={() => setReactingMsgId(reactingMsgId === msg.id ? null : msg.id)} style="ghost" color="dark" size="icon" icon={Smile} iconSize={16} className="p-[6px] text-[#616061] hover:text-[#1f1f1f] h-[28px] w-[28px]" />
                          <Button onClick={() => openThread(msg.id)} style="ghost" color="dark" size="icon" icon={MessageSquare} iconSize={16} className="p-[6px] text-[#616061] hover:text-[#1f1f1f] h-[28px] w-[28px]" />
                          <Button onClick={() => { if(!msg.isPinned) { updateDoc(doc(db, 'organizations', activeOrgId, 'channels', getRoomId(), 'messages', msg.id), { isPinned: true }); } else { updateDoc(doc(db, 'organizations', activeOrgId, 'channels', getRoomId(), 'messages', msg.id), { isPinned: false }); } }} style={msg.isPinned ? 'secondary' : 'ghost'} color="dark" size="icon" icon={Pin} iconSize={16} className={`p-[6px] h-[28px] w-[28px] ${msg.isPinned ? 'text-[#6366f1] bg-[#eef2ff]' : 'text-[#616061] hover:text-[#1f1f1f]'}`} />
                          {msg.senderId === myUid && (
                            <>
                              <Button onClick={() => { setEditingMsgId(msg.id); setEditMsgText(msg.text); }} style="ghost" color="dark" size="icon" icon={Edit2} iconSize={16} className="p-[6px] text-[#616061] hover:text-[#1f1f1f] h-[28px] w-[28px]" />
                              <Button onClick={() => { if(confirm('Ви впевнені, що хочете видалити це повідомлення?')) deleteMessage(msg.id); }} style="ghost" color="dark" size="icon" icon={Trash2} iconSize={16} className="p-[6px] text-[#616061] hover:text-[#ef4444] h-[28px] w-[28px]" />
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
              <div className="flex items-center gap-2 mt-2">
                <LoadingSpinner size="xs" />
                <span className="text-[12px] text-[#9a9a9a] italic">
                  {activeChannelData.typing.filter(uid => uid !== myUid).map(uid => members.find(m => (m.id || m.uid) === uid)?.name || 'Хтось').join(', ')} друкує...
                </span>
              </div>
            )}

            {unreadWhileScrolled > 0 && isScrolledUp && (
              <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-20">
                <Button
                  onClick={() => {
                    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
                  }}
                  style="primary"
                  color="dark"
                  size="md"
                  icon={ChevronDown}
                  iconSize={16}
                  className="rounded-full shadow-lg hover:scale-105 active:scale-95"
                >
                  <span className="text-[12px] font-bold">{unreadWhileScrolled} нових</span>
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* Input Area */}
          <div className="p-[16px] shrink-0 bg-[#f7f7f7] relative">
            
            {/* Mentions Dropdown */}
            {mentionType && (
              <Card className="absolute bottom-full left-[16px] mb-2 bg-white shadow-xl overflow-hidden w-[260px] max-h-[200px] overflow-y-auto z-30">
                {mentionType === 'user' && members.filter(m => (m.name || m.email).toLowerCase().includes(mentionQuery)).map(m => (
                  <Button
                    key={m.id || m.uid}
                    onClick={() => {
                      const newText = messageText.slice(0, mentionCursor - mentionQuery.length - 1) + `@${m.name || m.email} ` + messageText.slice(mentionCursor);
                      setMessageText(newText);
                      setMentionType(null);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    style="ghost"
                    color="dark"
                    size="md"
                    className="w-full justify-start px-[8px] py-[8px] h-auto gap-2 border-0 border-b border-b-[#f0f0f0] last:border-b-0 rounded-none"
                  >
                    <UserAvatar user={{ name: m.name, avatar: m.avatar }} size={24} />
                    <span className="text-[13px] font-medium text-[#1f1f1f] truncate">{m.name || m.email}</span>
                  </Button>
                ))}
                {mentionType === 'user' && members.filter(m => (m.name || m.email).toLowerCase().includes(mentionQuery)).length === 0 && (
                  <div className="p-3 text-[12px] text-[#9a9a9a] text-center">Не знайдено</div>
                )}

                {mentionType === 'issue' && (
                  <div className="p-3 text-[12px] text-[#9a9a9a] text-center">Задачі в розробці...</div>
                )}
              </Card>
            )}

            <Card className="bg-white overflow-visible flex flex-col">
              {attachments.length > 0 && (
                <div className="px-[12px] pt-[8px] flex flex-wrap gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative inline-block">
                      {att.type.startsWith('image/') ? (
                        <img src={att.url} alt="attachment" className="h-[60px] rounded-[6px] object-cover border border-[#e9e9e9]" />
                      ) : (
                        <div className="h-[60px] px-4 flex items-center bg-white rounded-[6px] border border-[#e9e9e9] text-[12px] font-medium text-[#1f1f1f]">
                          📎 {att.name}
                        </div>
                      )}
                      <Button
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        style="ghost"
                        color="dark"
                        size="icon"
                        className="absolute -top-2 -right-2 p-1 h-[20px] w-[20px] text-red-500 hover:bg-red-50 border border-[#e9e9e9]"
                        icon={X}
                        iconSize={12}
                      />
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                placeholder="Напишіть повідомлення..."
                value={messageText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                className="w-full max-h-[250px] min-h-[44px] p-[12px] px-[16px] resize-none outline-none text-[15px] text-[#1f1f1f] placeholder-[#9a9a9a] bg-transparent"
                rows={1}
              />
              <div className="flex items-center justify-between px-[12px] py-[8px] border-t border-[#ebebeb]">
                <div className="flex items-center gap-[4px]">
                  <Button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={showEmojiPicker ? 'secondary' : 'ghost'} color="dark" size="icon" icon={Smile} iconSize={18} className="p-[6px] h-[32px] w-[32px]" />
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} style="ghost" color="dark" size="icon" icon={Paperclip} iconSize={18} className="p-[6px] h-[32px] w-[32px] text-[#9a9a9a] hover:text-[#1f1f1f]" />
                </div>
                <Button
                  onClick={handleSend}
                  disabled={(!messageText.trim() && attachments.length === 0) || loading || uploading}
                  loading={uploading}
                  style={messageText.trim() || attachments.length > 0 ? 'primary' : 'secondary'}
                  color="dark"
                  size="md"
                  icon={Send}
                  iconSize={15}
                  className={`p-[6px] px-[10px] rounded-[10px] ${!messageText.trim() && attachments.length === 0 ? 'text-[#cfcfcf]' : ''}`}
                >
                  {(messageText.trim() || attachments.length > 0) && <span className="text-[13px] font-bold">Надіслати</span>}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Emoji Picker (For Message Input) */}
      {showEmojiPicker && (
        <div className="absolute bottom-[120px] left-[340px] z-20 shadow-xl rounded-[8px] overflow-hidden">
          <EmojiPicker 
            onEmojiClick={(emojiData) => {
              setMessageText(prev => prev + emojiData.emoji);
              setShowEmojiPicker(false);
            }} 
            autoFocusSearch={false}
            searchDisabled
            skinTonesDisabled
            width={300}
            height={350}
          />
        </div>
      )}

      {/* Reaction Emoji Picker */}
      {reactingMsgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10" onClick={() => setReactingMsgId(null)}>
          <div onClick={e => e.stopPropagation()} className="shadow-2xl rounded-[8px] overflow-hidden">
            <EmojiPicker 
              onEmojiClick={(emojiData) => {
                toggleReaction(reactingMsgId, emojiData.emoji);
                setReactingMsgId(null);
              }}
              autoFocusSearch={false}
              skinTonesDisabled
              width={320}
              height={400}
            />
          </div>
        </div>
      )}


      {/* Universal Right Sidebar (Thread or Channel Info) */}
      {(showChannelInfo || activeThreadId) && (
        <div className="fixed right-[12px] top-[56px] bottom-[12px] w-[340px] bg-[#f7f7f7] rounded-[24px] overflow-hidden z-40 flex flex-col shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-transparent">
          
          {/* Header */}
          <div className="h-[56px] px-[20px] shrink-0 border-b border-[#e9e9e9] flex items-center justify-between bg-white">
            <div className="flex items-center gap-2 min-w-0">
              {activeThreadId ? (
                <>
                  <h2 className="text-[15px] font-bold text-[#1f1f1f] truncate">Гілка</h2>
                  <span className="text-[12px] text-[#9a9a9a] truncate">#{currentChannel?.name || 'DM'}</span>
                </>
              ) : (
                <>
                  <Hash size={18} className="text-[#1f1f1f] shrink-0" />
                  <h2 className="text-[15px] font-bold text-[#1f1f1f] truncate">Деталі каналу</h2>
                </>
              )}
            </div>
            <Button
              onClick={() => {
                setShowChannelInfo(false);
                closeThread();
              }}
              style="ghost"
              color="dark"
              size="icon"
              icon={X}
              iconSize={18}
              className="p-[6px] h-[32px] w-[32px] text-[#9a9a9a] hover:text-[#1f1f1f]"
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeThreadId && activeThreadParent ? (
              // ─── THREAD VIEW ─────────────────────────
              <div className="flex-1 flex flex-col overflow-hidden">
                <div ref={threadScrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-[20px] py-[16px] flex flex-col gap-[16px]">
                  
                  {/* Original Message */}
                  <div className="flex gap-[12px]">
                    <div className="w-[36px] h-[36px] rounded-[8px] shrink-0 overflow-hidden">
                      <UserAvatar user={{ name: activeThreadParent.user, avatar: activeThreadParent.avatar }} size={36} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-baseline gap-[8px] mb-[2px]">
                        <span className="font-bold text-[#1f1f1f] text-[14px]">{activeThreadParent.user}</span>
                        <span className="text-[10px] text-[#9a9a9a]">{activeThreadParent.time}</span>
                      </div>
                      <div className="text-[#333333] text-[14px] leading-[1.46]">
                        <MessageContent text={activeThreadParent.text} members={members} />
                        {activeThreadParent.attachments && activeThreadParent.attachments.length > 0 && (
                          <div className="mt-2 flex flex-col gap-2">
                            {activeThreadParent.attachments.map((att, i) => (
                              <div key={i} className="max-w-[260px]">
                                {att.type?.startsWith('image/') ? (
                                  <a href={att.url} target="_blank" rel="noopener">
                                    <img src={att.url} alt={att.name} className="rounded-[8px] border border-[#e9e9e9] max-h-[150px] object-cover hover:opacity-90 transition-opacity" />
                                  </a>
                                ) : (
                                  <a href={att.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-2 rounded-[8px] border border-[#e9e9e9] bg-[#f7f7f7] hover:bg-[#f0f0f0] transition-colors">
                                    <Paperclip size={14} className="text-[#9a9a9a] shrink-0" />
                                    <span className="text-[12px] font-medium text-[#1f1f1f] truncate flex-1">{att.name}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 my-[8px]">
                    <span className="text-[11px] font-bold text-[#9a9a9a]">{threadMessages.length} відповідей</span>
                    <div className="flex-1 h-px bg-[#e9e9e9]" />
                  </div>

                  {/* Replies */}
                  {threadMessages.map(reply => (
                    <div key={reply.id} className="flex gap-[12px] group relative">
                      <div className="w-[36px] h-[36px] rounded-[8px] shrink-0 overflow-hidden">
                        <UserAvatar user={{ name: reply.user, avatar: reply.avatar }} size={36} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-baseline gap-[8px] mb-[2px]">
                          <span className="font-bold text-[#1f1f1f] text-[14px]">{reply.user}</span>
                          <span className="text-[10px] text-[#9a9a9a]">{reply.time}</span>
                        </div>
                        <div className="text-[#333333] text-[14px] leading-[1.46]">
                          <MessageContent text={reply.text} members={members} />
                          {reply.attachments && reply.attachments.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                              {reply.attachments.map((att, i) => (
                                <div key={i} className="max-w-[260px]">
                                  {att.type?.startsWith('image/') ? (
                                    <a href={att.url} target="_blank" rel="noopener">
                                      <img src={att.url} alt={att.name} className="rounded-[8px] border border-[#e9e9e9] max-h-[150px] object-cover hover:opacity-90 transition-opacity" />
                                    </a>
                                  ) : (
                                    <a href={att.url} target="_blank" rel="noopener" className="flex items-center gap-2 p-2 rounded-[8px] border border-[#e9e9e9] bg-[#f7f7f7] hover:bg-[#f0f0f0] transition-colors">
                                      <Paperclip size={14} className="text-[#9a9a9a] shrink-0" />
                                      <span className="text-[12px] font-medium text-[#1f1f1f] truncate flex-1">{att.name}</span>
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {reply.senderId === myUid && (
                        <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 bg-white border border-[#e9e9e9] rounded-[6px] shadow-sm flex items-center p-[2px]">
                          <Button onClick={() => { if(confirm('Видалити відповідь?')) deleteReply(activeThreadId, reply.id); }} style="ghost" color="dark" size="icon" icon={Trash2} iconSize={14} className="p-[4px] h-[22px] w-[22px] text-[#616061] hover:text-[#ef4444]" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                </div>

                {/* Thread Input */}
                <div className="p-[16px] shrink-0 bg-white border-t border-[#e9e9e9]">
                  <Card className="bg-[#f7f7f7] overflow-hidden flex flex-col">
                    {threadAttachments.length > 0 && (
                       <div className="px-[12px] pt-[8px] flex flex-wrap gap-2">
                         {threadAttachments.map((att, idx) => (
                           <div key={idx} className="relative inline-block">
                             {att.type.startsWith('image/') ? (
                               <img src={att.url} alt="attachment" className="h-[40px] rounded-[6px] object-cover border border-[#e9e9e9]" />
                             ) : (
                               <div className="h-[40px] px-3 flex items-center bg-white rounded-[6px] border border-[#e9e9e9] text-[11px] font-medium text-[#1f1f1f]">
                                 📎 {att.name}
                               </div>
                             )}
                             <Button onClick={() => setThreadAttachments(prev => prev.filter((_, i) => i !== idx))} style="ghost" color="dark" size="icon" className="absolute -top-2 -right-2 p-1 h-[16px] w-[16px] text-red-500 hover:bg-red-50 border border-[#e9e9e9]" icon={X} iconSize={10} />
                           </div>
                         ))}
                       </div>
                    )}
                    <textarea
                      placeholder="Відповісти..."
                      value={threadText}
                      onChange={(e) => setThreadText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleThreadSend();
                        }
                      }}
                      className="w-full min-h-[44px] max-h-[150px] p-[10px] px-[12px] resize-none outline-none text-[14px] text-[#1f1f1f] placeholder-[#9a9a9a] bg-transparent custom-scrollbar"
                      rows={1}
                    />
                    <div className="flex items-center justify-between px-[8px] py-[6px] border-t border-[#ebebeb]">
                      <div className="flex items-center gap-[2px]">
                        <input
                          type="file"
                          multiple
                          ref={threadFileInputRef}
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (!files.length) return;
                            const newAtts = files.map(file => ({ file, url: URL.createObjectURL(file), type: file.type, name: file.name, size: file.size }));
                            setThreadAttachments(prev => [...prev, ...newAtts]);
                            if (threadFileInputRef.current) threadFileInputRef.current.value = '';
                          }}
                          className="hidden"
                        />
                        <Button onClick={() => threadFileInputRef.current?.click()} disabled={threadUploading} style="ghost" color="dark" size="icon" icon={Paperclip} iconSize={16} className="p-[6px] h-[28px] w-[28px] text-[#9a9a9a] hover:text-[#1f1f1f]" />
                      </div>
                      <Button
                        onClick={handleThreadSend}
                        disabled={(!threadText.trim() && threadAttachments.length === 0) || threadUploading}
                        loading={threadUploading}
                        style={threadText.trim() || threadAttachments.length > 0 ? 'primary' : 'secondary'}
                        color="dark"
                        size="icon"
                        icon={Send}
                        iconSize={14}
                        className="p-[6px] h-[28px] w-[28px]"
                      />
                    </div>
                  </Card>
                </div>
              </div>
            ) : showChannelInfo && currentChannel ? (
              // ─── CHANNEL INFO VIEW ─────────────────────────
              <div className="flex-1 overflow-y-auto custom-scrollbar px-[20px] py-[20px] flex flex-col gap-[24px]">
                <div>
                  <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase mb-[8px]">Опис</h3>
                  <Card className="bg-white p-[12px]">
                    <p className="text-[13px] text-[#1f1f1f]">
                      {currentChannel.description || 'Немає опису. Натисніть "i" у заголовку каналу, щоб додати.'}
                    </p>
                  </Card>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase mb-[8px]">Закріплені ({messages.filter(m => m.isPinned).length})</h3>
                  <div className="flex flex-col gap-[8px]">
                    {messages.filter(m => m.isPinned).length === 0 ? (
                      <p className="text-[12px] text-[#9a9a9a]">Немає закріплених повідомлень.</p>
                    ) : (
                      messages.filter(m => m.isPinned).map(m => (
                        <Card key={m.id} className="bg-white p-[10px] flex flex-col gap-[4px] cursor-pointer hover:border-[#cfcfcf] transition-colors" onClick={() => {
                          // Could scroll to message
                        }}>
                          <div className="flex items-center gap-[6px]">
                            <UserAvatar user={{ name: m.user, avatar: m.avatar }} size={16} />
                            <span className="text-[12px] font-bold text-[#1f1f1f]">{m.user}</span>
                          </div>
                          <p className="text-[12px] text-[#333333] line-clamp-2">
                            {m.text || 'Долучено файл'}
                          </p>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase mb-[8px]">Учасники команди ({members.length})</h3>
                  <Card className="bg-white overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col">
                      {members.map(m => (
                        <div key={m.id || m.uid} className="flex items-center gap-[10px] p-[10px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#f7f7f7] transition-colors">
                          <div className="w-[28px] h-[28px] rounded-full overflow-hidden shrink-0">
                            <UserAvatar user={{ name: m.name, avatar: m.avatar }} size={28} />
                          </div>
                          <span className="text-[13px] font-medium text-[#1f1f1f] truncate">{m.name || m.email}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
