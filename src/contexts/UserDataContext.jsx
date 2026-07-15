import React, { createContext, useContext, useReducer } from "react";

const UserDataContext = createContext(null);

const initialState = {
  stats: {
    xp: 0,
    streak: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    studyTime: 0,
    sessions: 0,
    questsDone: {},
  },
  history: [],
  wrongCounts: {},
  mastery: {},
  srData: {},
  subjects: [],
  assignments: [],
  activeSession: null,
  timetable: [],
  notes: {},
  customFlashcards: [],
  discussion: [],
  outlineProgress: {},
  lastStudied: null,
  lastActivity: null,
};

function userDataReducer(state, action) {
  switch (action.type) {
    case "SET_STATS":
      return { ...state, stats: action.payload };
    case "UPDATE_STATS":
      return { ...state, stats: { ...state.stats, ...action.payload } };
    case "SET_HISTORY":
      return { ...state, history: action.payload };
    case "ADD_HISTORY":
      return { ...state, history: [...state.history, action.payload] };
    case "SET_WRONG_COUNTS":
      return { ...state, wrongCounts: action.payload };
    case "UPDATE_WRONG_COUNT":
      return {
        ...state,
        wrongCounts: {
          ...state.wrongCounts,
          [action.key]: (state.wrongCounts[action.key] || 0) + 1,
        },
      };
    case "SET_MASTERY":
      return { ...state, mastery: action.payload };
    case "UPDATE_MASTERY":
      return {
        ...state,
        mastery: {
          ...state.mastery,
          [action.subjectId]: {
            ...(state.mastery[action.subjectId] || {}),
            ...action.data,
          },
        },
      };
    case "SET_SR_DATA":
      return { ...state, srData: action.payload };
    case "SET_SUBJECTS":
      return { ...state, subjects: action.payload };
    case "SET_ASSIGNMENTS":
      return { ...state, assignments: action.payload };
    case "SET_ACTIVE_SESSION":
      return { ...state, activeSession: action.payload };
    case "SET_TIMETABLE":
      return { ...state, timetable: action.payload };
    case "SET_NOTES":
      return { ...state, notes: action.payload };
    case "UPDATE_NOTES":
      return { ...state, notes: action.payload };
    case "SET_CUSTOM_FLASHCARDS":
      return { ...state, customFlashcards: action.payload };
    case "ADD_CUSTOM_FLASHCARD":
      return { ...state, customFlashcards: [...state.customFlashcards, action.payload] };
    case "SET_DISCUSSION":
      return { ...state, discussion: action.payload };
    case "SET_OUTLINE_PROGRESS":
      return { ...state, outlineProgress: action.payload };
    case "UPDATE_OUTLINE_PROGRESS":
      return {
        ...state,
        outlineProgress: {
          ...state.outlineProgress,
          [action.subjectId]: {
            ...(state.outlineProgress[action.subjectId] || {}),
            ...action.data,
          },
        },
      };
    case "SET_LAST_STUDIED":
      return { ...state, lastStudied: action.payload };
    case "SET_LAST_ACTIVITY":
      return { ...state, lastActivity: action.payload };
    default:
      return state;
  }
}

export function UserDataProvider({ children }) {
  const [state, dispatch] = useReducer(userDataReducer, initialState);

  // Context is an in-memory store only; App.jsx handles localStorage persistence
  // via per-user namespaced keys (scholars-circle-state::userId).

  const value = {
    ...state,
    setStats: (stats) => dispatch({ type: "SET_STATS", payload: stats }),
    updateStats: (data) => dispatch({ type: "UPDATE_STATS", payload: data }),
    setHistory: (history) => dispatch({ type: "SET_HISTORY", payload: history }),
    addHistory: (item) => dispatch({ type: "ADD_HISTORY", payload: item }),
    setWrongCounts: (counts) => dispatch({ type: "SET_WRONG_COUNTS", payload: counts }),
    updateWrongCount: (key) => dispatch({ type: "UPDATE_WRONG_COUNT", payload: { key } }),
    setMastery: (mastery) => dispatch({ type: "SET_MASTERY", payload: mastery }),
    updateMastery: (subjectId, data) => dispatch({ type: "UPDATE_MASTERY", payload: { subjectId, data } }),
    setSrData: (srData) => dispatch({ type: "SET_SR_DATA", payload: srData }),
    setSubjects: (subjects) => dispatch({ type: "SET_SUBJECTS", payload: subjects }),
    setAssignments: (assignments) => dispatch({ type: "SET_ASSIGNMENTS", payload: assignments }),
    setActiveSession: (session) => dispatch({ type: "SET_ACTIVE_SESSION", payload: session }),
    setTimetable: (timetable) => dispatch({ type: "SET_TIMETABLE", payload: timetable }),
    setNotes: (notes) => dispatch({ type: "SET_NOTES", payload: notes }),
    updateNotes: (notes) => dispatch({ type: "UPDATE_NOTES", payload: notes }),
    setCustomFlashcards: (flashcards) => dispatch({ type: "SET_CUSTOM_FLASHCARDS", payload: flashcards }),
    addCustomFlashcard: (card) => dispatch({ type: "ADD_CUSTOM_FLASHCARD", payload: card }),
    setDiscussion: (discussion) => dispatch({ type: "SET_DISCUSSION", payload: discussion }),
    setOutlineProgress: (progress) => dispatch({ type: "SET_OUTLINE_PROGRESS", payload: progress }),
    updateOutlineProgress: (subjectId, data) => dispatch({ type: "UPDATE_OUTLINE_PROGRESS", payload: { subjectId, data } }),
    setLastStudied: (lastStudied) => dispatch({ type: "SET_LAST_STUDIED", payload: lastStudied }),
    setLastActivity: (activity) => dispatch({ type: "SET_LAST_ACTIVITY", payload: activity }),
  };

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error("useUserData must be used within a UserDataProvider");
  }
  return context;
}
