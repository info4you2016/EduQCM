import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, X, Hash, MessageCircleWarning, Users, 
  MessageSquareMore, LogIn, ChevronDown, Sparkles, Volume2, VolumeX,
  Search, Info, UserCircle, Smile, ArrowDown, Shield, GraduationCap, MonitorPlay,
  Pin, Trash2, Edit3, MoreVertical, Copy, Check, Paperclip, ExternalLink, Code2, Link, FileText, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api, socket } from '../lib/api';
import { ChatMessage, UserProfile, Group, ChatReaction } from '../types';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { useConfirm } from './ui/ConfirmDialog';

interface ChatWidgetProps {
  user: UserProfile;
}

type ChannelType = 'general' | 'teachers' | 'group';

const PRESET_EMOJIS = ['👍', '❤️', '💡', '👏', '🎯', '🤔'];

const CODE_TEMPLATES = [
  { label: "Algorithme (Python)", filename: "recherche_index.py", code: "def search_target(arr, target):\n    low, high = 0, len(arr) - 1\n    while low <= high:\n        mid = (low + high) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            low = mid + 1\n        else:\n            high = mid - 1\n    return -1" },
  { label: "Base de Données (SQL)", filename: "extraction_etape.sql", code: "SELECT u.displayName, g.name AS groupName \nFROM users u \nINNER JOIN groups g ON u.groupId = g.id \nWHERE u.role = 'student'\nORDER BY u.displayName ASC;" },
  { label: "Composant Réutilisable (React)", filename: "ButtonAccent.tsx", code: "import React from 'react';\n\nexport const ButtonAccent = ({ label, onClick }) => {\n  return (\n    <button \n      onClick={onClick}\n      className=\"px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md\"\n    >\n      {label}\n    </button>\n  );\n};" }
];

