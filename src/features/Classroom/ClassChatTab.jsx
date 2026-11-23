import GroupChat from "../study-group/GroupChat.jsx";
// Chat styles live in feed.css (.gv-* / .fd-*) — the chat keeps its look,
// but renders INLINE in the class page. No FdScreen overlay, no Play/Board
// sub-tabs, no trip into the Feed.
import "../../feed.css";

/**
 * Class chat — the group's message thread rendered inside the classroom
 * page. Reuses GroupChat (polling, typing, reactions, replies, pins,
 * material sharing, moderation) so nothing is rebuilt; the change is the
 * container, not the chat.
 */
export function ClassChatTab({ classroom, memberCount, token, currentUser, isHost }) {
  return (
    <div className="cx-chat-wrap">
      <div className="cx-chat-head">
        <div className="cx-chat-head-ic">💬</div>
        <div>
          <div className="cx-chat-head-name">{classroom?.name}</div>
          <div className="cx-chat-head-sub">Class chat · {memberCount} member{memberCount === 1 ? "" : "s"}</div>
        </div>
      </div>
      <GroupChat
        classroomId={classroom?.id}
        token={token}
        currentUser={currentUser}
        canModerate={isHost}
      />
    </div>
  );
}
