import express from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function userId(req) {
  return req.user.sub || req.user.id;
}

// Fire-and-forget social push. Category "social" respects NotificationPreference.social.
async function socialPush(uid, payload) {
  if (!uid) return;
  try {
    const { sendPushToUser } = await import("../lib/pushSender.js");
    await sendPushToUser(uid, { tag: "social", data: { tab: "discuss" }, ...payload }, { category: "social" });
  } catch (e) {
    console.warn("[feed] social push failed:", e?.message);
  }
}

const AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  userProfile: {
    select: {
      avatar: true,
      level: true,
      department: true,
      universityId: true,
      university: { select: { name: true } },
    },
  },
};

function publicUser(u) {
  if (!u) return null;
  const p = u.userProfile || {};
  return {
    id: u.id,
    name: u.fullName || u.username || "Scholar",
    handle: u.username ? `@${u.username}` : null,
    role: u.role,
    avatar: p.avatar || null,
    level: p.level || null,
    department: p.department || null,
    uni: p.university?.name || null,
  };
}

// Audience = people I follow + people at my university + me.
// If the audience is too small, widen to everyone so new users still see content.
async function getAudience(uid) {
  const me = await prisma.user.findUnique({
    where: { id: uid },
    select: { userProfile: { select: { universityId: true } } },
  });
  const myUni = me?.userProfile?.universityId || null;

  const follows = await prisma.userFollow.findMany({
    where: { followerId: uid },
    select: { followingId: true },
  });
  const followingIds = new Set(follows.map((f) => f.followingId));

  let uniIds = [];
  if (myUni) {
    const uniUsers = await prisma.userProfile.findMany({
      where: { universityId: myUni },
      select: { userId: true },
      take: 2000,
    });
    uniIds = uniUsers.map((u) => u.userId);
  }

  const audience = new Set([...followingIds, ...uniIds, uid]);
  const global = audience.size < 10;
  return { myUni, followingIds, audience: [...audience], global };
}

function postBlock(p, myId) {
  return {
    type: "post",
    id: p.id,
    ts: p.createdAt,
    kind: p.kind,
    text: p.text,
    author: publicUser(p.author),
    isMine: p.authorId === myId,
    resource: p.resource
      ? {
          id: p.resource.id,
          title: p.resource.title,
          subject: p.resource.subject,
          contentType: p.resource.contentType,
          shareToken: p.resource.shareToken,
          viewCount: p.resource.viewCount,
          saved: p.resource._count?.bookmarks || 0,
        }
      : null,
    likes: p._count?.likes || 0,
    comments: p._count?.comments || 0,
    liked: (p.likes || []).length > 0,
    acceptedCommentId: p.acceptedCommentId || null,
    liveCode: p.liveCode || null,
  };
}

function resourceBlock(r) {
  return {
    type: "resource",
    id: r.id,
    ts: r.createdAt,
    author: publicUser(r.uploader),
    resource: {
      id: r.id,
      title: r.title,
      subject: r.subject,
      contentType: r.contentType,
      shareToken: r.shareToken,
      viewCount: r.viewCount,
      saved: r._count?.bookmarks || 0,
      comments: r._count?.comments || 0,
      likes: r._count?.resourceLikes || 0,
    },
    liked: (r.resourceLikes || []).length > 0,
    uni: r.university?.name || null,
  };
}

function folderBlock(f) {
  return {
    type: "folder",
    id: f.id,
    ts: f.createdAt,
    author: publicUser(f.owner),
    folder: {
      id: f.id,
      name: f.name,
      courseCode: f.courseCode,
      level: f.level,
      semester: f.semester,
      shareToken: f.shareToken,
      resourceCount: f._count?.resources || 0,
      saves: f._count?.folderBookmarks || 0,
    },
    uni: f.university?.name || null,
  };
}

