import { useCallback, useEffect, useRef, useState } from "react";
import { groupsApi } from "./groupsApi";
import { GroupView } from "./GroupView";
import { SectionHeader } from "../feed/feedUi";

function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

// Groups tab: your groups + create/join + public discovery. `joinCode` lets
// the parent deep-link an invite (?join=CODE or push payload).
export function GroupsTab({ token, me, subjects = [], isFaculty, joinCode, onJoinHandled, onOpenProfile }) {
  const [mine, setMine] = useState(null);
  const [publicGroups, setPublicGroups] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // group object when viewing one
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [initialJoinCode, setInitialJoinCode] = useState(null);
  const [discoverQ, setDiscoverQ] = useState("");
  const [discoverSubject, setDiscoverSubject] = useState("");
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const handledJoin = useRef(false);

  const loadMine = useCallback(async () => {
    try {
      const list = await groupsApi.myGroups({ token });
      setMine(list || []);
      // Keep the open group fresh (member count, code changes)
      setOpen((cur) => (cur ? (list || []).find((g) => g.id === cur.id) || cur : cur));
    } catch (e) {
      if (!mine) setError(e.message || "Couldn't load groups");
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDiscover = useCallback(async () => {
    try {
      const list = await groupsApi.discover({ token, q: discoverQ, subject: discoverSubject });
      setPublicGroups(list || []);
    } catch {}
  }, [token, discoverQ, discoverSubject]);

  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => { if (discoverOpen) loadDiscover(); }, [discoverOpen, loadDiscover]);

  // Deep-linked invite code → open the join sheet pre-filled. The code is
  // captured locally first since onJoinHandled clears it in the parent.
  useEffect(() => {
    if (joinCode && !handledJoin.current) {
      handledJoin.current = true;
      setInitialJoinCode(joinCode);
      setJoinOpen(true);
      onJoinHandled?.();
    }
  }, [joinCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchGroup = (g) => {
    setMine((prev) => (prev || []).map((x) => (x.id === g.id ? g : x)));
    setOpen((cur) => (cur?.id === g.id ? g : cur));
  };

  const removeFromList = (g) => {
    setMine((prev) => (prev || []).filter((x) => x.id !== g.id));
    setOpen(null);
  };

  if (open) {
    return (
      <GroupView
        group={open}
        token={token}
        currentUser={me}
        subjects={subjects}
        isFaculty={isFaculty}
        onBack={() => { setOpen(null); loadMine(); }}
        onChanged={patchGroup}
        onLeft={removeFromList}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <div className="fd-groups">
      <div className="fd-groups-actions">
        <button className="fd-go-btn" onClick={() => setCreateOpen(true)}>＋ Create group</button>
        <button className="fd-pill" onClick={() => setJoinOpen(true)}>🔑 Join with code</button>
      </div>

      {mine === null && !error && (
        <div className="fd-skeletons">
          {[0, 1].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 76 }} />)}
        </div>
      )}

      {error && (
        <div className="fd-empty">
          <div className="fd-empty-title">Couldn't load groups</div>
          <div className="fd-empty-sub">{error}</div>
          <button className="fd-follow-btn" onClick={loadMine}>Retry</button>
        </div>
      )}

      {mine?.length === 0 && (
        <div className="fd-empty">
          <div className="fd-empty-icon">👥</div>
          <div className="fd-empty-title">No study groups yet</div>
          <div className="fd-empty-sub">
            Create a group for your course or cohort — chat, set goals, run quiz battles and study rooms together.
          </div>
        </div>
      )}

      {(mine || []).length > 0 && (
        <>
          <SectionHeader title="Your groups" hint={`${mine.length}`} />
          {mine.map((g) => (
            <button key={g.id} className="fd-group-card" onClick={() => setOpen(g)}>
              <span className="fd-group-avatar">{initials(g.name)}</span>
              <span className="fd-group-info">
                <span className="fd-group-card-name">
                  {g.name}
                  {g.isCreator && <span className="fd-mini-chip">creator</span>}
                  {!g.isPublic && <span className="fd-mini-chip">🔒</span>}
                </span>
                <span className="fd-group-card-meta">
                  {[g.subject, `${g.memberCount} member${g.memberCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="fd-group-code">🔑 {g.joinCode}</span>
            </button>
          ))}
        </>
      )}

      <div className="fd-discover">
        <SectionHeader title="Discover public groups">
          <button className="fd-link" onClick={() => setDiscoverOpen((v) => !v)}>
            {discoverOpen ? "Hide" : "Browse"}
          </button>
        </SectionHeader>
        {discoverOpen && (
          <>
            <div className="fd-discover-filters">
              <input
                className="fd-sheet-search"
                placeholder="Search groups…"
                onChange={(e) => setDiscoverQ(e.target.value)}
              />
              <select
                className="fd-sheet-input"
                value={discoverSubject}
                onChange={(e) => setDiscoverSubject(e.target.value)}
              >
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.label}>{s.label}</option>
                ))}
              </select>
            </div>
            {publicGroups.length === 0 && (
              <div className="fd-empty-inline">No public groups found — make yours public to be listed here.</div>
            )}
            {publicGroups.map((g) => (
              <div key={g.id} className="fd-group-card">
                <span className="fd-group-avatar">{initials(g.name)}</span>
                <span className="fd-group-info">
                  <span className="fd-group-card-name">{g.name}</span>
                  <span className="fd-group-card-meta">
                    {[g.subject, `${g.memberCount} members`, g.creator?.name && `by ${g.creator.name}`].filter(Boolean).join(" · ")}
                  </span>
                  {g.description && <span className="fd-group-card-desc">{g.description}</span>}
                </span>
                <JoinButton token={token} group={g} onJoined={(gr) => { setMine((p) => [gr, ...(p || [])]); setPublicGroups((p) => p.filter((x) => x.id !== g.id)); }} />
              </div>
            ))}
          </>
        )}
      </div>

      {createOpen && (
        <CreateGroupSheet
          token={token}
          subjects={subjects}
          onClose={() => setCreateOpen(false)}
          onCreated={(g) => { setCreateOpen(false); setMine((p) => [g, ...(p || [])]); setOpen(g); }}
        />
      )}
      {joinOpen && (
        <JoinGroupSheet
          token={token}
          initialCode={initialJoinCode || joinCode}
          onClose={() => { setJoinOpen(false); setInitialJoinCode(null); }}
          onJoined={(g) => { setJoinOpen(false); setMine((p) => [g, ...(p || [])]); setOpen(g); }}
        />
      )}
    </div>
  );
}

function JoinButton({ token, group, onJoined }) {
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await groupsApi.join({ token, groupId: group.id });
      onJoined?.(res.group);
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };
  return (
    <button className="fd-join-btn" disabled={busy} onClick={join}>
      {busy ? "…" : "Join"}
    </button>
  );
}

function CreateGroupSheet({ token, subjects, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const g = await groupsApi.create({ token, name, subject, description, isPublic });
      onCreated?.(g);
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fd-sheet-backdrop" onClick={onClose}>
      <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fd-sheet-head">
          <b>👥 Create a study group</b>
          <button className="fd-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="fd-sheet-sub">
          Your group gets a chat, leaderboard, shared goals, study rooms and quiz battles.
        </div>
        <label className="fd-label">Group name</label>
        <input
          className="fd-sheet-input"
          placeholder="e.g. Anatomy 200L cram squad"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <label className="fd-label">Subject (optional)</label>
        <select className="fd-sheet-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">General study</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.label}>{s.label}</option>
          ))}
        </select>
        <label className="fd-label">Description (optional)</label>
        <input
          className="fd-sheet-input"
          placeholder="What are you grinding for?"
          value={description}
          maxLength={160}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="fd-check-row">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          <span>List in Discover — anyone can join without a code</span>
        </label>
        <button className="fd-go-btn" disabled={!name.trim() || busy} onClick={create}>
          {busy ? "Creating…" : "Create group"}
        </button>
      </div>
    </div>
  );
}

function JoinGroupSheet({ token, initialCode, onClose, onJoined }) {
  const [code, setCode] = useState(initialCode || "");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(
    async (c) => {
      setError(null);
      setPreview(null);
      try {
        const g = await groupsApi.preview({ token, code: c });
        setPreview(g);
      } catch (e) {
        setError(e.message);
      }
    },
    [token]
  );

  useEffect(() => {
    const c = (initialCode || "").toUpperCase();
    if (c.length === 6) lookup(c);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await groupsApi.join({ token, code });
      onJoined?.(res.group);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="fd-sheet-backdrop" onClick={onClose}>
      <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fd-sheet-head">
          <b>🔑 Join with code</b>
          <button className="fd-icon-btn" onClick={onClose}>✕</button>
        </div>
        <input
          className="fd-sheet-input fd-code-input"
          placeholder="6-CHARACTER CODE"
          value={code}
          maxLength={6}
          autoFocus={!initialCode}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            setCode(v);
            setError(null);
            setPreview(null);
            if (v.length === 6) lookup(v);
          }}
        />
        {error && <div className="fd-sheet-sub" style={{ color: "var(--fd-coral)" }}>{error}</div>}
        {preview && (
          <div className="fd-group-card" style={{ cursor: "default" }}>
            <span className="fd-group-avatar">{initials(preview.name)}</span>
            <span className="fd-group-info">
              <span className="fd-group-card-name">{preview.name}</span>
              <span className="fd-group-card-meta">
                {[preview.subject, `${preview.memberCount} members`, preview.creator?.name && `by ${preview.creator.name}`].filter(Boolean).join(" · ")}
              </span>
              {preview.description && <span className="fd-group-card-desc">{preview.description}</span>}
            </span>
          </div>
        )}
        {preview?.isMember ? (
          <div className="fd-sheet-sub" style={{ marginTop: 10 }}>✓ You're already in this group.</div>
        ) : (
          <button className="fd-go-btn" style={{ marginTop: 10 }} disabled={!preview || busy} onClick={join}>
            {busy ? "Joining…" : preview ? `Join ${preview.name}` : "Enter a code"}
          </button>
        )}
      </div>
    </div>
  );
}
