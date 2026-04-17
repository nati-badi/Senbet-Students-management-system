import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, SafeAreaView, ActivityIndicator, Alert, TextInput, ScrollView, Platform, Modal, Image as RNImage, Linking, Animated, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from 'expo-status-bar';
import dayjs from 'dayjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from './supabase';
import { formatEthiopianDate, formatEthiopianTime, computeEthiopianYear } from './dateUtils';
import { useTranslation } from 'react-i18next';
import './i18n';

// Premium Navigation
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem, DrawerToggleButton } from '@react-navigation/drawer';
import {
  Home, Users, CalendarCheck, BarChart3, AlertTriangle, Settings, LogOut, Moon, Sun, Languages, RefreshCw, TrendingUp, Info, BookOpen, Key, Phone,
  Search, User, ArrowLeft, Eye, EyeOff, Trash2, FileText, Edit, ChevronDown, Check, ChevronRight, Plus, Clock
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';

// ── Extracted Optimized Components ──────────────────────────────
import { DashboardTab, EthiopicClockWidget } from './components/DashboardTab';
import { StudentsTab } from './components/StudentsTab';
import { AttendanceTab } from './components/AttendanceTab';
import { MarksTab } from './components/MarksTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { UrgentMattersTab } from './components/UrgentMattersTab';
import { AssessmentManagementTab } from './components/AssessmentManagementTab';
import { StudentProfileModal } from './components/StudentProfileModal';

// ── Grade helpers ──────────────────────────────────────────────
const GRADE_LABELS: Record<string, string> = {
  '1': '1ኛ ክፍል', '2': '2ኛ ክፍል', '3': '3ኛ ክፍል', '4': '4ኛ ክፍል',
  '5': '5ኛ ክፍል', '6': '6ኛ ክፍል', '7': '7ኛ ክፍል', '8': '8ኛ ክፍል',
  '9': '9ኛ ክፍል', '10': '10ኛ ክፍል', '11': '11ኛ ክፍል', '12': '12ኛ ክፍል',
};
const fmtGrade = (g: string | number) => GRADE_LABELS[String(g)] ?? `${g}ኛ ክፍል`;

// ── Types (matching Supabase lowercase column names as seen in screenshot) ──────────
interface Student {
  id: string;
  name: string;
  grade: string;
  baptismalname?: string;
  parentcontact?: string;
  academicyear?: string;
  portalcode?: string;
}
interface Assessment {
  id: string;
  name: string;
  subjectname: string;
  grade: string;
  maxscore: number;
  date: string;
}
interface Teacher {
  id: string;
  name: string;
  accesscode: string;
  assignedgrades?: string[];
  assignedsubjects?: string[];
  cancreateassessments?: boolean;
  canCreateAssessments?: boolean;
}

// ── Polyfills & Helpers ──────────────────────────────────────────
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ── Theme Management ──────────────────────────────────────────
const THEMES = {
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

// ── Grade helpers ──────────────────────────────────────────────
const normG = (g: any) => {
  if (!g) return '';
  const m = String(g).match(/\d+/);
  return m ? m[0] : String(g).trim();
};

// ── Subject helpers ────────────────────────────────────────────
const normS = (s: any) => {
  if (!s) return '';
  return String(s).trim().toLowerCase();
};

const isConduct = (a: any) => {
  if (!a) return false;
  const sName = (a.subjectname || a.subjectName || '').toLowerCase();
  const aName = (a.name || '').toLowerCase();
  const keywords = ['conduct', 'attitude', 'behaviour', 'behavior', 'ስነ-ምግባር', 'ስነ ምግባር'];
  return keywords.some(kw => sName.includes(kw) || aName.includes(kw));
};


import Svg, { Rect, Circle, Path } from 'react-native-svg';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const EthiopianCross = ({ size = 48, color = '#d4af37', style }: { size?: number, color?: string, style?: any }) => (
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

import { ToastProvider, useToast } from './components/ToastContext';
import { Provider as PaperProvider } from 'react-native-paper';

// ── Pagination helper ──────────────────────────────────────────
const PAGE_SIZE = 15;
const paginate = (data: any[], page: number) => data.slice(0, (page + 1) * PAGE_SIZE);

// ═══════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════

const WebSafeTouchable = ({ children }: any) => {
  if (Platform.OS === 'web') return <>{children}</>;
  return <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>;
};

export default function App() {
  const [isDark, setIsDark] = useState(true);

  return (
    <PaperProvider>
      <ToastProvider themes={THEMES} isDark={isDark}>
        <AppContent isDark={isDark} setIsDark={setIsDark} />
      </ToastProvider>
    </PaperProvider>
  );
}

function AppContent({ isDark, setIsDark }: { isDark: boolean, setIsDark: (v: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [authMode, setAuthMode] = useState<'landing' | 'teacher_login' | 'parent_portal'>('landing');
  const [authLoading, setAuthLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastSyncIso, setLastSyncIso] = useState<string | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);

  const C = isDark ? THEMES.dark : THEMES.light;
  const s = makeStyles(C);

  // Network listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = !!state.isConnected;
      const reachable = state.isInternetReachable === null ? true : !!state.isInternetReachable;
      setIsOnline(connected && reachable);
    });
    return () => unsubscribe();
  }, []);

  // Load Auth, Theme & Cached Data
  useEffect(() => {
    (async () => {
      try {
        const [savedAuth, savedTheme, savedStudents, savedAssessments, savedMarks, savedSubjects, savedSettings, savedLastSync] = await Promise.all([
          AsyncStorage.getItem('senbet_teacher_auth'),
          AsyncStorage.getItem('senbet_theme'),
          AsyncStorage.getItem('cached_students'),
          AsyncStorage.getItem('cached_assessments'),
          AsyncStorage.getItem('cached_marks'),
          AsyncStorage.getItem('cached_subjects'),
          AsyncStorage.getItem('cached_settings'),
          AsyncStorage.getItem('last_sync_time'),
          AsyncStorage.getItem('last_sync_iso'),
        ]);

        if (savedAuth) setTeacher(JSON.parse(savedAuth));
        if (savedTheme) setIsDark(savedTheme === 'dark');
        if (savedStudents) setStudents(JSON.parse(savedStudents));
        if (savedAssessments) setAssessments(JSON.parse(savedAssessments));
        if (savedMarks) setMarks(JSON.parse(savedMarks));

        try { if (savedSubjects) setSubjects(JSON.parse(savedSubjects)); } catch (e) { }
        try { if (savedSettings) setSettings(JSON.parse(savedSettings)); } catch (e) { }

        if (await AsyncStorage.getItem('cached_attendance')) setAttendance(JSON.parse(await AsyncStorage.getItem('cached_attendance') || '[]'));
        if (savedLastSync) setLastSync(savedLastSync);
        if (await AsyncStorage.getItem('last_sync_iso')) setLastSyncIso(await AsyncStorage.getItem('last_sync_iso'));

      } catch (e) {
        console.error('Initial load error', e);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('senbet_theme', next ? 'dark' : 'light');
  };

  const toggleLanguage = async () => {
    const next = i18n.language === 'en' ? 'am' : 'en';
    await i18n.changeLanguage(next);
    await AsyncStorage.setItem('app_language', next);
  };

  const syncData = useCallback(async (isBackground = false) => {
    if (!teacher || !isOnline) return;
    if (!isBackground) setSyncing(true);

    try {
      const { data: tRes, error: tErr } = await supabase
        .from('teachers')
        .select('id, name, accesscode, assignedgrades, assignedsubjects, cancreateassessments')
        .eq('id', teacher.id)
        .maybeSingle();

      if (tErr) console.warn('Teacher fetch error:', tErr);
      else if (!tRes) {
        setTeacher(null);
        await AsyncStorage.removeItem('senbet_teacher_auth');
        return;
      }

      if (tRes && JSON.stringify(tRes) !== JSON.stringify(teacher)) {
        setTeacher(tRes);
        await AsyncStorage.setItem('senbet_teacher_auth', JSON.stringify(tRes));
      }

      const syncAnchor = (lastSyncIso && students.length === 0) ? null : lastSyncIso;
      const stQ = supabase.from('students').select('id, name, grade, baptismalname, parentcontact, academicyear, portalcode, updated_at');
      const asQ = supabase.from('assessments').select('id, name, subjectname, grade, maxscore, date, updated_at');
      const maQ = supabase.from('marks').select('id, score, subject, semester, studentid, assessmentid, assessmentdate, last_modified_by, updated_at');
      const atQ = supabase.from('attendance').select('id, date, status, semester, studentid, last_modified_by, updated_at');
      const suQ = supabase.from('subjects').select('id, name, semester, updated_at');
      const seQ = supabase.from('settings').select('key, value, updated_at');
      const deQ = supabase.from('deleted_records').select('*');

      if (syncAnchor) {
        stQ.gt('updated_at', syncAnchor); asQ.gt('updated_at', syncAnchor); maQ.gt('updated_at', syncAnchor);
        atQ.gt('updated_at', syncAnchor); suQ.gt('updated_at', syncAnchor); seQ.gt('updated_at', syncAnchor);
        deQ.gt('deleted_at', syncAnchor);
      }

      const [sRes, aRes, mRes, attRes, subRes, setRes, delRes] = await Promise.allSettled([
        stQ.order('name'), asQ.order('name'), maQ, atQ, suQ, seQ, deQ
      ]);

      const merge = (oldData: any[], newData: any[] | null) => {
        if (!newData || newData.length === 0) return oldData;
        const map = new Map(oldData.map(item => [item.id || item.key, item]));
        newData.forEach(item => {
          const id = item.id || item.key;
          const existing = map.get(id);
          if (!existing || !existing.updated_at || (item.updated_at && item.updated_at > existing.updated_at)) {
            map.set(id, item);
          }
        });
        return Array.from(map.values());
      };

      const deletions = (delRes.status === 'fulfilled' ? delRes.value.data : []) || [];
      const applySync = (prev: any[], newData: any[] | null, tableName: string) => {
        let merged = merge(prev, newData);
        if (deletions.length > 0) {
          const tableDeletions = deletions.filter((d: any) => d.table_name === tableName);
          if (tableDeletions.length > 0) {
            const delIds = new Set(tableDeletions.map((d: any) => d.record_id));
            merged = merged.filter(r => !delIds.has(r.id));
          }
        }
        return merged;
      };

      setStudents(prev => {
        const next = applySync(prev, (sRes.status === 'fulfilled' ? sRes.value.data : null), 'students');
        AsyncStorage.setItem('cached_students', JSON.stringify(next));
        return next;
      });
      setAssessments(prev => {
        const next = applySync(prev, (aRes.status === 'fulfilled' ? aRes.value.data : null), 'assessments');
        AsyncStorage.setItem('cached_assessments', JSON.stringify(next));
        return next;
      });
      setMarks(prev => {
        const next = applySync(prev, (mRes.status === 'fulfilled' ? mRes.value.data : null), 'marks');
        AsyncStorage.setItem('cached_marks', JSON.stringify(next));
        return next;
      });
      setAttendance(prev => {
        const next = applySync(prev, (attRes.status === 'fulfilled' ? attRes.value.data : null), 'attendance');
        AsyncStorage.setItem('cached_attendance', JSON.stringify(next));
        return next;
      });
      setSubjects(prev => {
        const next = applySync(prev, (subRes.status === 'fulfilled' ? subRes.value.data : null), 'subjects');
        AsyncStorage.setItem('cached_subjects', JSON.stringify(next));
        return next;
      });

      if (setRes.status === 'fulfilled' && setRes.value.data) {
        const settingsData = setRes.value.data;
        setSettings(prev => {
          const next = { ...prev };
          settingsData.forEach((r: any) => { next[r.key] = r.value; });
          AsyncStorage.setItem('cached_settings', JSON.stringify(next));
          return next;
        });
      }

      const allNew = [
        ...(sRes.status === 'fulfilled' && (sRes as any).value?.data ? (sRes as any).value.data : []),
        ...(aRes.status === 'fulfilled' && (aRes as any).value?.data ? (aRes as any).value.data : []),
        ...(mRes.status === 'fulfilled' && (mRes as any).value?.data ? (mRes as any).value.data : []),
        ...(attRes.status === 'fulfilled' && (attRes as any).value?.data ? (attRes as any).value.data : []),
        ...(subRes.status === 'fulfilled' && (subRes as any).value?.data ? (subRes as any).value.data : []),
        ...(setRes.status === 'fulfilled' && (setRes as any).value?.data ? (setRes as any).value.data : []),
      ];

      let nextAnchor = lastSyncIso;
      if (allNew.length > 0) {
        const maxAt = allNew.reduce((max, r) => (r.updated_at && r.updated_at > max) ? r.updated_at : max, '');
        if (maxAt) nextAnchor = maxAt;
      }
      if (!nextAnchor) nextAnchor = new Date().toISOString();

      const now = formatEthiopianTime(new Date());
      setLastSync(now);
      setLastSyncIso(nextAnchor);
      await AsyncStorage.setItem('last_sync_time', now);
      await AsyncStorage.setItem('last_sync_iso', nextAnchor);

      if (!isBackground) showToast('✅ ' + t('common.syncComplete', 'Sync complete'), 'success');
    } catch (err: any) {
      console.error('Sync error', err);
      if (!isBackground) showToast('⚠️ ' + t('common.syncFailed', 'Sync failed'), 'error');
    } finally {
      if (!isBackground) setSyncing(false);
    }
  }, [teacher, isOnline, lastSyncIso, t, students, assessments, marks, attendance, subjects, settings, showToast]);

  useEffect(() => {
    if (teacher) syncData(true);
  }, [teacher?.id]);

  const handleLogin = async (t: Teacher) => {
    setLastSyncIso(null);
    await AsyncStorage.removeItem('last_sync_iso');
    setTeacher(t);
    await AsyncStorage.setItem('senbet_teacher_auth', JSON.stringify(t));
  };

  const handleLogout = async () => {
    setTeacher(null);
    setStudents([]); setAssessments([]); setMarks([]); setAttendance([]); setSubjects([]); setSettings({});
    setLastSync(null); setLastSyncIso(null);
    await AsyncStorage.multiRemove([
      'senbet_teacher_auth', 'cached_students', 'cached_assessments', 'cached_marks', 'cached_attendance', 'last_sync_time', 'last_sync_iso', 'cached_subjects', 'cached_settings'
    ]);
  };

  if (authLoading) return <View style={[s.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color={C.accent} /></View>;

  if (!teacher) {
    if (authMode === 'parent_portal') {
      return <ParentPortal isDark={isDark} onBack={() => setAuthMode('landing')} toggleTheme={toggleTheme} toggleLanguage={toggleLanguage} isOnline={isOnline} />;
    }
    if (authMode === 'teacher_login') {
      return <TeacherLogin onLogin={handleLogin} onBack={() => setAuthMode('landing')} isDark={isDark} toggleTheme={toggleTheme} toggleLanguage={toggleLanguage} isOnline={isOnline} />;
    }
    return <LandingPage onSelectMode={(m: 'teacher' | 'parent') => setAuthMode(m === 'teacher' ? 'teacher_login' : 'parent_portal')} isDark={isDark} toggleTheme={toggleTheme} toggleLanguage={toggleLanguage} />;
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
        <Drawer.Navigator
          drawerContent={(props) => {
            const activeRoute = props.state.routes[props.state.index];
            const activeName = activeRoute.name;
            const nestedScreen = (activeRoute.params as any)?.screen;

            const isDashboard = activeName === 'Main' && (nestedScreen === 'Dashboard' || !nestedScreen);
            const isAnalytics = activeName === 'Analytics';
            const isUrgent = activeName === 'Urgent';
            const isAssessments = activeName === 'AssessmentsMgmt';

            return (
              <DrawerContentScrollView {...props} style={{ backgroundColor: C.bg }}>
                <View style={{ padding: 24, paddingBottom: 32, alignItems: 'center' }}>
                  <View style={{ width: 100, height: 100, borderRadius: 24, padding: 4, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 20 }}>
                    <RNImage source={require('./assets/logo.png')} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="contain" />
                  </View>
                  <Text style={{ color: C.text, fontWeight: '900', fontSize: 16, textAlign: 'center', lineHeight: 22 }}>{t('app.title')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: C.accent + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? C.green : C.red, marginRight: 6 }} />
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>{teacher.name}</Text>
                  </View>
                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: C.muted, fontSize: 10, fontWeight: '600' }}>
                      {isOnline ? t('common.online') : t('common.offline')} • {t('common.lastSynced')}: {lastSync || t('common.never')}
                    </Text>
                  </View>
                </View>

                <View style={{ padding: 16, paddingBottom: 0 }}>
                  <TouchableOpacity
                    onPress={() => props.navigation.navigate('Main', { screen: 'Dashboard' })}
                    style={[s.sidebarItem, isDashboard && { backgroundColor: C.accent + '15' }]}
                  >
                    <View style={[s.sidebarIcon, { backgroundColor: C.accent + (isDashboard ? '20' : '10') }]}><Home size={18} color={isDashboard ? C.accent : C.slate} /></View>
                    <Text style={[s.sidebarText, isDashboard && { color: C.accent, fontWeight: '700' }]}>{t('dashboard.title')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => props.navigation.navigate('Analytics')}
                    style={[s.sidebarItem, isAnalytics && { backgroundColor: C.accent + '15' }]}
                  >
                    <View style={[s.sidebarIcon, { backgroundColor: C.accent + (isAnalytics ? '20' : '10') }]}><TrendingUp size={18} color={isAnalytics ? C.accent : C.slate} /></View>
                    <Text style={[s.sidebarText, isAnalytics && { color: C.accent, fontWeight: '700' }]}>{t('teacher.analytics')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => props.navigation.navigate('Urgent')}
                    style={[s.sidebarItem, isUrgent && { backgroundColor: C.amber + '15' }]}
                  >
                    <View style={[s.sidebarIcon, { backgroundColor: C.amber + (isUrgent ? '20' : '10') }]}><AlertTriangle size={18} color={isUrgent ? C.amber : C.slate} /></View>
                    <Text style={[s.sidebarText, isUrgent && { color: C.amber, fontWeight: '700' }]}>{t('teacher.urgent')}</Text>
                  </TouchableOpacity>

                  {!!(teacher?.cancreateassessments || teacher?.canCreateAssessments) && (
                    <TouchableOpacity
                      onPress={() => props.navigation.navigate('AssessmentsMgmt')}
                      style={[s.sidebarItem, isAssessments && { backgroundColor: C.accent + '15' }]}
                    >
                      <View style={[s.sidebarIcon, { backgroundColor: C.accent + (isAssessments ? '20' : '10') }]}><FileText size={18} color={isAssessments ? C.accent : C.slate} /></View>
                      <Text style={[s.sidebarText, isAssessments && { color: C.accent, fontWeight: '700' }]}>{t('teacher.assessments')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ padding: 24, marginTop: 'auto', borderTopWidth: 1, borderTopColor: C.border }}>
                  <TouchableOpacity onPress={toggleLanguage} style={s.sidebarItem}>
                    <View style={[s.sidebarIcon, { backgroundColor: C.accent + '10' }]}><Languages size={18} color={C.accent} /></View>
                    <Text style={s.sidebarText}>{i18n.language === 'en' ? 'አማርኛ (Amharic)' : 'እንግሊዝኛ (English)'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleTheme} style={s.sidebarItem}>
                    <View style={[s.sidebarIcon, { backgroundColor: C.amber + '10' }]}>{isDark ? <Sun size={18} color={C.amber} /> : <Moon size={18} color={C.slate} />}</View>
                    <Text style={s.sidebarText}>{isDark ? t('common.lightMode') : t('common.darkMode')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { syncData(); props.navigation.closeDrawer(); }} style={s.sidebarItem}>
                    <View style={[s.sidebarIcon, { backgroundColor: C.green + '10' }]}><RefreshCw size={18} color={C.green} /></View>
                    <Text style={[s.sidebarText, { flex: 1 }]}>{t('common.sync')}</Text>
                    {syncing && <ActivityIndicator size="small" color={C.accent} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleLogout} style={[s.sidebarItem, { marginTop: 24 }]}>
                    <View style={[s.sidebarIcon, { backgroundColor: C.red + '10' }]}><LogOut size={18} color={C.red} /></View>
                    <Text style={[s.sidebarText, { color: C.red, fontWeight: '800' }]}>{t('common.logout')}</Text>
                  </TouchableOpacity>
                </View>
              </DrawerContentScrollView>
            )
          }}
          screenOptions={({ navigation, route }) => ({
            headerLeft: () => {
              if (route.name !== 'Main') {
                return (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Main')}
                    style={{ marginLeft: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center' }}
                  >
                    <ArrowLeft size={20} color={C.accent} strokeWidth={3} />
                  </TouchableOpacity>
                );
              }
              return <DrawerToggleButton tintColor={C.accent} />;
            },
            headerStyle: {
              backgroundColor: C.bg,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
              height: Platform.OS === 'android' ? 64 : undefined,
            },
            headerTitleStyle: {
              color: C.text,
              fontWeight: '900',
              fontSize: 18,
              letterSpacing: -0.5,
              marginTop: Platform.OS === 'android' ? 8 : 0
            },
            headerTintColor: C.accent,
            drawerActiveBackgroundColor: C.accent + '15',
            drawerActiveTintColor: C.accent,
            drawerInactiveTintColor: C.muted,
            drawerLabelStyle: { fontWeight: '700', fontSize: 14 },
            drawerStyle: { width: 280, borderRightWidth: 0 },
          })}
        >
          <Drawer.Screen
            name="Main"
            options={{
              title: t('app.title'),
              drawerIcon: ({ color }) => <Home size={18} color={color} />,
              drawerLabel: t('dashboard.title')
            }}
          >
            {(props: any) => (
              <Tab.Navigator
                screenOptions={({ route }) => ({
                  headerShown: false,
                  tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: C.border,
                    backgroundColor: C.card,
                    height: Platform.OS === 'ios' ? 88 : 64,
                    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                    paddingTop: 8,
                    elevation: 0,
                    shadowOpacity: 0
                  },
                  tabBarActiveTintColor: C.accent,
                  tabBarInactiveTintColor: C.muted,
                  tabBarShowLabel: false,
                  tabBarIcon: ({ color, focused }) => {
                    const size = focused ? 24 : 20;
                    if (route.name === 'Dashboard') return <Home size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
                    if (route.name === 'Students') return <Users size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
                    if (route.name === 'Attendance') return (
                      <View style={{ opacity: 0.4 }}>
                        <CalendarCheck size={size} color={color} strokeWidth={focused ? 2.5 : 2} />
                      </View>
                    );
                    if (route.name === 'Marks') return <BarChart3 size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
                    return null;
                  }
                })}
              >
                <Tab.Screen name="Dashboard">{(props: any) => <DashboardTab {...props} teacher={teacher!} students={students} assessments={assessments} marks={marks} attendance={attendance} subjects={subjects} settings={settings} C={C} s={s} setTab={(t: any) => props.navigation.navigate(t)} onSync={() => syncData()} isSyncing={syncing} isOnline={isOnline} lastSync={lastSync} />}</Tab.Screen>
                <Tab.Screen name="Students">{(props: any) => <StudentsTab {...props} teacher={teacher!} students={students} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} />}</Tab.Screen>
                <Tab.Screen
                  name="Attendance"
                  listeners={{
                    tabPress: (e) => {
                      e.preventDefault();
                      showToast('📅 ' + t('common.comingSoon', 'Coming Soon'), 'info');
                    },
                  }}
                >
                  {(props: any) => <AttendanceTab {...props} teacher={teacher!} students={students} attendanceData={attendance} setAttendanceData={setAttendance} onRefresh={() => syncData()} C={C} s={s} settings={settings} />}
                </Tab.Screen>
                <Tab.Screen name="Marks">{(props: any) => <MarksTab {...props} teacher={teacher!} students={students} assessments={assessments} marksData={marks} setMarksData={setMarks} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} settings={settings} subjects={subjects} />}</Tab.Screen>
              </Tab.Navigator>
            )}
          </Drawer.Screen>
          <Drawer.Screen name="Analytics" options={{ title: t('teacher.analytics'), drawerIcon: ({ color }) => <TrendingUp size={18} color={color} />, drawerLabel: t('teacher.analytics') }}>
            {(props: any) => <AnalyticsTab {...props} teacher={teacher!} students={students} assessments={assessments} marks={marks} C={C} s={s} onRefresh={() => syncData()} settings={settings} subjects={subjects} />}
          </Drawer.Screen>
          <Drawer.Screen name="Urgent" options={{ title: t('teacher.urgent'), drawerIcon: ({ color }) => <AlertTriangle size={18} color={color} />, drawerLabel: t('teacher.urgent') }}>
            {(props: any) => <UrgentMattersTab {...props} teacher={teacher!} students={students} assessments={assessments} marksData={marks} subjects={subjects} settings={settings} C={C} s={s} onRefresh={() => syncData()} />}
          </Drawer.Screen>
          {!!(teacher!.cancreateassessments || teacher!.canCreateAssessments) && (
            <Drawer.Screen name="AssessmentsMgmt" options={{ title: 'Assessments', drawerIcon: ({ color }) => <FileText size={18} color={color} />, drawerLabel: 'Assessments' }}>
              {(props: any) => <AssessmentManagementTab {...props} teacher={teacher!} assessments={assessments} subjects={subjects} settings={settings} C={C} s={s} onRefresh={() => syncData()} />}
            </Drawer.Screen>
          )}
        </Drawer.Navigator>
      </NavigationContainer>

      <StudentProfileModal
        student={profileStudent}
        onClose={() => setProfileStudent(null)}
        assessments={assessments}
        marks={marks}
        allStudents={students}
        subjects={subjects}
        settings={settings}
        C={C}
        s={s}
      />
    </SafeAreaView>
  );
}

// ── Auth Screens (extracted to components/AuthScreens.tsx) ──────────────────
// LandingPage, ParentPortal, TeacherLogin have been moved to ./components/AuthScreens.tsx
// They are still referenced inline in App.tsx above (lines ~451-458) as local functions
// which shadow the extracted versions. We keep the original definitions here for now
// to avoid breaking the existing prop signatures until a full integration pass.

function LandingPage({ onSelectMode, isDark, toggleTheme, toggleLanguage }: { onSelectMode: (mode: 'teacher' | 'parent') => void, isDark: boolean, toggleTheme: () => void, toggleLanguage: () => void }) {
  const { t, i18n } = useTranslation();
  const C = isDark ? THEMES.dark : THEMES.light;
  const s = makeStyles(C);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      <View style={{ position: 'absolute', top: 60, right: 24, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 100 }}>
        <TouchableOpacity onPress={toggleLanguage} style={{ backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, elevation: 2 }}>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 13 }}>{i18n.language === 'en' ? 'አማ' : 'EN'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleTheme} style={{ padding: 8 }}><Text style={{ fontSize: 28 }}>{isDark ? '🌙' : '☀️'}</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 100 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{ width: 120, height: 120, borderRadius: 30, padding: 6, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, marginBottom: 24 }}>
            {/* @ts-ignore */}
            <RNImage source={require('./assets/logo.png')} style={{ width: '100%', height: '100%', borderRadius: 24 }} resizeMode="contain" />
          </View>
          <Text style={[s.loginTitle, { fontSize: 28 }]}>በግ/ደ/አ/ቅ/አርሴማ</Text>
          <Text style={[s.loginSub, { fontSize: 16, marginTop: 4 }]}>ፍኖተ ብርሃን ሰ/ቤት</Text>
        </View>

        <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 32, fontWeight: '700', fontSize: 15 }}>{t('app.welcomeMessage', 'Welcome! Please select your portal')}</Text>

        <TouchableOpacity
          style={[s.loginBtn, { backgroundColor: C.accent, marginBottom: 20, flexDirection: 'row', justifyContent: 'center', gap: 12, height: 60, borderRadius: 16 }]}
          onPress={() => onSelectMode('teacher')}
        >
          <Key size={22} color="#fff" />
          <Text style={[s.loginBtnText, { fontSize: 18 }]}>{t('app.teacherPortal', 'Teacher Portal')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.loginBtn, { backgroundColor: 'transparent', borderWidth: 2, borderColor: C.accent, flexDirection: 'row', justifyContent: 'center', gap: 12, height: 60, borderRadius: 16 }]}
          onPress={() => onSelectMode('parent')}
        >
          <Users size={22} color={C.accent} />
          <Text style={[s.loginBtnText, { color: C.accent, fontSize: 18 }]}>{t('parent.title', 'Parent Portal')}</Text>
        </TouchableOpacity>

        <Text style={{ color: C.muted, textAlign: 'center', marginTop: 40, marginBottom: 20, fontSize: 12 }}>v2.4.0 • ©{new Date().getFullYear()}</Text>
      </ScrollView>
    </View>
  );
}
function ParentPortal({ isDark, onBack, toggleTheme, toggleLanguage, isOnline }: { isDark: boolean, onBack: () => void, toggleTheme: () => void, toggleLanguage: () => void, isOnline: boolean }) {
  const { t, i18n } = useTranslation();
  const C = isDark ? THEMES.dark : THEMES.light;
  const s = makeStyles(C);

  const [studentName, setStudentName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const accessCodeRef = useRef<any>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [marks, setMarks] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  const doSearch = async () => {
    if (!isOnline) {
      return Alert.alert(t('common.offline', 'Offline'), t('common.offlineMessage', 'Please check your internet connection and try again.'));
    }
    if (!studentName.trim() || !accessCode.trim()) {
      return Alert.alert(t('common.error', 'Error'), t('parent.loginFieldsRequired', 'Both Student Name and Access Code are required.'));
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .ilike('name', studentName.trim())
        .eq('portalcode', accessCode.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) return Alert.alert(t('parent.notFound', 'Student Not Found'), t('parent.loginFailed', 'Incorrect name or portal access code. Please try again.'));

      setStudent(data);

      const [mRes, aRes, attRes] = await Promise.all([
        supabase.from('marks').select('*').eq('studentid', data.id),
        supabase.from('assessments').select('*').eq('grade', data.grade),
        supabase.from('attendance').select('*').eq('studentid', data.id).order('date', { ascending: false })
      ]);

      setMarks(mRes.data || []);
      setAssessments(aRes.data || []);
      setAttendance(attRes.data || []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TouchableOpacity onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
          <ArrowLeft size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{t('parent.title', 'Parent Portal')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {!student ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <WebSafeTouchable>
            <ScrollView
              style={{ flex: 1, backgroundColor: C.bg }}
              contentContainerStyle={{ padding: 24, paddingBottom: 200 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={{ alignItems: 'center', marginBottom: 40 }}>
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center' }}>
                  <Search size={48} color={C.accent} />
                </View>
                <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginTop: 20, textAlign: 'center' }}>{t('parent.searchTitle', 'Find Student Results')}</Text>
                <Text style={{ color: C.muted, textAlign: 'center', marginTop: 10, fontSize: 15, lineHeight: 22 }}>{t('parent.searchDesc', 'Enter the student full name or their ID/Portal code to view academic records.')}</Text>
              </View>

              <View style={[s.loginCard, { padding: 24 }]}>
                <Text style={s.inputLabel}>{t('parent.studentFullName', 'Student Full Name')}</Text>
                <TextInput
                  style={[s.loginInput, { height: 56, marginBottom: 16 }]}
                  placeholder={t('parent.namePlaceholder', 'e.g. Abebe Kebede')}
                  placeholderTextColor={C.muted}
                  value={studentName}
                  onChangeText={setStudentName}
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => accessCodeRef.current?.focus()}
                />

                <Text style={s.inputLabel}>{t('parent.portalAccessCode', 'Portal Access Code')}</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    ref={accessCodeRef}
                    style={[s.loginInput, { height: 56, paddingRight: 50 }]}
                    placeholder="------"
                    keyboardType="numeric"
                    maxLength={6}
                    placeholderTextColor={C.muted}
                    value={accessCode}
                    onChangeText={setAccessCode}
                    secureTextEntry={!showCode}
                    returnKeyType="search"
                    onSubmitEditing={doSearch}
                  />
                  <TouchableOpacity
                    onPress={() => setShowCode(!showCode)}
                    style={{ position: 'absolute', right: 15, top: 15 }}
                  >
                    {showCode ? <EyeOff size={24} color={C.muted} /> : <Eye size={24} color={C.muted} />}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[s.loginBtn, { marginTop: 24, height: 60, borderRadius: 16, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }]} onPress={doSearch} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={[s.loginBtnText, { fontSize: 17 }]}>{t('parent.viewResults', 'View Student Results')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </WebSafeTouchable>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
          <View style={[s.dashboardCard, { marginBottom: 24, alignItems: 'center', padding: 24 }]}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <User size={44} color={C.accent} />
            </View>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>{student.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
              <View style={{ backgroundColor: C.accent + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
                <Text style={{ color: C.accent, fontSize: 13, fontWeight: '800' }}>{fmtGrade(student.grade)}</Text>
              </View>
              <Text style={{ color: C.muted }}>•</Text>
              <Text style={{ color: C.muted, fontWeight: '700', fontSize: 13 }}>ID: {student.portalcode || student.id.slice(0, 8)}</Text>
            </View>

            <TouchableOpacity
              style={{ marginTop: 28, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: C.accent + '10' }}
              onPress={() => setStudent(null)}
            >
              <Text style={{ color: C.accent, fontWeight: '900', fontSize: 14 }}>{t('parent.searchAnother', 'Search Another Student')}</Text>
            </TouchableOpacity>
          </View>

          {/* Attendance Summary */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
              <CalendarCheck size={20} color={C.muted} />
              <Text style={[s.sectionTitle, { marginBottom: 0, color: C.muted }]}>{t('profile.attendance', 'Attendance')}</Text>
              <View style={{ backgroundColor: C.amber + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ color: C.amber, fontSize: 10, fontWeight: '900' }}>COMING SOON</Text>
              </View>
            </View>

            <View style={[s.dashboardCard, { padding: 16, opacity: 0.6 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, filter: 'blur(3px)' }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: C.accent, fontSize: 24, fontWeight: '900' }}>—%</Text>
                  <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Attendance Rate</Text>
                </View>
                <View style={{ width: 1, height: '80%', backgroundColor: C.border, alignSelf: 'center' }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: C.red, fontSize: 24, fontWeight: '900' }}>—</Text>
                  <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Absences</Text>
                </View>
                <View style={{ width: 1, height: '80%', backgroundColor: C.border, alignSelf: 'center' }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: C.amber, fontSize: 24, fontWeight: '900' }}>—</Text>
                  <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Lates</Text>
                </View>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16, alignItems: 'center' }}>
                <Clock size={20} color={C.muted} opacity={0.5} />
                <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>{t('parent.attendanceSoon', 'Detailed attendance history integration coming soon.')}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
            <BarChart3 size={20} color={C.accent} />
            <Text style={[s.sectionTitle, { marginBottom: 0 }]}>{t('parent.results', 'Academic Results')}</Text>
          </View>

          {assessments.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Info size={40} color={C.muted} opacity={0.5} />
              <Text style={[s.empty, { marginTop: 12 }]}>{t('parent.noAssessments', 'No assessments recorded yet.')}</Text>
            </View>
          ) : (
            Object.entries(
              assessments.reduce((acc, a) => {
                if (!acc[a.subjectname]) acc[a.subjectname] = [];
                acc[a.subjectname].push(a);
                return acc;
              }, {} as Record<string, Assessment[]>)
            ).map(([subject, subjectAssessments]) => (
              <View key={subject} style={{ marginBottom: 20 }}>
                <Text style={{ color: C.muted, fontSize: 13, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{subject}</Text>
                {subjectAssessments.map(a => {
                  const mark = marks.find(m => m.assessmentid === a.id);
                  return (
                    <View key={a.id} style={[s.studentCard, { justifyContent: 'space-between', padding: 18, marginBottom: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.studentName, { fontSize: 15 }]}>{a.name}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', backgroundColor: C.bg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, minWidth: 70 }}>
                        <Text style={{ color: mark ? C.accent : C.muted, fontSize: 22, fontWeight: '900' }}>{mark ? mark.score : '-'}</Text>
                        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', marginTop: -4 }}>/ {a.maxscore}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}

          <View style={{ marginTop: 24, padding: 24, backgroundColor: C.card, borderRadius: 24, alignItems: 'center' }}>
            <CalendarCheck size={36} color={C.muted} opacity={0.3} />
            <Text style={{ color: C.muted, textAlign: 'center', marginTop: 16, fontWeight: '700', fontSize: 14, lineHeight: 22 }}>{t('parent.attendanceSoon', 'Detailed attendance history integration coming soon.')}</Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function TeacherLogin({ onLogin, onBack, isDark, toggleTheme, toggleLanguage, isOnline }: { onLogin: (t: Teacher) => void, onBack: () => void, isDark: boolean, toggleTheme: () => void, toggleLanguage: () => void, isOnline: boolean }) {
  const { t, i18n } = useTranslation();
  const C = isDark ? THEMES.dark : THEMES.light;
  const s = makeStyles(C);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const accessCodeRef = useRef<any>(null);

  const doLogin = async () => {
    setErrorMsg('');
    if (!isOnline) {
      setErrorMsg(t('common.offlineMessage', 'Please check your internet connection and try again.'));
      return;
    }
    if (!name.trim() || !code.trim()) {
      setErrorMsg(t('auth.missingInfo', 'Name and access code are required.'));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .ilike('name', name.trim())
        .eq('accesscode', code.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErrorMsg(t('auth.invalidLogin', 'Invalid name or access code.'));
        return;
      }

      onLogin(data);
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.loginFailed', 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      <View style={{ position: 'absolute', top: 32, right: 24, zIndex: 100 }}>
        <TouchableOpacity onPress={toggleTheme} style={{ padding: 8 }}><Text style={{ fontSize: 24 }}>{isDark ? '🌙' : '☀️'}</Text></TouchableOpacity>
      </View>
      <View style={{ position: 'absolute', top: 32, left: 24, zIndex: 100 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, elevation: 2 }}>
          <ArrowLeft size={22} color={C.text} />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        enabled={Platform.OS !== 'web'}
      >
        <WebSafeTouchable>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 24, paddingTop: 96, paddingBottom: 250 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            scrollEnabled={true}
            bounces={true}
          >
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View style={{ width: 104, height: 104, borderRadius: 26, padding: 6, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6, marginBottom: 20 }}>
                {/* @ts-ignore */}
                <RNImage source={require('./assets/logo.png')} style={{ width: '100%', height: '100%', borderRadius: 22 }} resizeMode="contain" />
              </View>
              <Text style={[s.loginTitle, { fontSize: 26 }]}>በግ/ደ/አ/ቅ/አርሴማ</Text>
              <Text style={[s.loginSub, { fontSize: 16, marginTop: 4 }]}>ፍኖተ ብርሃን ሰ/ቤት</Text>
            </View>

            <View style={s.loginCard}>
              {errorMsg ? (
                <View style={{ backgroundColor: C.red + '15', padding: 14, borderRadius: 14, marginBottom: 24 }}>
                  <Text style={{ color: C.red, fontSize: 13, textAlign: 'center', fontWeight: '800' }}>{errorMsg}</Text>
                </View>
              ) : null}

              <Text style={s.inputLabel}>{t('teacher.name', 'Full Name')}</Text>
              <TextInput
                style={s.loginInput}
                value={name}
                onChangeText={(text) => { setName(text); setErrorMsg(''); }}
                placeholder="e.g. Abebe Kebede"
                placeholderTextColor={C.muted}
                returnKeyType="next"
                onSubmitEditing={() => accessCodeRef.current?.focus()}
              />

              <Text style={s.inputLabel}>{t('teacher.accessCode', 'Access Code')}</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  ref={accessCodeRef}
                  style={[s.loginInput, { paddingRight: 50 }]}
                  value={code}
                  onChangeText={(text) => { setCode(text); setErrorMsg(''); }}
                  secureTextEntry={!showCode}
                  placeholder="6-digit code"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  maxLength={6}
                  returnKeyType="go"
                  onSubmitEditing={doLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowCode(!showCode)}
                  style={{ position: 'absolute', right: 15, top: 12 }}
                >
                  {showCode ? <EyeOff size={24} color={C.muted} /> : <Eye size={24} color={C.muted} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[s.loginBtn, { marginTop: 32, height: 62, borderRadius: 18, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }]} onPress={doLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={[s.loginBtnText, { fontSize: 17, fontWeight: '800' }]}>{t('teacher.login', 'Login')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </WebSafeTouchable>
      </KeyboardAvoidingView>
    </View>
  );
}


// Inline component definitions removed.
// Extracted to ./components/ with React.memo + useMemo optimizations:
//   EthiopicClockWidget, DashboardTab, StudentsTab, AttendanceTab,
//   MarksTab, AnalyticsTab, UrgentMattersTab, AssessmentManagementTab,
//   StudentProfileModal

function makeStyles(C: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 36 : 0 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
    loginRoot: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 24 },
    loginTitle: { color: C.text, fontSize: 32, fontWeight: '800', textAlign: 'center' },
    loginSub: { color: C.accent, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 32 },
    loginCard: { backgroundColor: C.card, borderRadius: 24, padding: 24 },
    inputLabel: { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
    loginInput: { backgroundColor: C.input, color: C.text, borderRadius: 12, padding: 14, fontSize: 16 },
    loginBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    headerTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
    headerSub: { color: C.muted, fontSize: 13, marginTop: 2 },
    logoutBtn: { backgroundColor: C.red + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    logoutBtnText: { color: C.red, fontSize: 14, fontWeight: '700' },
    dashboardCard: { backgroundColor: C.card, borderRadius: 20, padding: 20 },
    dashboardAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 18, borderRadius: 20, marginBottom: 14 },
    tabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: C.card, paddingVertical: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
    searchInput: { margin: 16, marginBottom: 0, backgroundColor: C.card, color: C.text, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
    studentCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
    empty: { color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },
    gradeChip: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
    gradeChipActive: { backgroundColor: C.accent },
    gradeChipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
    gradeChipTextActive: { color: '#fff' },
    attendanceRow: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    markRow: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
    glassFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 32 : 20, paddingTop: 16 },
    glassBtn: { backgroundColor: C.accent, borderRadius: 16, padding: 18, alignItems: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
    actionBtn: { flex: 1, backgroundColor: C.accentMuted, padding: 12, borderRadius: 12, alignItems: 'center', gap: 6 },
    actionBtnText: { color: C.accent, fontSize: 12, fontWeight: '700' },
    markInput: { backgroundColor: C.input, color: C.text, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, width: 100, textAlign: 'right', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: C.border },
    maxScoreBar: { backgroundColor: C.accent + '15', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: C.accent + '44' },
    issueCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
    issueRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
    issueText: { color: C.text, fontSize: 14, fontWeight: '600' },
    issueSub: { color: C.muted, fontSize: 13, marginBottom: 16 },
    issueTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: C.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border },
    modalTitle: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
    modalSub: { color: C.muted, fontSize: 14, marginBottom: 20 },
    modalBtn: { flex: 1, backgroundColor: C.accent, borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    sidebarItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4 },
    sidebarIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.border + '33', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    sidebarText: { color: C.text, fontSize: 15, fontWeight: '600' },
    badge: { backgroundColor: C.accent + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    badgeText: { color: C.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    studentName: { color: C.text, fontSize: 16, fontWeight: '600' },
    studentSub: { color: C.muted, fontSize: 13, marginTop: 2 },
    themeBtn: { backgroundColor: C.border, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  });
}
