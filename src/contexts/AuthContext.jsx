import React, { createContext, useContext, useReducer } from "react";

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
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Context is an in-memory store only; App.jsx handles token persistence
  // via scholars-circle-auth in localStorage.

  const value = {
    ...state,
    setMode: (mode) => dispatch({ type: "SET_MODE", payload: mode }),
    setField: (field, value) => dispatch({ type: "SET_FIELD", field, value }),
    setUser: (user) => dispatch({ type: "SET_USER", payload: user }),
    setToken: (token) => dispatch({ type: "SET_TOKEN", payload: token }),
    setError: (error) => dispatch({ type: "SET_ERROR", payload: error }),
    setInfo: (info) => dispatch({ type: "SET_INFO", payload: info }),
    clearError: () => dispatch({ type: "CLEAR_ERROR" }),
    clearInfo: () => dispatch({ type: "CLEAR_INFO" }),
    resetForm: () => dispatch({ type: "RESET_FORM" }),
    logout: () => dispatch({ type: "LOGOUT" }),
    isFaculty: state.user?.role === "TEACHER" || state.user?.role === "LECTURER",
    isTeacher: state.user?.role === "TEACHER" || state.user?.role === "LECTURER",
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
