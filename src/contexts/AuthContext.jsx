import React, { createContext, useContext, useReducer, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

const initialState = {
  mode: "login",
  email: "",
  username: "",
  password: "",
  signupRole: "STUDENT",
  inviteCode: "",
  user: null,
  error: "",
  info: "",
  token: "",
  session: null,
  authReady: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_TOKEN":
      return { ...state, token: action.payload };
    case "SET_SESSION":
      return { ...state, session: action.payload };
    case "SET_AUTH_READY":
      return { ...state, authReady: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_INFO":
      return { ...state, info: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: "" };
    case "CLEAR_INFO":
      return { ...state, info: "" };
    case "RESET_FORM":
      return {
        ...state,
        email: "",
        username: "",
        password: "",
        error: "",
        info: "",
      };
    case "LOGOUT":
      return {
        ...initialState,
        user: null,
        token: "",
        session: null,
        authReady: true,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Listen to Supabase auth state changes (login, logout, token refresh, OAuth redirect)
  useEffect(() => {
    let activeSubscription = null;

    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted.current) return;
      if (session) {
        dispatch({ type: "SET_SESSION", payload: session });
        dispatch({ type: "SET_TOKEN", payload: session.access_token });
      }
      dispatch({ type: "SET_AUTH_READY", payload: true });
    }).catch((err) => {
      console.error("[AuthContext] getSession error:", err);
      if (isMounted.current) dispatch({ type: "SET_AUTH_READY", payload: true });
    });

    // Subscribe to auth state changes
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted.current) return;

      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        dispatch({ type: "SET_SESSION", payload: null });
        dispatch({ type: "SET_TOKEN", payload: "" });
        dispatch({ type: "SET_USER", payload: null });
      } else if (event === "PASSWORD_RECOVERY") {
        dispatch({ type: "SET_SESSION", payload: session });
        dispatch({ type: "SET_TOKEN", payload: session?.access_token || "" });
      } else if (session) {
        dispatch({ type: "SET_SESSION", payload: session });
        dispatch({ type: "SET_TOKEN", payload: session.access_token });
      }
    });

    activeSubscription = data?.subscription;

    return () => {
      if (activeSubscription) activeSubscription.unsubscribe();
    };
  }, []);

  const value = {
    ...state,
    setMode: (mode) => dispatch({ type: "SET_MODE", payload: mode }),
    setField: (field, value) => dispatch({ type: "SET_FIELD", field, value }),
    setUser: (user) => dispatch({ type: "SET_USER", payload: user }),
    setToken: (token) => dispatch({ type: "SET_TOKEN", payload: token }),
    setSession: (session) => dispatch({ type: "SET_SESSION", payload: session }),
    setError: (error) => dispatch({ type: "SET_ERROR", payload: error }),
    setInfo: (info) => dispatch({ type: "SET_INFO", payload: info }),
    clearError: () => dispatch({ type: "CLEAR_ERROR" }),
    clearInfo: () => dispatch({ type: "CLEAR_INFO" }),
    resetForm: () => dispatch({ type: "RESET_FORM" }),
    logout: () => dispatch({ type: "LOGOUT" }),
    isFaculty: state.user?.role === "TEACHER" || state.user?.role === "LECTURER",
    isTeacher: state.user?.role === "TEACHER" || state.user?.role === "LECTURER",
    // Supabase auth helpers
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
