import { View } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import React from 'react';

// ── Types ────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  grade: string;
  baptismalname?: string;
  parentcontact?: string;
  academicyear?: string;
  portalcode?: string;
}

export interface Assessment {
  id: string;
  name: string;
  subjectname: string;
  grade: string;
  maxscore: number;
  date: string;
}

export interface Teacher {
  id: string;
  name: string;
  accesscode: string;
  assignedgrades?: string[];
  assignedsubjects?: string[];
  cancreateassessments?: boolean;
  canCreateAssessments?: boolean;
}

// ── Grade helpers ──────────────────────────────────────────────
export const GRADE_LABELS: Record<string, string> = {
  '1': '1ኛ ክፍል', '2': '2ኛ ክፍል', '3': '3ኛ ክፍል', '4': '4ኛ ክፍል',
  '5': '5ኛ ክፍል', '6': '6ኛ ክፍል', '7': '7ኛ ክፍል', '8': '8ኛ ክፍል',
  '9': '9ኛ ክፍል', '10': '10ኛ ክፍል', '11': '11ኛ ክፍል', '12': '12ኛ ክፍል',
};

export const fmtGrade = (g: string | number) => GRADE_LABELS[String(g)] ?? `${g}ኛ ክፍል`;

export const normG = (g: any) => {
  if (!g) return '';
  const m = String(g).match(/\d+/);
  return m ? m[0] : String(g).trim();
};

// ── Subject helpers ────────────────────────────────────────────
export const normS = (s: any) => {
  if (!s) return '';
  return String(s).trim().toLowerCase();
};

export const isConduct = (a: any) => {
  const sName = (a.subjectname || '').toLowerCase();
  const aName = (a.name || '').toLowerCase();
  return sName.includes('conduct') || sName.includes('attitude') || aName.includes('conduct') || aName.includes('attitude');
};

// ── Polyfills & Helpers ──────────────────────────────────────────
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ── Pagination helper ──────────────────────────────────────────
export const PAGE_SIZE = 15;
export const paginate = (data: any[], page: number) => data.slice(0, (page + 1) * PAGE_SIZE);

// ── Theme Management ──────────────────────────────────────────
export const THEMES = {
  dark: {
    bg: '#0f172a',
    card: '#1e293b',
    border: 'transparent',
    accent: '#6366f1', // Richer Indigo
    accentMuted: 'rgba(99, 102, 241, 0.15)',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    slate: '#94a3b8',
    text: '#f8fafc',
    muted: '#64748b',
    input: '#1e293b', // Elevated background
    glass: 'rgba(15, 23, 42, 0.7)',
    isDark: true,
  },
  light: {
    bg: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',
    accent: '#3b82f6',
    accentMuted: '#3b82f611',
    green: '#059669',
    amber: '#d97706',
    red: '#dc2626',
    slate: '#64748b',
    text: '#020617',
    muted: '#64748b',
    input: '#f1f5f9',
    glass: 'rgba(255, 255, 255, 0.8)',
    isDark: false,
  },
};

// ── Components ──────────────────────────────────────────────────
export const EthiopianCross = ({ size = 48, color = '#d4af37', style }: { size?: number, color?: string, style?: any }) => (
  <View style={[{ width: size, height: size }, style]}>
    <Svg viewBox="0 0 100 100" width={size} height={size}>
      <Rect x="42" y="42" width="16" height="16" fill="none" stroke={color} strokeWidth="2" />
      <Circle cx="50" cy="50" r="4" fill={color} />
      <Path d="M42 42 L42 20 L30 15 L50 0 L70 15 L58 20 L58 42" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="50" cy="8" r="2.5" fill={color} />
      <Circle cx="35" cy="18" r="2" fill={color} />
      <Circle cx="65" cy="18" r="2" fill={color} />
      <Path d="M42 58 L42 80 L30 85 L50 100 L70 85 L58 80 L58 58" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="50" cy="92" r="2.5" fill={color} />
      <Circle cx="35" cy="82" r="2" fill={color} />
      <Circle cx="65" cy="82" r="2" fill={color} />
      <Path d="M42 42 L20 42 L15 30 L0 50 L15 70 L20 58 L42 58" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="8" cy="50" r="2.5" fill={color} />
      <Circle cx="18" cy="35" r="2" fill={color} />
      <Circle cx="18" cy="65" r="2" fill={color} />
      <Path d="M58 42 L80 42 L85 30 L100 50 L85 70 L80 58 L58 58" fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Circle cx="92" cy="50" r="2.5" fill={color} />
      <Circle cx="82" cy="35" r="2" fill={color} />
      <Circle cx="82" cy="65" r="2" fill={color} />
    </Svg>
  </View>
);
