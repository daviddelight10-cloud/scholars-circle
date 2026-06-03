import React, { createContext, useContext, useReducer, useEffect } from "react";

const UIContext = createContext(null);

const initialState = {
  tab: "today",
  darkMode: true,
  showMobileMenu: false,
  showDeleteModal: false,
  deletePassword: "",
  deleteLoading: false,
  showOnboarding: false,
  demoMode: false,
  demoUsage: { aiCalls: 0, practiceQuestions: 0 },
  learnSubTab: "practice",
  progressSubTab: "stats",
  resourcesSubTab: "notes",
  aiTutorSubTab: "chat",
  isOffline: false,
  syncConfig: { url: "", key: "", userId: "local-user" },
  syncStatus: "",
  aiConfig: {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
    systemPrompt: "",
  },
  globalAnnouncement: null,
  showLoginPassword: false,
  showSignupPassword: false,
  showSignupConfirmPassword: false,
};

function uiReducer(state, action) {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, tab: action.payload };
    case "TOGGLE_DARK_MODE":
      return { ...state, darkMode: !state.darkMode };
    case "SET_DARK_MODE":
      return { ...state, darkMode: action.payload };
    case "SET_MOBILE_MENU":
      return { ...state, showMobileMenu: action.payload };
    case "TOGGLE_MOBILE_MENU":
      return { ...state, showMobileMenu: !state.showMobileMenu };
    case "SET_DELETE_MODAL":
      return { ...state, showDeleteModal: action.payload };
    case "SET_DELETE_PASSWORD":
      return { ...state, deletePassword: action.payload };
    case "SET_DELETE_LOADING":
      return { ...state, deleteLoading: action.payload };
    case "SET_ONBOARDING":
      return { ...state, showOnboarding: action.payload };
    case "SET_DEMO_MODE":
      return { ...state, demoMode: action.payload };
    case "SET_DEMO_USAGE":
      return { ...state, demoUsage: action.payload };
    case "UPDATE_DEMO_USAGE":
      return { ...state, demoUsage: { ...state.demoUsage, ...action.payload } };
    case "SET_LEARN_SUB_TAB":
      return { ...state, learnSubTab: action.payload };
    case "SET_PROGRESS_SUB_TAB":
      return { ...state, progressSubTab: action.payload };
    case "SET_RESOURCES_SUB_TAB":
      return { ...state, resourcesSubTab: action.payload };
    case "SET_AI_TUTOR_SUB_TAB":
      return { ...state, aiTutorSubTab: action.payload };
    case "SET_OFFLINE":
      return { ...state, isOffline: action.payload };
    case "SET_SYNC_CONFIG":
      return { ...state, syncConfig: action.payload };
    case "SET_SYNC_STATUS":
      return { ...state, syncStatus: action.payload };
    case "SET_AI_CONFIG":
      return { ...state, aiConfig: action.payload };
    case "SET_GLOBAL_ANNOUNCEMENT":
      return { ...state, globalAnnouncement: action.payload };
    case "SET_SHOW_LOGIN_PASSWORD":
      return { ...state, showLoginPassword: action.payload };
    case "SET_SHOW_SIGNUP_PASSWORD":
      return { ...state, showSignupPassword: action.payload };
    case "SET_SHOW_SIGNUP_CONFIRM_PASSWORD":
      return { ...state, showSignupConfirmPassword: action.payload };
    default:
      return state;
  }
}

export function UIProvider({ children }) {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  // Load dark mode from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode !== null) {
      dispatch({ type: "SET_DARK_MODE", payload: savedDarkMode === "true" });
    }
  }, []);

  // Save dark mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("darkMode", state.darkMode);
    if (state.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [state.darkMode]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: "SET_OFFLINE", payload: false });
    const handleOffline = () => dispatch({ type: "SET_OFFLINE", payload: true });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const value = {
    ...state,
    setTab: (tab) => dispatch({ type: "SET_TAB", payload: tab }),
    toggleDarkMode: () => dispatch({ type: "TOGGLE_DARK_MODE" }),
    setDarkMode: (darkMode) => dispatch({ type: "SET_DARK_MODE", payload: darkMode }),
    setMobileMenu: (show) => dispatch({ type: "SET_MOBILE_MENU", payload: show }),
    toggleMobileMenu: () => dispatch({ type: "TOGGLE_MOBILE_MENU" }),
    setDeleteModal: (show) => dispatch({ type: "SET_DELETE_MODAL", payload: show }),
    setDeletePassword: (password) => dispatch({ type: "SET_DELETE_PASSWORD", payload: password }),
    setDeleteLoading: (loading) => dispatch({ type: "SET_DELETE_LOADING", payload: loading }),
    setOnboarding: (show) => dispatch({ type: "SET_ONBOARDING", payload: show }),
    setDemoMode: (demo) => dispatch({ type: "SET_DEMO_MODE", payload: demo }),
    setDemoUsage: (usage) => dispatch({ type: "SET_DEMO_USAGE", payload: usage }),
    updateDemoUsage: (usage) => dispatch({ type: "UPDATE_DEMO_USAGE", payload: usage }),
    setLearnSubTab: (tab) => dispatch({ type: "SET_LEARN_SUB_TAB", payload: tab }),
    setProgressSubTab: (tab) => dispatch({ type: "SET_PROGRESS_SUB_TAB", payload: tab }),
    setResourcesSubTab: (tab) => dispatch({ type: "SET_RESOURCES_SUB_TAB", payload: tab }),
    setAiTutorSubTab: (tab) => dispatch({ type: "SET_AI_TUTOR_SUB_TAB", payload: tab }),
    setSyncConfig: (config) => dispatch({ type: "SET_SYNC_CONFIG", payload: config }),
    setSyncStatus: (status) => dispatch({ type: "SET_SYNC_STATUS", payload: status }),
    setAiConfig: (config) => dispatch({ type: "SET_AI_CONFIG", payload: config }),
    setGlobalAnnouncement: (announcement) => dispatch({ type: "SET_GLOBAL_ANNOUNCEMENT", payload: announcement }),
    setShowLoginPassword: (show) => dispatch({ type: "SET_SHOW_LOGIN_PASSWORD", payload: show }),
    setShowSignupPassword: (show) => dispatch({ type: "SET_SHOW_SIGNUP_PASSWORD", payload: show }),
    setShowSignupConfirmPassword: (show) => dispatch({ type: "SET_SHOW_SIGNUP_CONFIRM_PASSWORD", payload: show }),
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
