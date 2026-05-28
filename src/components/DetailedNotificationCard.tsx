import React, { useState } from 'react';
import { 
  Pin, AlertCircle, Calendar, MessageSquare, ThumbsUp, Heart, Sparkles, 
  Trash2, Send, Download, ExternalLink, Eye, ChevronDown, ChevronUp, UserCheck, ShieldAlert, BadgeInfo
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Notification, UserProfile, Group, Filiere } from '../types';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { api } from '../lib/api';

interface DetailedNotificationCardProps {
  notification: Notification;
  user: UserProfile;
  onRefresh: () => void;
  groups?: Group[];
  filieres?: Filiere[];
}

export const DetailedNotificationCard: React.FC<DetailedNotificationCardProps> = ({ 
  notification, 
  user,
  onRefresh,
  groups = [],
  filieres = []
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showReadersList, setShowReadersList] = useState(false);

  const isTeacher = user.role === 'teacher' || user.role === 'admin';
  const hasRead = notification.read;

  const reactions = notification.reactions || [];
  const comments = notification.comments || [];
  const readers = notification.readers || [];

  // Group reactions by type and count
  const reactionCounts = reactions.reduce((acc, curr) => {
    acc[curr.reactionType] = (acc[curr.reactionType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reactionEmojis: Record<string, string> = {
    thumbsup: "👍",
    heart: "❤️",
    clap: "👏",
    resolved: "✅"
  };

  const hasReacted = (type: string) => {
    return reactions.some(r => r.userId === user.id && r.reactionType === type);
  };

  const handleToggleReaction = async (reactionType: string) => {
    try {
      await api.notifications.react(notification.id, reactionType);
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    setIsSubmittingComment(true);
    try {
      await api.notifications.addComment(notification.id, commentContent);
      setCommentContent('');
      onRefresh();
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("Voulez-vous supprimer ce commentaire ?")) return;
    try {
      await api.notifications.deleteComment(commentId);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const handleTogglePin = async () => {
    try {
      await api.notifications.togglePin(notification.id);
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle pin state:", err);
    }
  };

  const getImportanceBadgeStyles = () => {
    switch (notification.importance) {
      case 'high':
        return 'bg-rose-50 border-rose-100 text-rose-700 font-extrabold ring-1 ring-rose-300 animate-pulse-short';
      case 'low':
        return 'bg-slate-100 border-slate-200 text-slate-600 font-bold';
      default:
        return 'bg-blue-50 border-blue-100 text-blue-700 font-bold';
    }
  };

  const getImportanceLabel = () => {
    switch (notification.importance) {
      case 'high':
        return 'Urgent';
      case 'low':
        return 'Information';
      default:
        return 'Important';
    }
  };

  const getScopeBadge = () => {
    if (notification.groupId) {
      const g = groups?.find(item => item.id === notification.groupId);
      return { label: g ? `Groupe: ${g.name}` : 'Groupe Spécifique', color: 'bg-emerald-50 border-emerald-100 text-emerald-700 font-extrabold' };
    }
    if (notification.filiereId) {
      const f = filieres?.find(item => item.id === notification.filiereId);
      return { label: f ? `Filière: ${f.name}` : 'Filière Spécifique', color: 'bg-indigo-50 border-indigo-100 text-indigo-700 font-extrabold' };
    }
    return { label: 'Globale', color: 'bg-slate-50 border-slate-100 text-slate-500 font-bold' };
  };

  const getAudienceRoleBadge = () => {
    switch (notification.audienceRole) {
      case 'students':
        return { label: 'Élèves uniquement', color: 'bg-teal-50 border-teal-100 text-teal-700 font-black' };
      case 'teachers':
        return { label: 'Formateurs uniquement', color: 'bg-amber-50 border-amber-100 text-amber-700 font-black' };
      default:
        return null;
    }
  };

  const scopeBadge = getScopeBadge();
  const audienceRoleBadge = getAudienceRoleBadge();

  return (
    <Card 
      id={`notif-card-${notification.id}`}
      className={cn(
        "p-6 border-2 transition-all relative overflow-hidden rounded-[2rem]",
        notification.isPinned ? "border-amber-200 bg-amber-50/5 shadow-md shadow-amber-50/10" : "border-slate-50 bg-white",
        !hasRead && "border-indigo-100 shadow-sm"
      )}
    >
      {/* Decorative colored line on top */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1.5",
        notification.isPinned ? "bg-amber-400" : notification.importance === 'high' ? "bg-rose-500" : "bg-indigo-600"
      )} />

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {notification.isPinned && (
            <span className="flex items-center gap-1 bg-amber-100 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[0.5rem] shadow-sm">
              <Pin className="w-3 h-3 text-amber-600 fill-amber-500" /> Épinglé
            </span>
          )}
          
          <span className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-[0.5rem]", getImportanceBadgeStyles())}>
            {getImportanceLabel()}
          </span>

          <span className="text-[9px] font-black uppercase tracking-widest bg-slate-50 border border-slate-100 text-slate-500 px-2.5 py-1 rounded-[0.5rem]">
            {notification.type === 'exam' ? 'Examen' : 'Annonce'}
          </span>

          <span className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-[0.5rem]", scopeBadge.color)}>
            {scopeBadge.label}
          </span>

          {audienceRoleBadge && (
            <span className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-[0.5rem]", audienceRoleBadge.color)}>
              {audienceRoleBadge.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {new Date(notification.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {isTeacher && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleTogglePin}
                className={cn("w-8 h-8 rounded-lg", notification.isPinned ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:text-amber-500 hover:bg-slate-50")}
                title={notification.isPinned ? "Désépingler" : "Épingler l'annonce"}
              >
                <Pin className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={async () => {
                  if (confirm("Supprimer définitivement cette annonce ?")) {
                    await api.notifications.delete(notification.id);
                    onRefresh();
                  }
                }}
                className="w-8 h-10 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-600"
                title="Supprimer l'annonce"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Announcement Content */}
      <div className="mb-6">
        <h3 className="text-xl font-black text-slate-900 tracking-tight leading-snug mb-3">
          {notification.title}
        </h3>
        <div 
          className="text-xs prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed custom-rendering" 
          dangerouslySetInnerHTML={{ __html: notification.content }} 
        />
      </div>

      {/* Attachments Section if exists */}
      {notification.attachmentUrl && (
        <div className="mb-6 p-4 rounded-xl border border-dashed border-indigo-100 bg-indigo-50/5 flex items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fichier de support</p>
              <p className="text-xs font-bold text-slate-800 truncate">{notification.attachmentName || "Ressources"}</p>
            </div>
          </div>
          <a 
            href={notification.attachmentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 py-2 px-4 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-100"
            referrerPolicy="no-referrer"
          >
            Consulter <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Reactions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          {Object.keys(reactionEmojis).map((type) => {
            const isClick = hasReacted(type);
            const count = reactionCounts[type] || 0;
            return (
              <button
                key={type}
                onClick={() => handleToggleReaction(type)}
                className={cn(
                  "py-1.5 px-3 rounded-xl border text-xs font-black transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95",
                  isClick 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-800 font-black" 
                    : count > 0 
                      ? "border-slate-200 bg-slate-50 text-slate-700" 
                      : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                )}
              >
                <span>{reactionEmojis[type]}</span>
                {count > 0 && <span className="text-[10px]">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* View/Comment Toggles */}
        <div className="flex items-center gap-2">
          {/* Read logs for teachers / reads display for students */}
          {isTeacher ? (
            <button 
              onClick={() => setShowReadersList(!showReadersList)}
              className="py-1.5 px-3 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors text-xs font-bold"
            >
              <Eye className="w-4 h-4 text-slate-300" />
              <span>{notification.readCount || 0} vues</span>
              {showReadersList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : (
            <div className="py-1.5 px-3 flex items-center gap-1.5 text-slate-400 text-xs font-medium">
              <Eye className="w-4 h-4 text-slate-300" />
              <span>{notification.readCount || 0} vues</span>
            </div>
          )}

          <button 
            onClick={() => setShowComments(!showComments)}
            className="py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 flex items-center gap-1.5 text-indigo-600 transition-colors text-xs font-black uppercase tracking-widest shadow-sm"
          >
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>{comments.length} avis</span>
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Reader Tracking Expansion (Teacher view) */}
      <AnimatePresence>
        {isTeacher && showReadersList && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-4 border-t border-slate-50 pt-4"
          >
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" /> Étudiants ayant lu l'annonce ({readers.length}) :
              </h4>
              {readers.length === 0 ? (
                <p className="text-[11px] font-bold text-slate-400 italic">Personne n'a encore visualisé cette annonce.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-2 custom-scrollbar">
                  {readers.map((reader: any) => (
                    <div key={reader.id} className="bg-white px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between text-[11px]">
                      <div>
                        <p className="font-extrabold text-slate-800 leading-tight">{reader.displayName}</p>
                        <p className="text-[9px] font-semibold text-slate-400">{reader.email}</p>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight bg-slate-50 shrink-0 px-1.5 py-0.5 rounded">
                        {new Date(reader.readAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Thread Expansion */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-4 pt-4 border-t border-slate-50 space-y-4"
          >
            {/* Comment List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {comments.length === 0 ? (
                <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">Aucun avis publié</p>
                  <p className="text-[10px] text-slate-400 mt-1">Soyez le premier à donner votre avis !</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const isCommentOwner = comment.userId === user.id;
                  const canDelete = isTeacher || isCommentOwner;
                  const isAuthorTeacher = comment.userRole === 'teacher' || comment.userRole === 'admin';
                  
                  return (
                    <div 
                      key={comment.id} 
                      className={cn(
                        "p-3.5 rounded-2xl border flex items-start justify-between gap-4 transition-all",
                        isAuthorTeacher 
                          ? "bg-indigo-50/10 border-indigo-100" 
                          : "bg-slate-50/30 border-slate-100 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            "text-xs font-black tracking-tight leading-none",
                            isAuthorTeacher ? "text-indigo-600" : "text-slate-800"
                          )}>
                            {comment.userDisplayName}
                          </span>
                          
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                            isAuthorTeacher 
                              ? "bg-indigo-600 text-white" 
                              : "bg-slate-100 text-slate-600 border border-slate-200/40"
                          )}>
                            {isAuthorTeacher ? 'Prof' : 'Élève'}
                          </span>

                          <span className="text-[9px] text-slate-400 font-bold">
                            {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed break-words whitespace-pre-line">{comment.content}</p>
                      </div>

                      {canDelete && (
                        <button 
                          onClick={() => handleDeleteComment(comment.id)} 
                          className="text-slate-400 hover:text-rose-600 rounded p-1 transition-colors shrink-0"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Votre message / question..."
                className="flex-1 h-11 px-4 bg-slate-50 border-2 border-slate-100 hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold font-sans transition-all outline-none"
                disabled={isSubmittingComment}
                required
              />
              <Button 
                type="submit" 
                disabled={isSubmittingComment || !commentContent.trim()}
                className="h-11 px-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-indigo-100 shrink-0"
              >
                {isSubmittingComment ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};
