'use client';
import { Trash2, Edit2, Reply } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';

function getRelativeTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);

  if (seconds < 60) return 'щойно';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'хвилину' : 'хвилин'} тому`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'годину' : 'годин'} тому`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'день' : 'днів'} тому`;
  return d.toLocaleDateString('uk-UA');
}

function CommentItem({
  comment,
  onReply,
  onEdit,
  onDelete,
  isReply = false,
}) {
  const { avatar, author, timestamp, content, edited } = comment;

  return (
    <div className={`flex gap-[12px] ${isReply ? 'ml-[32px] mt-[12px]' : 'mt-[16px]'}`}>
      {/* Avatar */}
      <UserAvatar user={avatar} size="md" className="shrink-0" />

      {/* Content */}
      <div className="flex-1">
        {/* Header: Name + Time */}
        <div className="flex items-center gap-[8px] mb-[4px]">
          <span className="text-[13px] font-bold text-ink">{author}</span>
          <span className="text-[11px] font-medium text-muted">
            {getRelativeTime(timestamp)}
          </span>
          {edited && <span className="text-[10px] text-muted italic">(відредаговано)</span>}
        </div>

        {/* Comment Content */}
        <p className="text-[13px] font-medium text-ink mb-[8px] break-words">
          {content}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-[12px]">
          <button
            onClick={() => onReply?.(comment)}
            className="flex items-center gap-[4px] text-[11px] font-bold text-muted hover:text-ink transition-colors"
          >
            <Reply size={12} />
            Відповісти
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit?.(comment)}
              className="flex items-center gap-[4px] text-[11px] font-bold text-muted hover:text-ink transition-colors"
            >
              <Edit2 size={12} />
              Редагувати
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete?.(comment)}
              className="flex items-center gap-[4px] text-[11px] font-bold text-muted hover:text-[#ef4444] transition-colors"
            >
              <Trash2 size={12} />
              Видалити
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentThread({
  comments = [],
  onReply,
  onEdit,
  onDelete,
  className = '',
}) {
  // Group comments and their replies
  const groupedComments = comments.filter(c => !c.parentId);

  return (
    <div className={`bg-white rounded-[16px] p-[16px] ${className}`}>
      {comments.length === 0 ? (
        <div className="text-center py-[24px]">
          <p className="text-[13px] font-medium text-muted">Немає коментарів</p>
        </div>
      ) : (
        <div>
          {groupedComments.map((parentComment, idx) => {
            const replies = comments.filter(c => c.parentId === parentComment.id);

            return (
              <div key={parentComment.id || idx}>
                <CommentItem
                  comment={parentComment}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />

                {/* Nested Replies */}
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isReply={true}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
