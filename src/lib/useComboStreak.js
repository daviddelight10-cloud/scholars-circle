import { useState, useCallback, useRef } from "react";
import { XP_PER_CORRECT, STREAK_BONUS, MODE_MULTIPLIERS } from "../data.js";

/**
 * Shared hook for in-session correct-answer combo tracking and bonus XP.
 * Mirrors the logic from SessionPlayer.jsx so all research-hub session
 * runners can use the same mechanic consistently.
 *
 * @param {string} mode - session mode key for MODE_MULTIPLIERS (e.g. "spaced", "adaptive", "exam")
 * @returns {{ combo, streakBonus, totalStreakBonus, totalXP, correctCount, handleAnswer, resetCombo, getFinalXP }}
 */
export function useComboStreak(mode) {
  const [combo, setCombo] = useState(0);
  const [streakBonus, setStreakBonus] = useState(0);
  const [totalStreakBonus, setTotalStreakBonus] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const totalStreakBonusRef = useRef(0);
  const correctCountRef = useRef(0);
  const comboRef = useRef(0);

  const handleAnswer = useCallback((isCorrect) => {
    if (isCorrect) {
      const newCombo = comboRef.current + 1;
      comboRef.current = newCombo;
      setCombo(newCombo);
      correctCountRef.current += 1;
      setCorrectCount(correctCountRef.current);

      let bonus = 0;
      if (STREAK_BONUS[newCombo]) {
        bonus = STREAK_BONUS[newCombo];
        setStreakBonus(bonus);
      } else {
        setStreakBonus(0);
      }
      totalStreakBonusRef.current += bonus;
      setTotalStreakBonus(totalStreakBonusRef.current);
    } else {
      comboRef.current = 0;
      setCombo(0);
      setStreakBonus(0);
    }
  }, []);

  const resetCombo = useCallback(() => {
    comboRef.current = 0;
    totalStreakBonusRef.current = 0;
    correctCountRef.current = 0;
    setCombo(0);
    setStreakBonus(0);
    setTotalStreakBonus(0);
    setCorrectCount(0);
  }, []);

  const getFinalXP = useCallback(() => {
    const modeMultiplier = MODE_MULTIPLIERS[mode] || 1;
    const baseXP = correctCountRef.current * XP_PER_CORRECT;
    return Math.round((baseXP + totalStreakBonusRef.current) * modeMultiplier);
  }, [mode]);

  return {
    combo,
    streakBonus,
    totalStreakBonus,
    correctCount,
    handleAnswer,
    resetCombo,
    getFinalXP,
  };
}