function roomBlock(r) {
  const participants = (r.participants || []).filter((p) => !p.leftAt);
  return {
    type: "room",
    id: r.id,
    ts: r.startedAt,
    room: {
      id: r.id,
      name: r.name,
      subject: r.subject,
      focus: r.focus,
      seats: r.maxSeats,
      seatsUsed: participants.length,
      pomodoroMin: r.pomodoroMin,
      host: publicUser(r.host),
      resource: r.resource
        ? {
            id: r.resource.id,
            title: r.resource.title,
            subject: r.resource.subject,
            contentType: r.resource.contentType,
            shareToken: r.resource.shareToken,
          }
        : null,
      participants: participants.slice(0, 6).map((p) => publicUser(p.user)),
    },
  };
}

// ============ FEED ============

// GET /api/feed?scope=forYou|circle&subject=&cursor=
router.get("/", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { scope = "forYou", subject, cursor } = req.query;
    const { myUni, followingIds, audience, global } = await getAudience(uid);

    const scopeFollowingOnly = scope === "circle";
    const authorFilter = global
      ? {}
      : scopeFollowingOnly
        ? { authorId: { in: [...followingIds] } }
        : { authorId: { in: audience } };
    const uploaderFilter = global
      ? {}
      : scopeFollowingOnly
        ? { uploadedBy: { in: [...followingIds] } }
        : { uploadedBy: { in: audience } };
    const ownerFilter = global
      ? {}
      : scopeFollowingOnly
        ? { ownerId: { in: [...followingIds] } }
        : { ownerId: { in: audience } };
    const cursorFilter = cursor ? { createdAt: { lt: new Date(cursor) } } : {};

    const [posts, resources, folders] = await Promise.all([
      prisma.feedPost.findMany({
        where: {
          ...authorFilter,
          ...cursorFilter,
          ...(subject ? { resource: { subject } } : {}),
        },
        include: {
          author: { select: AUTHOR_SELECT },
          resource: {
            select: {
              id: true, title: true, subject: true, contentType: true,
              shareToken: true, viewCount: true,
              _count: { select: { bookmarks: true } },
            },
          },
          likes: { where: { userId: uid }, select: { id: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.resource.findMany({
        where: {
          status: "approved",
          ...uploaderFilter,
          ...cursorFilter,
          ...(subject ? { subject } : {}),
        },
        include: {
          uploader: { select: AUTHOR_SELECT },
          university: { select: { name: true } },
          resourceLikes: { where: { userId: uid }, select: { id: true } },
          _count: { select: { bookmarks: true, comments: true, resourceLikes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.folder.findMany({
        where: {
          deletedAt: null,
          visibility: { not: "private" },
          ...ownerFilter,
          ...cursorFilter,
        },
        include: {
          owner: { select: AUTHOR_SELECT },
          university: { select: { name: true } },
          _count: { select: { resources: true, folderBookmarks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Study rooms: public active rooms + rooms in my classrooms (skip on circle scope)
    let rooms = [];
    if (!scopeFollowingOnly) {
      const myClassrooms = await prisma.classroomMember.findMany({
        where: { userId: uid },
        select: { classroomId: true },
      });
      const owned = await prisma.classroom.findMany({
        where: { createdById: uid },
        select: { id: true },
      });
      const classroomIds = [...myClassrooms.map((c) => c.classroomId), ...owned.map((c) => c.id)];
      rooms = await prisma.classroomStudyRoom.findMany({
        where: {
          status: "active",
          ...(subject ? { subject } : {}),
          OR: [{ isPublic: true }, { classroomId: { in: classroomIds } }],
        },
        include: {
          host: { select: AUTHOR_SELECT },
          resource: { select: { id: true, title: true, subject: true, contentType: true, shareToken: true } },
          participants: {
            where: { leftAt: null },
            include: { user: { select: AUTHOR_SELECT } },
          },
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      });
    }

    // Activity rows: what my circle did recently (badges, saves, rooms)
    let activities = [];
    if (followingIds.size > 0) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const fIds = [...followingIds];
      const [badges, saves, joins] = await Promise.all([
        prisma.userBadge.findMany({
          where: { userId: { in: fIds }, awardedAt: { gte: since } },
          include: { user: { select: AUTHOR_SELECT }, badge: { select: { name: true, icon: true } } },
          orderBy: { awardedAt: "desc" },
          take: 10,
        }),
        prisma.resourceBookmark.findMany({
          where: { userId: { in: fIds }, createdAt: { gte: since } },
          include: {
            user: { select: AUTHOR_SELECT },
            resource: { select: { id: true, title: true, subject: true, shareToken: true, contentType: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.classroomStudyRoomParticipant.findMany({
          where: {
            userId: { in: fIds },
            joinedAt: { gte: since },
            leftAt: null,
            studyRoom: { status: "active" },
          },
          include: {
            user: { select: AUTHOR_SELECT },
            studyRoom: { select: { id: true, name: true, subject: true } },
          },
          orderBy: { joinedAt: "desc" },
          take: 10,
        }),
      ]);
      activities = [
        ...badges.map((b) => ({
          type: "activity",
          id: `badge-${b.id}`,
          ts: b.awardedAt,
          icon: b.badge?.icon || "🏅",
          actor: publicUser(b.user),
          text: `earned ${b.badge?.name || "a badge"}`,
        })),
        ...saves.map((s) => ({
          type: "activity",
          id: `save-${s.id}`,
          ts: s.createdAt,
          icon: "🔖",
          actor: publicUser(s.user),
          text: `saved ${s.resource?.title || "a resource"}`,
          resource: s.resource || null,
        })),
        ...joins.map((j) => ({
          type: "activity",
          id: `join-${j.id}`,
          ts: j.joinedAt,
          icon: "🟢",
          actor: publicUser(j.user),
          text: `is studying live in ${j.studyRoom?.name || "a room"}`,
          roomId: j.studyRoom?.id || null,
        })),
      ];
    }

    // Merge + rank: recency, boosted for followed authors
    const boost = (block) =>
      (block.author?.id && followingIds.has(block.author.id)) ||
      (block.actor?.id && followingIds.has(block.actor.id))
        ? 6 * 60 * 60 * 1000
        : 0;

    let blocks = [
      ...posts.map((p) => postBlock(p, uid)),
      ...resources.map(resourceBlock),
      ...folders.map(folderBlock),
      ...rooms.map(roomBlock),
      ...activities,
    ]
      .map((b) => ({ ...b, score: new Date(b.ts).getTime() + boost(b) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map(({ score, ...b }) => b);

    const nextCursor =
      blocks.length >= 30
        ? new Date(Math.min(...blocks.map((b) => new Date(b.ts).getTime()))).toISOString()
        : null;

    res.json({ blocks, nextCursor, meta: { global, following: followingIds.size, uni: myUni } });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Failed to load feed" });
  }
});

// ============ POSTS ============

router.post("/posts", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { text, kind, resourceId } = req.body || {};
    if (!text?.trim() && !resourceId) {
      return res.status(400).json({ error: "Post needs text or a resource" });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: uid },
      select: { universityId: true },
    });

    if (resourceId) {
      const res_ = await prisma.resource.findUnique({ where: { id: resourceId }, select: { id: true } });
      if (!res_) return res.status(404).json({ error: "Resource not found" });
    }

    const post = await prisma.feedPost.create({
      data: {
        authorId: uid,
        kind: ["post", "question", "activity"].includes(kind) ? kind : "post",
        text: text?.trim() || "",
        resourceId: resourceId || null,
        universityId: profile?.universityId || null,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        resource: {
          select: {
            id: true, title: true, subject: true, contentType: true,
            shareToken: true, viewCount: true,
            _count: { select: { bookmarks: true } },
          },
        },
        likes: { where: { userId: uid }, select: { id: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    res.status(201).json(postBlock(post, uid));
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.delete("/posts/:id", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const post = await prisma.feedPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.authorId !== uid) return res.status(403).json({ error: "Not your post" });
    await prisma.feedPost.delete({ where: { id: post.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

router.post("/posts/:id/like", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const postId = req.params.id;
    const existing = await prisma.feedLike.findUnique({
      where: { postId_userId: { postId, userId: uid } },
    });
    if (existing) {
      await prisma.feedLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.feedLike.create({ data: { postId, userId: uid } });
    }
    const count = await prisma.feedLike.count({ where: { postId } });
    if (!existing) {
      const post = await prisma.feedPost.findUnique({
        where: { id: postId },
        select: { authorId: true, kind: true, text: true },
      });
      if (post && post.authorId !== uid) {
        const liker = await prisma.user.findUnique({ where: { id: uid }, select: { fullName: true, username: true } });
        const who = liker?.fullName || liker?.username || "Someone";
        const verb = post.kind === "activity" ? "cheered" : "liked";
        socialPush(post.authorId, {
          title: `${who} ${verb} your ${post.kind === "question" ? "question" : "post"}`,
          body: post.text?.slice(0, 80) || "",
        });
      }
    }
    res.json({ liked: !existing, count });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// ============ COMMENTS ============

router.get("/posts/:id/comments", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const post = await prisma.feedPost.findUnique({
      where: { id: req.params.id },
      select: { authorId: true, acceptedCommentId: true },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    const comments = await prisma.feedComment.findMany({
      where: { postId: req.params.id },
      include: {
        user: { select: AUTHOR_SELECT },
        likes: { where: { userId: uid }, select: { id: true } },
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json(
      comments.map((c) => ({
        id: c.id,
        text: c.text,
        ts: c.createdAt,
        author: publicUser(c.user),
        likes: c._count.likes,
        liked: c.likes.length > 0,
        isMine: c.userId === uid,
        isAccepted: c.id === post.acceptedCommentId,
        canAccept: post.authorId === uid,
      }))
    );
  } catch (err) {
    console.error("Comments error:", err);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

router.post("/posts/:id/comments", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });

    const post = await prisma.feedPost.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, kind: true, text: true },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = await prisma.feedComment.create({
      data: { postId: post.id, userId: uid, text: text.trim() },
      include: { user: { select: AUTHOR_SELECT } },
    });
    if (post.authorId !== uid) {
      const who = comment.user?.fullName || comment.user?.username || "Someone";
      socialPush(post.authorId, {
        title: `${who} ${post.kind === "question" ? "answered your question" : "commented on your post"}`,
        body: comment.text.slice(0, 80),
      });
    }
    res.status(201).json({
      id: comment.id,
      text: comment.text,
      ts: comment.createdAt,
      author: publicUser(comment.user),
      likes: 0,
      liked: false,
      isMine: true,
    });
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

router.post("/comments/:id/like", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const commentId = req.params.id;
    const existing = await prisma.feedCommentLike.findUnique({
      where: { commentId_userId: { commentId, userId: uid } },
    });
    if (existing) {
      await prisma.feedCommentLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.feedCommentLike.create({ data: { commentId, userId: uid } });
    }
    const count = await prisma.feedCommentLike.count({ where: { commentId } });
    res.json({ liked: !existing, count });
  } catch (err) {
    console.error("Comment like error:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// ============ ACCEPTED ANSWER ============

// POST /api/feed/posts/:id/accept — question author marks a comment as the answer.
// Answerer gets +50 XP, asker +25 (Brainly-style). Re-marking is free after the first award.
const ACCEPT_ANSWER_XP = 50;
const ACCEPT_ASKER_XP = 25;

router.post("/posts/:id/accept", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { commentId } = req.body || {};
    if (!commentId) return res.status(400).json({ error: "commentId required" });

    const post = await prisma.feedPost.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, kind: true, acceptedCommentId: true, text: true },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.authorId !== uid) return res.status(403).json({ error: "Only the asker can accept an answer" });

    const comment = await prisma.feedComment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, userId: true },
    });
    if (!comment || comment.postId !== post.id) {
      return res.status(400).json({ error: "Comment does not belong to this post" });
    }

    const firstAward = !post.acceptedCommentId;
    await prisma.feedPost.update({
      where: { id: post.id },
      data: { acceptedCommentId: comment.id },
    });

    if (firstAward) {
      if (comment.userId !== uid) {
        await prisma.userProgress.upsert({
          where: { userId: comment.userId },
          update: { xp: { increment: ACCEPT_ANSWER_XP } },
          create: { userId: comment.userId, xp: ACCEPT_ANSWER_XP },
        });
        await prisma.user.update({
          where: { id: comment.userId },
          data: { totalXp: { increment: ACCEPT_ANSWER_XP } },
        }).catch(() => {});
      }
      await prisma.userProgress.upsert({
        where: { userId: uid },
        update: { xp: { increment: ACCEPT_ASKER_XP } },
        create: { userId: uid, xp: ACCEPT_ASKER_XP },
      });
      await prisma.user.update({
        where: { id: uid },
        data: { totalXp: { increment: ACCEPT_ASKER_XP } },
      }).catch(() => {});

      if (comment.userId !== uid) {
        const asker = await prisma.user.findUnique({ where: { id: uid }, select: { fullName: true, username: true } });
        socialPush(comment.userId, {
          title: `${asker?.fullName || asker?.username || "Someone"} accepted your answer ✓`,
          body: `+${ACCEPT_ANSWER_XP} XP · ${post.text?.slice(0, 60) || ""}`,
        });
      }
    }

    res.json({ acceptedCommentId: comment.id, xpAwarded: firstAward });
  } catch (err) {
    console.error("Accept answer error:", err);
    res.status(500).json({ error: "Failed to accept answer" });
  }
});

// ============ CIRCLE + SUGGESTED ============

// GET /api/feed/circle — my circle (following) + today's digest
router.get("/circle", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const follows = await prisma.userFollow.findMany({
      where: { followerId: uid },
      include: { following: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const following = follows.map((f) => publicUser(f.following));
    const fIds = follows.map((f) => f.followingId);

    let digest = [];
    if (fIds.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [saves, badges, joins] = await Promise.all([
        prisma.resourceBookmark.findMany({
          where: { userId: { in: fIds }, createdAt: { gte: today } },
          include: {
            user: { select: AUTHOR_SELECT },
            resource: { select: { id: true, title: true, subject: true, shareToken: true, contentType: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 15,
        }),
        prisma.userBadge.findMany({
          where: { userId: { in: fIds }, awardedAt: { gte: today } },
          include: { user: { select: AUTHOR_SELECT }, badge: { select: { name: true, icon: true } } },
          orderBy: { awardedAt: "desc" },
          take: 15,
        }),
        prisma.classroomStudyRoomParticipant.findMany({
          where: { userId: { in: fIds }, joinedAt: { gte: today }, leftAt: null, studyRoom: { status: "active" } },
          include: {
            user: { select: AUTHOR_SELECT },
            studyRoom: { select: { id: true, name: true, subject: true } },
          },
          orderBy: { joinedAt: "desc" },
          take: 15,
        }),
      ]);
      digest = [
        ...saves.map((s) => ({
          type: "save", ts: s.createdAt, icon: "🔖",
          actor: publicUser(s.user),
          text: `saved ${s.resource?.title || "a resource"}`,
          resource: s.resource || null,
        })),
        ...badges.map((b) => ({
          type: "badge", ts: b.awardedAt, icon: b.badge?.icon || "🏅",
          actor: publicUser(b.user),
          text: `earned ${b.badge?.name || "a badge"}`,
        })),
        ...joins.map((j) => ({
          type: "live", ts: j.joinedAt, icon: "🟢",
          actor: publicUser(j.user),
          text: `is studying live in ${j.studyRoom?.name || "a room"}`,
          roomId: j.studyRoom?.id || null,
        })),
      ].sort((a, b) => new Date(b.ts) - new Date(a.ts));
    }

    res.json({ following, digest });
  } catch (err) {
    console.error("Circle error:", err);
    res.status(500).json({ error: "Failed to load circle" });
  }
});

// GET /api/feed/suggested — people to follow (same university first, ranked by XP)
router.get("/suggested", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const { myUni, followingIds } = await getAudience(uid);
    const exclude = [...followingIds, uid];

    const select = {
      ...AUTHOR_SELECT,
      progress: { select: { xp: true, streak: true } },
    };

    let users = [];
    if (myUni) {
      users = await prisma.user.findMany({
        where: { id: { notIn: exclude }, userProfile: { universityId: myUni } },
        select,
        orderBy: { progress: { xp: "desc" } },
        take: 10,
      });
    }
    if (users.length < 5) {
      const more = await prisma.user.findMany({
        where: { id: { notIn: [...exclude, ...users.map((u) => u.id)] } },
        select,
        orderBy: { progress: { xp: "desc" } },
        take: 10 - users.length,
      });
      users = [...users, ...more];
    }

    res.json(
      users.map((u) => ({
        ...publicUser(u),
        xp: u.progress?.xp || 0,
        streak: u.progress?.streak || 0,
      }))
    );
  } catch (err) {
    console.error("Suggested error:", err);
    res.status(500).json({ error: "Failed to load suggestions" });
  }
});

// GET /api/feed/trending — most-saved resources at my university in the last 7d.
// Falls back to global trending when the user has no university.
router.get("/trending", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const me = await prisma.userProfile.findUnique({
      where: { userId: uid },
      select: { universityId: true },
    });
    const myUni = me?.universityId || null;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const groupArgs = (uniScoped) => ({
      by: ["resourceId"],
      where: {
        createdAt: { gte: since },
        ...(uniScoped ? { resource: { universityId: myUni } } : {}),
      },
      _count: { resourceId: true },
      orderBy: { _count: { resourceId: "desc" } },
      take: 5,
    });

    let grouped = myUni ? await prisma.resourceBookmark.groupBy(groupArgs(true)) : [];
    const uniScoped = grouped.length > 0;
    if (!uniScoped) grouped = await prisma.resourceBookmark.groupBy(groupArgs(false));
    if (grouped.length === 0) return res.json({ uni: uniScoped ? myUni : null, resources: [] });

    const resources = await prisma.resource.findMany({
      where: { id: { in: grouped.map((g) => g.resourceId) } },
      include: {
        uploader: { select: AUTHOR_SELECT },
        university: { select: { name: true } },
        _count: { select: { bookmarks: true } },
      },
    });
    const byId = Object.fromEntries(resources.map((r) => [r.id, r]));

    res.json({
      uni: uniScoped ? resources[0]?.university?.name || null : null,
      resources: grouped
        .map((g) => {
          const r = byId[g.resourceId];
          if (!r) return null;
          return {
            id: r.id,
            title: r.title,
            subject: r.subject,
            contentType: r.contentType,
            shareToken: r.shareToken,
            weeklySaves: g._count.resourceId,
            totalSaves: r._count.bookmarks,
            uploader: publicUser(r.uploader),
          };
        })
        .filter(Boolean),
    });
  } catch (err) {
    console.error("Trending error:", err);
    res.status(500).json({ error: "Failed to load trending" });
  }
});

// GET /api/feed/users/:id — profile sheet: identity + stats + follow state + recent posts.
router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const targetId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        ...AUTHOR_SELECT,
        createdAt: true,
        progress: { select: { xp: true, streak: true, sessions: true, totalCorrect: true } },
        _count: { select: { followers: true, following: true } },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const [isFollowing, isFollower, posts, badges] = await Promise.all([
      prisma.userFollow.findUnique({
        where: { followerId_followingId: { followerId: uid, followingId: targetId } },
      }),
      prisma.userFollow.findUnique({
        where: { followerId_followingId: { followerId: targetId, followingId: uid } },
      }),
      prisma.feedPost.findMany({
        where: { authorId: targetId },
        include: {
          author: { select: AUTHOR_SELECT },
          resource: {
            select: {
              id: true, title: true, subject: true, contentType: true,
              shareToken: true, viewCount: true,
              _count: { select: { bookmarks: true } },
            },
          },
          likes: { where: { userId: uid }, select: { id: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.userBadge.findMany({
        where: { userId: targetId },
        include: { badge: { select: { name: true, icon: true } } },
        orderBy: { awardedAt: "desc" },
        take: 6,
      }),
    ]);

    res.json({
      user: {
        ...publicUser(user),
        joined: user.createdAt,
        xp: user.progress?.xp || 0,
        streak: user.progress?.streak || 0,
        sessions: user.progress?.sessions || 0,
        totalCorrect: user.progress?.totalCorrect || 0,
        followers: user._count.followers,
        following: user._count.following,
      },
      isMe: targetId === uid,
      isFollowing: !!isFollowing,
      followsMe: !!isFollower,
      badges: badges.map((b) => ({ name: b.badge?.name, icon: b.badge?.icon })),
      posts: posts.map((p) => postBlock(p, uid)),
    });
  } catch (err) {
    console.error("Feed profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

export default router;