export const ChatWidget: React.FC<ChatWidgetProps> = ({ user }) => {
  const confirm = useConfirm();
  const isExamActive = useAppStore(state => state.view === 'exam');
  const isStudent = user.role === 'student';
  const isChatDisabled = isExamActive && isStudent;

  const [isOpen, setIsOpen] = useState(false);

  // Close the chat automatically if exam starts
  useEffect(() => {
    if (isChatDisabled && isOpen) {
      setIsOpen(false);
    }
  }, [isChatDisabled, isOpen]);

  const [channelType, setChannelType] = useState<ChannelType>('general');
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(
    user.role === 'student' ? user.groupId : undefined
  );
  const [groups, setGroups] = useState<Group[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Search filter
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Floating scroll/new messages notifications
  const [showScrollDown, setShowScrollDown] = useState(false);

  // Typing status states
  const [typingUsers, setTypingUsers] = useState<{ userId: number; userName: string }[]>([]);
  const [isLocalTyping, setIsLocalTyping] = useState(false);

  // Reaction/Toolbar hover message track
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);

  // Edit states
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Clipboard copies
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  // Pinned message screen mode
  const [showPinsOnly, setShowPinsOnly] = useState(false);

  // Rich attachments states
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [attachmentView, setAttachmentView] = useState<'none' | 'code' | 'link'>('none');
  const [attachCodeTitle, setAttachCodeTitle] = useState('');
  const [attachCodeText, setAttachCodeText] = useState('');
  const [attachLinkTitle, setAttachLinkTitle] = useState('');
  const [attachLinkUrl, setAttachLinkUrl] = useState('');

  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [showOnlineList, setShowOnlineList] = useState(false);

  // Sync online users from the backend & socket
  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const fetchOnline = () => {
      api.admin.getOnlineUsers()
        .then((data: any) => {
          if (active) {
            setOnlineUsers(data || []);
          }
        })
        .catch(err => console.error("Could not fetch online users:", err));
    };

    fetchOnline();
    
    // Broadcast status ping 
    socket.emit("chat:ping-status", { user });

    const handleOnlineUpdate = (users: any[]) => {
      if (active) {
        setOnlineUsers(users || []);
      }
    };

    socket.on("chat:online-users:update", handleOnlineUpdate);

    // Refresh every 12 seconds
    const interval = setInterval(fetchOnline, 12000);

    return () => {
      active = false;
      socket.off("chat:online-users:update", handleOnlineUpdate);
      clearInterval(interval);
    };
  }, [isOpen, user]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeChatChannelRef = useRef<string>('general');

  // Trigger audio sound chime on received message/reactions safely
  const playPing = () => {
    if (muted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.debug("Chime audio prevented:", e);
    }
  };

  // Fetch classes categories for teach mode selectors
  useEffect(() => {
    if (isOpen && (user.role === 'teacher' || user.role === 'admin')) {
      api.groups.list()
        .then((data: any) => {
          setGroups(data || []);
          if (data && data.length > 0 && selectedGroupId === undefined) {
            setSelectedGroupId(data[0].id);
          }
        })
        .catch(err => console.error("Chat categories fetch failed:", err));
    }
  }, [isOpen, user.role]);

  // Track active channel state for background notifications
  useEffect(() => {
    activeChatChannelRef.current = channelType;
  }, [channelType]);

  // Load backend message thread history
  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    api.chat.getMessages(channelType, selectedGroupId)
      .then((data: any) => {
        setMessages(data || []);
        scrollIntervalRef.current = true;
      })
      .catch(err => console.error("Failed loading chat messages:", err))
      .finally(() => setLoading(false));

    // For teacher select classes
    if (channelType === 'group' && selectedGroupId) {
      socket.emit("chat:join-group", { groupId: selectedGroupId });
    }

    // Reset filtering query
    setSearchQuery('');
    setTypingUsers([]);
    setEditingMessageId(null);
    setAttachmentView('none');
    setAttachmentMenuOpen(false);
    setShowPinsOnly(false);
  }, [isOpen, channelType, selectedGroupId]);

  // Listen for socket events incl. new premium edits & pins updates
  useEffect(() => {
    const handleIncomingMessage = (msg: ChatMessage) => {
      const isTargetChannel = msg.channelType === channelType;
      const isTargetGroup = channelType === 'group' ? msg.groupId === selectedGroupId : true;

      if (isTargetChannel && isTargetGroup) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollIntervalRef.current = true;
        
        if (msg.senderId !== user.id) {
          playPing();
        }
      } else {
        if (msg.senderId !== user.id) {
          setUnreadCount(prev => prev + 1);
          playPing();
        }
      }
    };

    const handleTypingPulse = (data: { channelType: string; groupId?: number; isTyping: boolean; userId: number; userName: string }) => {
      const isTargetChannel = data.channelType === channelType;
      const isTargetGroup = channelType === 'group' ? data.groupId === selectedGroupId : true;

      if (isTargetChannel && isTargetGroup && data.userId !== user.id) {
        setTypingUsers(prev => {
          const filtered = prev.filter(t => t.userId !== data.userId);
          if (data.isTyping) {
            return [...filtered, { userId: data.userId, userName: data.userName }];
          }
          return filtered;
        });
      }
    };

    const handleReactionPulse = (data: { messageId: number; reactions: ChatReaction[] }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          return { ...m, reactions: data.reactions };
        }
        return m;
      }));
    };

    const handleMessageEdited = (data: { id: number; content: string; isEdited: number }) => {
      setMessages(prev => prev.map(m => m.id === data.id ? { ...m, content: data.content, isEdited: data.isEdited } : m));
    };

    const handleMessageDeleted = (data: { id: number }) => {
      setMessages(prev => prev.filter(m => m.id !== data.id));
    };

    const handleMessagePinnedUpdated = (data: { id: number; isPinned: number }) => {
      setMessages(prev => {
        const updated = prev.map(m => m.id === data.id ? { ...m, isPinned: data.isPinned } : m);
        const targetMsg = prev.find(m => m.id === data.id);
        if (data.isPinned && targetMsg && !targetMsg.isPinned) {
          playPing();
          toast.success("Message épinglé au sommet du salon !");
        }
        return updated;
      });
    };

    socket.on("chat:message:received", handleIncomingMessage);
    socket.on("chat:typing:update", handleTypingPulse);
    socket.on("chat:reaction:updated", handleReactionPulse);
    socket.on("chat:message:edited", handleMessageEdited);
    socket.on("chat:message:deleted", handleMessageDeleted);
    socket.on("chat:message:pinned:updated", handleMessagePinnedUpdated);

    return () => {
      socket.off("chat:message:received", handleIncomingMessage);
      socket.off("chat:typing:update", handleTypingPulse);
      socket.off("chat:reaction:updated", handleReactionPulse);
      socket.off("chat:message:edited", handleMessageEdited);
      socket.off("chat:message:deleted", handleMessageDeleted);
      socket.off("chat:message:pinned:updated", handleMessagePinnedUpdated);
    };
  }, [channelType, selectedGroupId, user.id, muted]);

  // Clear notifications on widget visible
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Auto scroll triggers
  useEffect(() => {
    if (scrollIntervalRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      scrollIntervalRef.current = false;
    }
  }, [messages, loading]);

  // Handle typing debounce state sends
  const handleInputChange = (text: string) => {
    setNewMessage(text);

    if (!isLocalTyping) {
      setIsLocalTyping(true);
      socket.emit("chat:typing:status", {
        channelType,
        groupId: channelType === 'group' ? selectedGroupId : undefined,
        isTyping: true,
        userId: user.id,
        userName: user.displayName
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsLocalTyping(false);
      socket.emit("chat:typing:status", {
        channelType,
        groupId: channelType === 'group' ? selectedGroupId : undefined,
        isTyping: false,
        userId: user.id,
        userName: user.displayName
      });
    }, 1800);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      setIsLocalTyping(false);
    }

    // Stop typing indicator on send
    socket.emit("chat:typing:status", {
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      isTyping: false,
      userId: user.id,
      userName: user.displayName
    });

    const payload = {
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      content: newMessage.trim(),
      senderId: user.id,
      senderName: user.displayName,
      senderRole: user.role
    };

    socket.emit("chat:message:send", payload);
    setNewMessage('');
    scrollIntervalRef.current = true;
  };

  // Toggle reactions sockets directly
  const handleToggleReaction = (messageId: number, emoji: string) => {
    const payload = {
      messageId,
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      emoji,
      userId: user.id,
      userName: user.displayName
    };
    socket.emit("chat:reaction:toggle", payload);
    setHoveredMessageId(null);
  };

  // Inline Editing
  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
    setHoveredMessageId(null);
  };

  const handleSaveEdit = (messageId: number) => {
    if (!editingContent.trim()) return;
    socket.emit("chat:message:edit", {
      id: messageId,
      content: editingContent.trim(),
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      userId: user.id
    });
    setEditingMessageId(null);
    toast.success("Message modifié avec succès");
  };

  // Deletion logic
  const handleDeleteMessage = async (messageId: number) => {
    const ok = await confirm({
      title: "Supprimer le message",
      message: "Voulez-vous vraiment supprimer définitivement ce message ?",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      variant: "danger"
    });
    if (!ok) return;
    socket.emit("chat:message:delete", {
      id: messageId,
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      userId: user.id,
      userRole: user.role
    });
    setHoveredMessageId(null);
  };

  // Pinned toggle
  const handleTogglePin = (messageId: number, isCurrentlyPinned: boolean) => {
    socket.emit("chat:message:pin", {
      id: messageId,
      isPinned: !isCurrentlyPinned,
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      userRole: user.role
    });
    setHoveredMessageId(null);
  };

  // Rich Attachments submittals
  const handleSendCodeAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachCodeText.trim() || !attachCodeTitle.trim()) return;

    socket.emit("chat:message:send", {
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      content: attachCodeText.trim(),
      senderId: user.id,
      senderName: user.displayName,
      senderRole: user.role,
      attachmentUrl: null,
      attachmentName: attachCodeTitle.trim(),
      attachmentType: 'code'
    });

    setAttachCodeText('');
    setAttachCodeTitle('');
    setAttachmentView('none');
    setAttachmentMenuOpen(false);
    scrollIntervalRef.current = true;
    toast.success("Extrait de code partagé !");
  };

  const handleSendLinkAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachLinkUrl.trim() || !attachLinkTitle.trim()) return;

    let formattedUrl = attachLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    socket.emit("chat:message:send", {
      channelType,
      groupId: channelType === 'group' ? selectedGroupId : undefined,
      content: `Lien partagé : ${attachLinkTitle.trim()}`,
      senderId: user.id,
      senderName: user.displayName,
      senderRole: user.role,
      attachmentUrl: formattedUrl,
      attachmentName: attachLinkTitle.trim(),
      attachmentType: 'link'
    });

    setAttachLinkTitle('');
    setAttachLinkUrl('');
    setAttachmentView('none');
    setAttachmentMenuOpen(false);
    scrollIntervalRef.current = true;
    toast.success("Lien de ressource partagé !");
  };

  // Scroll position monitor inside custom div
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // Show scroll down toggle if scrolled up far enough
    setShowScrollDown(distanceToBottom > 240);
  };

  const forceScrollBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Jump to specific message in stream visually
  const jumpToMessage = (messageId: number) => {
    setShowPinsOnly(false);
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // briefly highlight the card
        el.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-indigo-500/50');
        }, 1500);
      }
    }, 150);
  };

  // Find dynamic details regarding group selections
  const activeGroupObj = groups.find(g => g.id === selectedGroupId);
  const activeGroupName = user.role === 'student' 
    ? (user.groupName || 'Mon Groupe') 
    : (activeGroupObj?.name || 'Groupe spécifié');

  // Filter messages array in-memory
  const filteredMessages = messages.filter(m => {
    // Apply pins-only mode if enabled
    if (showPinsOnly && m.isPinned !== 1) return false;

    // Apply standard query filter
    if (!searchQuery.trim()) return true;
    return m.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
           m.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (m.attachmentName && m.attachmentName.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const pinnedMessages = messages.filter(m => m.isPinned === 1);

  // Date parsing logic for dividers
  const formatDividerDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (d.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  // Helper code / links renderer in chat bubbles
  const renderMessageBubbleContent = (msg: ChatMessage) => {
    const text = msg.content;
    
    // Check if code block
    if (msg.attachmentType === 'code' || (text.startsWith('```') && text.endsWith('```'))) {
      const rawCode = text.startsWith('```') ? text.replace(/^```(\w+)?\n?/, '').replace(/```$/, '') : text;
      const isCopied = copiedMessageId === msg.id;

      return (
        <div className="mt-1 font-mono text-[10px] bg-slate-900 border border-slate-800 text-left rounded-xl overflow-hidden shadow-md max-w-[340px] sm:max-w-[380px] select-text">
          <div className="flex bg-slate-950 px-3 py-1.5 justify-between items-center border-b border-slate-800/80 select-none">
            <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-black flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              {msg.attachmentName || 'Correction_Ex.py'}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(rawCode);
                setCopiedMessageId(msg.id);
                toast.success("Code copié dans le presse-papiers !");
                setTimeout(() => setCopiedMessageId(null), 1800);
              }}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <pre className="p-3 overflow-x-auto whitespace-pre scrolling-touch leading-tight text-slate-100 bg-slate-900/40 font-mono">
            <code>{rawCode}</code>
          </pre>
        </div>
      );
    }

    // Check if Web Link
    if (msg.attachmentType === 'link' && msg.attachmentUrl) {
      return (
        <div className="space-y-1 text-left max-w-[340px] break-words">
          <p className="text-xs">{text}</p>
          <a 
            href={msg.attachmentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100/60 transition-all shadow-xs"
          >
            <div className="p-2 bg-indigo-600 rounded-lg text-white shrink-0 shadow-sm">
              <Link className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-800 truncate">{msg.attachmentName || "Ressource de cours"}</p>
              <p className="text-[9px] text-indigo-600 font-bold truncate flex items-center gap-1">
                {msg.attachmentUrl}
                <ExternalLink className="w-2.5 h-2.5 inline-block shrink-0" />
              </p>
            </div>
          </a>
        </div>
      );
    }

    // Normal paragraph text fallback with line preservation
    return <p className="whitespace-pre-wrap text-left break-words">{text}</p>;
  };

  if (isChatDisabled) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300 select-none",
          isOpen 
            ? "bg-slate-950 text-white shadow-slate-900/35 rotate-90" 
            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/35 border border-indigo-500/50"
        )}
        title="Salon Messagerie ExcellencePro"
      >
        <div className="relative">
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageSquare className="w-6 h-6" />
          )}

          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-3.5 -right-3.5 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500 text-[10px] font-black text-white items-center justify-center ring-2 ring-slate-50">
                {unreadCount}
              </span>
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.94 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-24 right-5 z-50 w-[94vw] sm:w-[500px] h-[670px] max-h-[82vh] bg-white rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header Banner */}
            <div className="bg-slate-950 text-white p-5 shrink-0 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest leading-none">Excellence Pro Chat</h3>
                  <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold leading-none flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Interactif • Temps réel
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowOnlineList(!showOnlineList);
                    if (showSearch) setShowSearch(false);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                    showOnlineList ? "bg-white/25 text-white" : "bg-white/10 text-white/70 hover:bg-white/25"
                  )}
                  title="Membres en ligne"
                >
                  <Users className="w-4 h-4" />
                  {onlineUsers.length > 0 && (
                    <span className="absolute -top-1 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSearch(!showSearch);
                    if (showOnlineList) setShowOnlineList(false);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                    showSearch ? "bg-white/25 text-white" : "bg-white/10 text-white/70 hover:bg-white/25"
                  )}
                  title="Rechercher des messages"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setMuted(!muted)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-all cursor-pointer"
                  title={muted ? "Activer le son" : "Désactiver le son"}
                >
                  {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Local Search Collapsible bar */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-900 px-4 py-2 border-b border-slate-800 shrink-0 overflow-hidden"
                >
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filtrer les messages du fil courant..."
                      className="w-full text-xs font-semibold placeholder-zinc-500 text-white bg-zinc-800 border border-zinc-700 rounded-xl pl-8 pr-8 py-2 outline-none focus:border-indigo-500"
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Tabs Selection */}
            <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-1 shrink-0 select-none">
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => { setChannelType('general'); }}
                  className={cn(
                    "flex-1 py-1.5 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl border text-center transition-all cursor-pointer leading-none",
                    channelType === 'general' 
                      ? "bg-white border-slate-200 text-slate-950 shadow-sm" 
                      : "bg-transparent border-transparent text-slate-500 hover:text-slate-800"
                  )}
                >
                  # Général
                </button>

                {(user.role === 'teacher' || user.role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => { setChannelType('teachers'); }}
                    className={cn(
                      "flex-1 py-1.5 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl border text-center transition-all cursor-pointer leading-none",
                      channelType === 'teachers' 
                        ? "bg-white border-slate-200 text-indigo-600 shadow-sm" 
                        : "bg-transparent border-transparent text-slate-500 hover:text-indigo-600"
                    )}
                  >
                    # Profs
                  </button>
                )}

                {(user.role === 'student' && user.groupId) ? (
                  <button
                    type="button"
                    onClick={() => { setChannelType('group'); setSelectedGroupId(user.groupId); }}
                    className={cn(
                      "flex-1 py-1.5 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl border text-center transition-all cursor-pointer leading-none",
                      channelType === 'group' 
                        ? "bg-white border-slate-200 text-emerald-600 shadow-sm" 
                        : "bg-transparent border-transparent text-slate-500 hover:text-emerald-600"
                    )}
                  >
                    🚀 {user.groupName || 'Groupe'}
                  </button>
                ) : (user.role !== 'student') ? (
                  <button
                    type="button"
                    onClick={() => { 
                      setChannelType('group'); 
                      if (groups.length > 0 && selectedGroupId === undefined) {
                        setSelectedGroupId(groups[0].id);
                      }
                    }}
                    className={cn(
                      "flex-1 py-1.5 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl border text-center transition-all cursor-pointer leading-none",
                      channelType === 'group' 
                        ? "bg-white border-slate-200 text-emerald-600 shadow-sm" 
                        : "bg-transparent border-transparent text-slate-500 hover:text-emerald-600"
                    )}
                  >
                    🏫 Groupes ({groups.length})
                  </button>
                ) : null}
              </div>
            </div>

            {/* Active Class Selection (Only for Staff on Group Channel) */}
            {channelType === 'group' && (user.role === 'teacher' || user.role === 'admin') && (
              <div className="bg-emerald-50/50 p-2.5 border-b border-emerald-100/70 flex flex-col gap-1.5 shrink-0 select-none">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest leading-none">
                    Filtrer par classe :
                  </span>
                  <span className="text-[10px] font-black text-emerald-800 bg-white border border-emerald-100 px-2 py-0.5 rounded-lg leading-none">
                    {activeGroupName}
                  </span>
                </div>
                
                {groups.length > 1 && (
                  <div className="relative">
                    <select
                      value={selectedGroupId || ''}
                      onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                      className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-emerald-300 transition-all appearance-none cursor-pointer"
                    >
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>
            )}

            {/* Pinned Messages Header Announcement Pill Bar */}
            {pinnedMessages.length > 0 && (
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-between shadow-xs shrink-0 select-none">
                <div className="flex items-center gap-2 text-amber-900">
                  <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider leading-none">
                    Épinglés au sommet ({pinnedMessages.length})
                  </span>
                </div>
                <button
                  onClick={() => setShowPinsOnly(!showPinsOnly)}
                  className="text-[9px] font-black uppercase tracking-wider px-2 py-1 bg-white border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100/80 transition-all cursor-pointer leading-none"
                >
                  {showPinsOnly ? "👁️ Tout voir" : "📌 Consulter"}
                </button>
              </div>
            )}

            {/* Simulated attachments selector workspace */}
            <AnimatePresence>
              {attachmentMenuOpen && attachmentView !== 'none' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-indigo-50/70 border-b border-indigo-100 p-4 shrink-0"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1">
                      {attachmentView === 'code' ? <Code2 className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                      {attachmentView === 'code' ? 'Partager un Extrait de Code' : 'Attacher une Ressource URL'}
                    </h5>
                    <button 
                      onClick={() => setAttachmentView('none')}
                      className="text-indigo-400 hover:text-indigo-700 font-bold text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {attachmentView === 'code' ? (
                    <form onSubmit={handleSendCodeAttachment} className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={attachCodeTitle}
                          onChange={(e) => setAttachCodeTitle(e.target.value)}
                          placeholder="Nom du fichier (ex: index.js)"
                          className="w-full text-xs font-semibold p-2 bg-white border border-indigo-100 rounded-lg focus:outline-none focus:border-indigo-400"
                        />
                        <select
                          onChange={(e) => {
                            const found = CODE_TEMPLATES.find(c => c.label === e.target.value);
                            if (found) {
                              setAttachCodeTitle(found.filename);
                              setAttachCodeText(found.code);
                            }
                          }}
                          className="text-xs font-bold text-slate-700 bg-white border border-indigo-100 rounded-lg px-2 outline-none cursor-pointer"
                        >
                          <option value="">-- Modèles Prédéfinis</option>
                          {CODE_TEMPLATES.map(t => (
                            <option key={t.label} value={t.label}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        required
                        value={attachCodeText}
                        onChange={(e) => setAttachCodeText(e.target.value)}
                        placeholder="Coller ou écrire votre correction ou votre exercice..."
                        className="w-full text-xs font-mono p-2.5 bg-slate-900 text-white rounded-lg focus:outline-none focus:border-indigo-400 h-28 resize-none"
                      />
                      
                      <button
                        type="submit"
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all"
                      >
                        Partager l'extrait
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleSendLinkAttachment} className="space-y-2">
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          required
                          value={attachLinkTitle}
                          onChange={(e) => setAttachLinkTitle(e.target.value)}
                          placeholder="Nom de la ressource (ex: Cours PDF Algorithmique)"
                          className="w-full text-xs font-semibold p-2 bg-white border border-indigo-100 rounded-lg focus:outline-none "
                        />
                        <input
                          type="text"
                          required
                          value={attachLinkUrl}
                          onChange={(e) => setAttachLinkUrl(e.target.value)}
                          placeholder="Saisir ou coller l'URL (ex: github.com/...)"
                          className="w-full text-xs font-semibold p-2 bg-white border border-indigo-100 rounded-lg focus:outline-none "
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all"
                      >
                        Lier la ressource
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Messages Body Container */}
            <div 
              onScroll={handleScroll}
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-5 bg-zinc-50/50 custom-scrollbar relative flex flex-col"
            >
              {loading ? (
                <div className="m-auto flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none">Chargement du fil...</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="m-auto text-center max-w-[300px] select-none">
                  <div className="w-12 h-12 bg-white border border-slate-100 rounded-[1.25rem] flex items-center justify-center mx-auto mb-3 shadow-sm">
                    {showPinsOnly ? <Pin className="w-6 h-6 text-amber-500 fill-amber-500" /> : <MessageSquareMore className="w-6 h-6 text-slate-400" />}
                  </div>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">
                    {showPinsOnly ? "Aucun message épinglé" : "Aucun message trouvé"}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    {showPinsOnly 
                      ? "Les formateurs n'ont pas encore épinglé d'annonces ou d'explications sur ce salon."
                      : searchQuery 
                        ? "Aucun résultat ne correspond à votre filtre de recherche de texte."
                        : `Soyez le premier à envoyer un message sur le salon ${channelType === 'general' ? '# Général' : channelType === 'teachers' ? '# Enseignants' : `# ${activeGroupName}`}.`}
                  </p>
                  {showPinsOnly && (
                    <button
                      onClick={() => setShowPinsOnly(false)}
                      className="mt-4 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-slate-950 transition-colors cursor-pointer"
                    >
                      Retour au fil standard
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMessages.map((m, idx) => {
                    const isOwn = m.senderId === user.id;
                    const initials = m.senderName.trim().slice(0, 2).toUpperCase() || '??';
                    const dateStr = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    // Insert Day Date Header Divider if the date changes
                    const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
                    const showDateHeader = !prevMsg || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                    // UI Role Color Badge Decoders
                    let badgeColor = "bg-slate-100 text-slate-600 border-slate-200/50";
                    let roleIcon = <GraduationCap className="w-2.5 h-2.5 shrink-0" />;
                    if (m.senderRole === 'admin') {
                      badgeColor = "bg-rose-50 text-rose-600 border-rose-100";
                      roleIcon = <Shield className="w-2.5 h-2.5 shrink-0" />;
                    } else if (m.senderRole === 'teacher') {
                      badgeColor = "bg-indigo-50 text-indigo-600 border-indigo-100";
                      roleIcon = <MonitorPlay className="w-2.5 h-2.5 shrink-0" />;
                    }

                    // Count and aggregate reactions neatly
                    const reactionsArray = m.reactions || [];
                    const emojiAggregated = reactionsArray.reduce((acc: Record<string, { count: number; users: string[]; hasReacted: boolean }>, curr) => {
                      if (!acc[curr.emoji]) {
                        acc[curr.emoji] = { count: 0, users: [], hasReacted: false };
                      }
                      acc[curr.emoji].count += 1;
                      acc[curr.emoji].users.push(curr.userName);
                      if (curr.userId === user.id) {
                        acc[curr.emoji].hasReacted = true;
                      }
                      return acc;
                    }, {} as Record<string, { count: number; users: string[]; hasReacted: boolean }>);

                    return (
                      <React.Fragment key={m.id}>
                        {showDateHeader && (
                          <div className="flex items-center justify-center my-4 py-2 select-none">
                            <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-100 rounded-full px-3 py-1 uppercase tracking-widest leading-none shadow-sm">
                              {formatDividerDate(m.createdAt)}
                            </span>
                          </div>
                        )}

                        <div 
                          id={`msg-${m.id}`}
                          className={cn(
                            "flex gap-3 max-w-[85%] relative group/message",
                            isOwn ? "self-end ml-auto flex-row-reverse text-right" : "self-start",
                            m.isPinned ? "bg-amber-50/40 p-2.5 rounded-2xl border border-amber-100/60" : ""
                          )}
                          onMouseEnter={() => setHoveredMessageId(m.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                        >
                          {/* Avatar icon */}
                          {!isOwn && (
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-slate-200 border border-slate-300 text-[10px] font-black text-slate-600 flex items-center justify-center select-none shadow-sm shadow-slate-100">
                              {initials}
                            </div>
                          )}

                          <div className="space-y-1 relative max-w-full">
                            {/* Meta Name & Role badge */}
                            <div className={cn("flex items-center gap-1.5 mb-0.5", isOwn ? "justify-end" : "justify-start text-left")}>
                              <span className="text-[10px] font-black text-slate-800 tracking-tight leading-none">
                                {isOwn ? "Vous" : m.senderName}
                              </span>
                              {!isOwn && (
                                <span className={cn("inline-flex items-center gap-1 text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 border rounded-full leading-none", badgeColor)}>
                                  {roleIcon}
                                  {m.senderRole === 'admin' ? 'Admin' : m.senderRole === 'teacher' ? 'Prof' : 'Élève'}
                                </span>
                              )}
                              {m.isPinned === 1 && (
                                <span className="text-[8px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <Pin className="w-2.5 h-2.5 fill-amber-500" /> Ping
                                </span>
                              )}
                            </div>

                            {/* Message content Speech Bubble / Normal or Inline editing */}
                            <div 
                              className={cn(
                                "p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm break-words relative transition-all",
                                isOwn 
                                  ? "bg-slate-950 text-white rounded-tr-xs border border-slate-900" 
                                  : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs",
                                m.isPinned ? "ring-2 ring-amber-300/60" : ""
                              )}
                            >
                              {editingMessageId === m.id ? (
                                <div className="space-y-2 text-left min-w-[210px] sm:min-w-[280px]">
                                  <textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className="w-full text-xs font-semibold p-2.5 bg-zinc-900 text-white rounded-xl border border-zinc-700 outline-none focus:border-indigo-400"
                                    rows={3}
                                  />
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      onClick={() => setEditingMessageId(null)}
                                      className="px-2.5 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-350 hover:text-white rounded-lg text-[9px] font-black uppercase transition-colors"
                                    >
                                      Annuler
                                    </button>
                                    <button
                                      onClick={() => handleSaveEdit(m.id)}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase transition-colors animate-pulse"
                                    >
                                      Modifier
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                renderMessageBubbleContent(m)
                              )}
                            </div>

                            {/* Aggregated Emojis Indicators line directly below bubble */}
                            {reactionsArray.length > 0 && (
                              <div className={cn("flex flex-wrap gap-1 mt-1 select-none", isOwn ? "justify-end" : "justify-start")}>
                                {(Object.entries(emojiAggregated) as [string, { count: number; users: string[]; hasReacted: boolean }][]).map(([emoji, details]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(m.id, emoji)}
                                    title={`Réagi par : ${details.users.join(', ')}`}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black border transition-all cursor-pointer scale-95",
                                      details.hasReacted 
                                        ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm"
                                        : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200"
                                    )}
                                  >
                                    <span>{emoji}</span>
                                    <span>{details.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Timestamp & modified tag line */}
                            <div className={cn("flex items-center gap-1.5 mt-0.5", isOwn ? "justify-end" : "justify-start")}>
                              <span className="text-[8px] font-mono text-slate-400 leading-none">
                                {dateStr}
                              </span>
                              {m.isEdited === 1 && (
                                <span className="text-[8px] text-zinc-400 italic font-medium leading-none">
                                  (modifié)
                                </span>
                              )}
                            </div>

                            {/* Floating rapid Emoji toolbar selector + premium actions key overlay on hover */}
                            <AnimatePresence>
                              {hoveredMessageId === m.id && editingMessageId !== m.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.85, y: isOwn ? -8 : -8 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.85 }}
                                  transition={{ duration: 0.12 }}
                                  className={cn(
                                    "absolute top-1/2 -translate-y-1/2 z-10 flex bg-white border border-slate-200 rounded-full px-2 py-1 shadow-lg gap-2 shrink-0 select-none items-center",
                                    isOwn ? "right-full mr-2" : "left-full ml-2"
                                  )}
                                >
                                  {/* Fast Reactions */}
                                  <div className="flex gap-1 pr-1.5 border-r border-slate-100">
                                    {PRESET_EMOJIS.map(emoji => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleToggleReaction(m.id, emoji)}
                                        className="hover:scale-130 active:scale-90 transition-transform text-xs p-1 cursor-pointer leading-none"
                                        title={`Réagir avec ${emoji}`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Custom Actions (Edit/Pin/Delete/Copy) */}
                                  <div className="flex gap-1.5 text-slate-400">
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(m.content);
                                        toast.success("Message copié dans le presse-papiers");
                                      }}
                                      className="p-1 hover:text-slate-800 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                      title="Copier le texte"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Edit if authors */}
                                    {isOwn && (
                                      <button
                                        onClick={() => handleStartEdit(m)}
                                        className="p-1 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                                        title="Modifier mon message"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Action to Pin for staff */}
                                    {(user.role === 'teacher' || user.role === 'admin') && (
                                      <button
                                        onClick={() => handleTogglePin(m.id, m.isPinned === 1)}
                                        className={cn(
                                          "p-1 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer",
                                          m.isPinned === 1 ? "text-amber-500 hover:text-amber-700" : "hover:text-amber-500 text-slate-400"
                                        )}
                                        title={m.isPinned === 1 ? "Désépingler l'annonce" : "Épingler le message"}
                                      >
                                        <Pin className={cn("w-3.5 h-3.5", m.isPinned === 1 ? "fill-amber-500" : "")} />
                                      </button>
                                    )}

                                    {/* Delete action */}
                                    {(isOwn || user.role === 'teacher' || user.role === 'admin') && (
                                      <button
                                        onClick={() => handleDeleteMessage(m.id)}
                                        className="p-1 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                        title="Supprimer définitivement"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Dynamic scroll down notification badge over standard text stream */}
              <AnimatePresence>
                {showScrollDown && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={forceScrollBottom}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-slate-950 transition-all cursor-pointer z-10"
                  >
                    <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                    Bas de page
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Real-time Bouncing Dots Typing Indicator line */}
              <AnimatePresence>
                {typingUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 italic mt-auto py-1.5 self-start select-none"
                  >
                    <div className="flex gap-1 items-center bg-white border border-slate-100 rounded-full px-3 py-1.5 shadow-xs">
                      <span className="font-bold text-slate-500 uppercase text-[8px] tracking-wider shrink-0 mr-1">
                        {typingUsers.map(u => u.userName).join(', ')} {typingUsers.length > 1 ? "écrivent" : "écrit"}
                      </span>
                      <span className="flex gap-1 py-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Submitting Message Form controls */}
            <div className="border-t border-slate-100 bg-white shrink-0 select-none shadow-inner flex flex-col">
              {/* Expand attachment select strip */}
              <AnimatePresence>
                {attachmentMenuOpen && attachmentView === 'none' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-slate-50 border-b border-indigo-100/50 p-2 flex gap-1.5 justify-center items-center select-none"
                  >
                    <button
                      onClick={() => setAttachmentView('code')}
                      className="px-3 py-1.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-700 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-indigo-100 hover:scale-105 transition-all cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      Partager du code
                    </button>
                    <button
                      onClick={() => setAttachmentView('link')}
                      className="px-3 py-1.5 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-700 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-emerald-100 hover:scale-105 transition-all cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Partager un lien url
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form 
                onSubmit={handleSendMessage}
                className="p-4 flex gap-2 items-center"
              >
                {/* Paperclip options toggler */}
                <button
                  type="button"
                  onClick={() => {
                    setAttachmentMenuOpen(!attachmentMenuOpen);
                    if (attachmentView !== 'none') {
                      setAttachmentView('none');
                    }
                  }}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shrink-0 border",
                    attachmentMenuOpen 
                      ? "bg-slate-950 text-white border-slate-900 shadow-md" 
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border-slate-200"
                  )}
                  title="Attacher un élément (Lien, Code)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={`Écrire dans ${channelType === 'general' ? '# général' : channelType === 'teachers' ? '# enseignants' : `# ${activeGroupName}`}...`}
                  className="flex-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-150 rounded-2xl px-4 py-3 outline-none focus:border-indigo-500 focus:bg-white transition-all custom-focus"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || loading}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-indigo-100 active:scale-95 shrink-0",
                    newMessage.trim() && !loading
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20" 
                      : "bg-slate-100 text-slate-350 cursor-not-allowed border border-slate-200"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Online Members Slide-Over Drawer */}
            <AnimatePresence>
              {showOnlineList && (
                <motion.div
                  initial={{ opacity: 0, x: 200 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 200 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="absolute left-0 right-0 bottom-0 top-[76px] bg-slate-900 z-40 flex flex-col overflow-hidden"
                >
                  {/* Drawer Header */}
                  <div className="p-4 border-b border-zinc-800 bg-slate-950 flex items-center justify-between shrink-0 select-none">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-zinc-100 tracking-wider">Membres Connectés</h4>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{onlineUsers.length} personne{onlineUsers.length > 1 ? 's' : ''} en ligne</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOnlineList(false)}
                      className="w-7 h-7 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 hover:text-white text-zinc-400 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Online Users List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar bg-slate-900/90">
                    {onlineUsers.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                          <Users className="w-5 h-5 text-zinc-500 animate-pulse" />
                        </div>
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-wide">Actualisation...</p>
                      </div>
                    ) : (
                      onlineUsers.map(u => {
                        const isYou = u.id === user.id;
                        const roleLabel = u.role === 'teacher' ? 'Formateur' : u.role === 'admin' ? 'Administrateur' : 'Étudiant';
                        const roleColorClass = u.role === 'teacher' 
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                          : u.role === 'admin' 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={u.id}
                            className="p-3 bg-zinc-800/40 border border-zinc-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:bg-zinc-800/80 transition-all duration-200"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative">
                                <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-black text-white shrink-0 uppercase tracking-tight select-none">
                                  {u.displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900 animate-pulse" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-zinc-100 truncate flex items-center gap-1.5 leading-none">
                                  {u.displayName}
                                  {isYou && (
                                    <span className="text-[8px] bg-indigo-500 text-white font-black uppercase px-1.5 py-0.5 rounded-md leading-none">Moi</span>
                                  )}
                                </p>
                                <p className="text-[10px] text-zinc-500 truncate leading-none mt-1 font-semibold">{u.email || 'Pas d\'email renseigné'}</p>
                              </div>
                            </div>

                            <span className={cn("text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg leading-none shrink-0", roleColorClass)}>
                              {roleLabel}
                            </span>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
