// Inline SVG icon set for the live quiz room (replaces the prototype's Font Awesome).
const S = ({ children, size = 18, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>{children}</svg>
);

export const IconX = (p) => <S {...p}><path d="M18 6 6 18M6 6l12 12" /></S>;
export const IconCheck = (p) => <S {...p}><path d="M20 6 9 17l-5-5" /></S>;
export const IconMic = (p) => <S {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></S>;
export const IconMicOff = (p) => <S {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3M2 2l20 20" /></S>;
export const IconChat = (p) => <S {...p}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.5a8.48 8.48 0 0 1 8 8v.5z" /></S>;
export const IconBulb = (p) => <S {...p}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></S>;
export const IconSend = (p) => <S {...p}><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></S>;
export const IconLock = (p) => <S {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></S>;
export const IconPie = (p) => <S {...p}><path d="M21.2 15.9A10 10 0 1 1 8 2.8" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></S>;
export const IconDice = (p) => <S {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1" fill="currentColor" /><circle cx="8.5" cy="15.5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></S>;
export const IconTrophy = (p) => <S {...p}><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z" /><path d="M7 6H4a2 2 0 0 0 0 4h3M17 6h3a2 2 0 0 1 0 4h-3" /></S>;
export const IconBolt = (p) => <S {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></S>;
export const IconBrain = (p) => <S {...p}><path d="M12 4a3 3 0 0 0-3-3 3.5 3.5 0 0 0-4 4.5A3.5 3.5 0 0 0 3 12a3.5 3.5 0 0 0 2 5.5A3.5 3.5 0 0 0 9 21a3 3 0 0 0 3-3z" /><path d="M12 4a3 3 0 0 1 3-3 3.5 3.5 0 0 1 4 4.5A3.5 3.5 0 0 1 21 12a3.5 3.5 0 0 1-2 5.5A3.5 3.5 0 0 1 15 21a3 3 0 0 1-3-3z" /></S>;
export const IconClover = (p) => <S {...p}><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><circle cx="8" cy="16" r="3" /><circle cx="16" cy="16" r="3" /><path d="M12 12v9" /></S>;
export const IconPlus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconClock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>;
export const IconList = (p) => <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></S>;
export const IconUsers = (p) => <S {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></S>;
export const IconCopy = (p) => <S {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></S>;
export const IconSpinner = (p) => <S {...p} style={{ animation: "lq-spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.2-8.6" /></S>;
export const IconStop = (p) => <S {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></S>;
