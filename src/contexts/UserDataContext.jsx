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
  subjects: [],
  assignments: [],
  timetable: [],
  notes: {},
  discussion: [],
  mastery: {},
  srData: null,
  wrongCounts: {},
  customFlashcards: [],
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
    case "SET_SUBJECTS":
      return { ...state, subjects: action.payload };
    case "SET_ASSIGNMENTS":
      return { ...state, assignments: action.payload };
    case "SET_TIMETABLE":
      return { ...state, timetable: action.payload };
    case "SET_NOTES":
      return { ...state, notes: action.payload };
    case "UPDATE_NOTES":
      return { ...state, notes: action.payload };
    case "SET_DISCUSSION":
      return { ...state, discussion: action.payload };
    case "SET_LAST_STUDIED":
      return { ...state, lastStudied: action.payload };
    case "SET_LAST_ACTIVITY":
      return { ...state, lastActivity: action.payload };
    case "SET_MASTERY":
      return { ...state, mastery: action.payload };
    case "SET_SR_DATA":
      return { ...state, srData: action.payload };
    case "SET_WRONG_COUNTS":
      return { ...state, wrongCounts: action.payload };
    case "SET_CUSTOM_FLASHCARDS":
      return { ...state, customFlashcards: action.payload };
    case "SET_OUTLINE_PROGRESS":
      return { ...state, outlineProgress: action.payload };
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
    setSubjects: (subjects) => dispatch({ type: "SET_SUBJECTS", payload: subjects }),
    setAssignments: (assignments) => dispatch({ type: "SET_ASSIGNMENTS", payload: assignments }),
    setTimetable: (timetable) => dispatch({ type: "SET_TIMETABLE", payload: timetable }),
    setNotes: (notes) => dispatch({ type: "SET_NOTES", payload: notes }),
    updateNotes: (notes) => dispatch({ type: "UPDATE_NOTES", payload: notes }),
    setDiscussion: (discussion) => dispatch({ type: "SET_DISCUSSION", payload: discussion }),
    setLastStudied: (lastStudied) => dispatch({ type: "SET_LAST_STUDIED", payload: lastStudied }),
    setLastActivity: (activity) => dispatch({ type: "SET_LAST_ACTIVITY", payload: activity }),
    setMastery: (mastery) => dispatch({ type: "SET_MASTERY", payload: mastery }),
    setSrData: (srData) => dispatch({ type: "SET_SR_DATA", payload: srData }),
    setWrongCounts: (wrongCounts) => dispatch({ type: "SET_WRONG_COUNTS", payload: wrongCounts }),
    setCustomFlashcards: (customFlashcards) => dispatch({ type: "SET_CUSTOM_FLASHCARDS", payload: customFlashcards }),
    setOutlineProgress: (outlineProgress) => dispatch({ type: "SET_OUTLINE_PROGRESS", payload: outlineProgress }),
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
