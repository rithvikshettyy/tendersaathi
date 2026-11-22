import type { ReactNode, SVGProps } from "react";

const base = (children: ReactNode, p: SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

export const IconDashboard = (p: SVGProps<SVGSVGElement>) => base(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>, p);
export const IconTenders = (p: SVGProps<SVGSVGElement>) => base(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>, p);
export const IconSchemes = (p: SVGProps<SVGSVGElement>) => base(<><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" /></>, p);
export const IconProfile = (p: SVGProps<SVGSVGElement>) => base(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>, p);
export const IconSearch = (p: SVGProps<SVGSVGElement>) => base(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>, p);
export const IconBell = (p: SVGProps<SVGSVGElement>) => base(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>, p);
export const IconTarget = (p: SVGProps<SVGSVGElement>) => base(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>, p);
export const IconPdf = (p: SVGProps<SVGSVGElement>) => base(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>, p);
export const IconShield = (p: SVGProps<SVGSVGElement>) => base(<><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>, p);
export const IconClock = (p: SVGProps<SVGSVGElement>) => base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, p);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => base(<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></>, p);
export const IconSpark = (p: SVGProps<SVGSVGElement>) => base(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></>, p);
export const IconChat = (p: SVGProps<SVGSVGElement>) => base(<><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z" /></>, p);
export const IconLogout = (p: SVGProps<SVGSVGElement>) => base(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>, p);
export const IconBuilding = (p: SVGProps<SVGSVGElement>) => base(<><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2" /></>, p);
