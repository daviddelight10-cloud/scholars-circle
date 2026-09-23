import { useState, useEffect } from "react";
import { getMyProfile, saveMyProfile } from "../lib/profileApi.js";
import { isLocalInstitutionId } from "../lib/universities.js";

const PROFILE_KEY = "sc_student_profile_v1";

export const ACADEMIC_LEVELS = [
  { id: "100", label: "100 Level (1st Year)", icon: "🌱" },
  { id: "200", label: "200 Level (2nd Year)", icon: "🌿" },
  { id: "300", label: "300 Level (3rd Year)", icon: "🌳" },
  { id: "400", label: "400 Level (4th Year)", icon: "🎓" },
  { id: "500", label: "500 Level (5th Year)", icon: "🏆" },
  { id: "postgrad", label: "Postgraduate", icon: "🔬" },
  { id: "secondary", label: "Secondary School", icon: "📚" }
];

export const LEARNING_STYLES = [
  { id: "visual", label: "Visual", icon: "👁️", desc: "Diagrams, charts, videos" },
  { id: "auditory", label: "Auditory", icon: "👂", desc: "Listening, discussions" },
  { id: "reading", label: "Reading/Writing", icon: "📖", desc: "Notes, articles" },
  { id: "kinesthetic", label: "Hands-on", icon: "✋", desc: "Practice, experiments" }
];

export const AVATAR_OPTIONS = ["🎓", "📚", "🧑‍🎓", "👨‍🎓", "👩‍🎓", "🧠", "💡", "🌟", "🚀", "🔬", "📐", "🎨", "💻", "⚖️", "⚕️", "🏛️"];

export const EMPTY_PROFILE = {
  fullName: "",
  avatar: "🎓",
  discipline: "",
  level: "",
  institution: "",
  universityId: null,
  universityName: "",
  isUniversityStudent: true,
  schoolName: "",
  department: "",
  programme: "",
  matricNumber: "",
  bio: "",
  learningStyle: "",
  goals: "",
  targetGrade: "",
  studyHoursPerDay: 2,
  courses: [],
  joinedAt: null,
  updatedAt: null
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {}
}

/** Hook to access and update the student profile with backend sync. */
export function useStudentProfile(authUserId) {
  const [profile, setProfile] = useState(() => loadProfile());
  const [loading, setLoading] = useState(false);

  // Fetch from backend on mount and when auth user changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getMyProfile();
        if (cancelled || !data?.profile) return;
        const p = data.profile;
        const merged = {
          ...EMPTY_PROFILE,
          ...loadProfile(),
          fullName: p.fullName || "",
          avatar: p.avatar || "🎓",
          discipline: p.discipline || "",
          level: p.level || "",
          institution: p.institution || p.university?.name || "",
          universityId: p.universityId || null,
          universityName: p.university?.name || "",
          isUniversityStudent: p.isUniversityStudent ?? true,
          schoolName: p.schoolName || "",
          department: p.department || "",
          programme: p.programme || "",
          matricNumber: p.matricNumber || "",
          bio: p.bio || "",
          learningStyle: p.learningStyle || "",
          goals: p.goals || "",
          targetGrade: p.targetGrade || "",
          studyHoursPerDay: p.studyHoursPerDay ?? 2,
          courses: Array.isArray(p.courses) ? p.courses : [],
        };
        setProfile(merged);
        saveProfile(merged);
      } catch {
        // offline fallback — keep localStorage
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authUserId]);

  const update = (changes) => {
    const next = {
      ...(profile || EMPTY_PROFILE),
      ...changes,
      updatedAt: new Date().toISOString(),
      joinedAt: profile?.joinedAt || new Date().toISOString()
    };
    setProfile(next);
    saveProfile(next);
    // Fire-and-forget backend save
    saveMyProfile({
      fullName: next.fullName,
      avatar: next.avatar,
      discipline: next.discipline,
      level: next.level,
      institution: next.institution,
      universityId: isLocalInstitutionId(next.universityId) ? null : next.universityId,
      isUniversityStudent: next.isUniversityStudent,
      schoolName: next.schoolName,
      department: next.department,
      programme: next.programme,
      matricNumber: next.matricNumber,
      bio: next.bio,
      learningStyle: next.learningStyle,
      goals: next.goals,
      targetGrade: next.targetGrade,
      studyHoursPerDay: next.studyHoursPerDay,
      ...(Array.isArray(next.courses) && next.courses.length > 0 ? { courses: next.courses } : {}),
    }).catch((e) => console.warn("Profile backend save failed:", e?.message || e));
  };

  const reset = () => {
    clearProfile();
    setProfile(null);
  };

  return { profile, update, reset, loading, isComplete: !!(profile?.fullName && profile?.discipline && profile?.level) };
}

export function computeCompletion(p) {
  if (!p) return 0;
  const fields = ["fullName", "discipline", "level", "institution", "department", "programme", "learningStyle", "targetGrade", "goals"];
  const filled = fields.filter((f) => p[f] && String(p[f]).trim().length > 0).length;
  const uniBonus = p.universityId ? 1 : 0;
  return Math.round(((filled + uniBonus) / (fields.length + 1)) * 100);
}
