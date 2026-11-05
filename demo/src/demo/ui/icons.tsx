import React from 'react';

// Line icons for the two products' own chrome (24-unit grid, round caps), drawn at the size the web UI uses.
const P: Record<string, string[]> = {
  plus: ['M12 5v14', 'M5 12h14'],
  arrowUp: ['M12 19V5', 'M5.5 11.5L12 5l6.5 6.5'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  mic: ['M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3z', 'M5.5 11a6.5 6.5 0 0 0 13 0', 'M12 17.5V21'],
  wave: ['M4 10v4', 'M8 7v10', 'M12 4v16', 'M16 7v10', 'M20 10v4'],
  sidebar: ['M4.5 5h15a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5z', 'M9 5v14'],
  projects: ['M4 7h16', 'M5 4h14', 'M4.5 10h15a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10z'],
  artifacts: ['M9 3.5h9.5A1.5 1.5 0 0 1 20 5v9.5', 'M5.5 7.5h9A1.5 1.5 0 0 1 16 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 18.5V9a1.5 1.5 0 0 1 1.5-1.5z'],
  customize: ['M4.5 8h15A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8z', 'M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'],
  share: ['M12 15V4', 'M7.5 8.5L12 4l4.5 4.5', 'M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13'],
  copy: ['M9 9h9.5a1.5 1.5 0 0 1 1.5 1.5V20a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20v-9.5A1.5 1.5 0 0 1 9 9z', 'M16.5 9V5.5A1.5 1.5 0 0 0 15 4H5.5A1.5 1.5 0 0 0 4 5.5V15a1.5 1.5 0 0 0 1.5 1.5H7.5'],
  speaker: ['M4 9.5h3l5-4v13l-5-4H4z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a7.5 7.5 0 0 1 0 11'],
  thumbUp: ['M7 10v10H4V10z', 'M7 10l4-7a2 2 0 0 1 2.5 2.4L12.8 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7'],
  thumbDown: ['M7 14V4H4v10z', 'M7 14l4 7a2 2 0 0 0 2.5-2.4L12.8 15H19a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17.8 4H7'],
  retry: ['M20 12a8 8 0 1 1-2.4-5.7', 'M20 4v4.5h-4.5'],
  back: ['M19 12H5', 'M11 6l-6 6 6 6'],
  forward: ['M5 12h14', 'M13 6l6 6-6 6'],
  reload: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5V9H15'],
  bookmark: ['M6.5 4h11v16l-5.5-4-5.5 4z'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  tune: ['M4 7h10', 'M18 7h2', 'M16 5v4', 'M4 17h4', 'M12 17h8', 'M10 15v4'],
  truck: ['M3 6.5h11v9H3z', 'M14 9.5h3.5l3 3v3H14', 'M7 18.5a1.8 1.8 0 1 0 0-.01', 'M17 18.5a1.8 1.8 0 1 0 0-.01'],
  calendar: ['M5 5.5h14A1.5 1.5 0 0 1 20.5 7v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5z', 'M3.5 10h17', 'M8 3.5v4', 'M16 3.5v4'],
  lock: ['M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5z', 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5'],
  pin: ['M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z', 'M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z'],
  stop: [],
  shield: ['M12 3.5l7 2.8v5.2c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6.3z'],
  inbox: ['M4 13.5l2.2-7.4A1.5 1.5 0 0 1 7.6 5h8.8a1.5 1.5 0 0 1 1.4 1.1l2.2 7.4', 'M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5h-4.5l-1 2h-5l-1-2z'],
};

export type IconName = keyof typeof P;

export const Icon: React.FC<{ name: IconName; size?: number; color?: string; stroke?: number; style?: React.CSSProperties }> = ({
  name,
  size = 16,
  color = 'currentColor',
  stroke = 1.6,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0, ...style }}>
    {name === 'stop' ? <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill={color} /> : null}
    {P[name].map((d, i) => (
      <path key={i} d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </svg>
);
