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
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import {
  Home, Users, CalendarCheck, BarChart3, AlertTriangle, Settings, LogOut, Moon, Sun, Languages, RefreshCw, TrendingUp, Info, BookOpen, Key, Phone,
  Search, User, ArrowLeft, Eye, EyeOff, Trash2, FileText, Edit, ChevronDown, Check, ChevronRight
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';

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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ── Theme Management ──────────────────────────────────────────
const THEMES = {
  dark: {
    bg: '#0f172a',
    card: '#1e293b',
    border: '#334155',
    accent: '#3b82f6',
    accentMuted: '#3b82f622',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    slate: '#94a3b8',
    text: '#f8fafc',
    muted: '#94a3b8',
    input: '#0f172a',
    glass: 'rgba(30, 41, 59, 0.8)',
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
  const sName = (a.subjectname || '').toLowerCase();
  const aName = (a.name || '').toLowerCase();
  return sName.includes('conduct') || sName.includes('attitude') || aName.includes('conduct') || aName.includes('attitude');
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

// ── Pagination helper ──────────────────────────────────────────
const PAGE_SIZE = 15;
const paginate = (data: any[], page: number) => data.slice(0, (page + 1) * PAGE_SIZE);

// ═══════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const { t, i18n } = useTranslation();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [authMode, setAuthMode] = useState<'landing' | 'teacher_login' | 'parent_portal'>('landing');
  const [authLoading, setAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'info', visible: boolean}>({msg: '', type: 'success', visible: false});
  const toastOp = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type, visible: true });
    Animated.sequence([
      Animated.timing(toastOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOp, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => setToast(prev => ({...prev, visible: false})));
  }, [toastOp]);

  // Data states
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
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
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
        
        try { if (savedSubjects) setSubjects(JSON.parse(savedSubjects)); } catch(e){}
        try { if (savedSettings) setSettings(JSON.parse(savedSettings)); } catch(e){}
        
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
    console.log('Mobile: Toggling theme to', next ? 'dark' : 'light');
    setIsDark(next);
    await AsyncStorage.setItem('senbet_theme', next ? 'dark' : 'light');
  };

  const toggleLanguage = async () => {
    const next = i18n.language === 'en' ? 'am' : 'en';
    console.log('Mobile: Toggling language to', next);
    await i18n.changeLanguage(next);
    await AsyncStorage.setItem('app_language', next);
  };

  const syncData = useCallback(async (isBackground = false) => {
    if (!teacher || !isOnline) return;
    if (!isBackground) setSyncing(true);

    try {
      // 1. Fetch latest teacher data
      const { data: tRes, error: tErr } = await supabase
        .from('teachers')
        .select('id, name, accesscode, assignedgrades, assignedsubjects, cancreateassessments')
        .eq('id', teacher.id)
        .maybeSingle();

      if (tErr) {
        console.warn('Teacher fetch error:', tErr);
      } else if (!tRes) {
        console.warn('Teacher record not found in Supabase.');
        setTeacher(null);
        await AsyncStorage.removeItem('senbet_teacher_auth');
        return;
      }
        
      if (tRes && JSON.stringify(tRes) !== JSON.stringify(teacher)) {
        setTeacher(tRes);
        await AsyncStorage.setItem('senbet_teacher_auth', JSON.stringify(tRes));
      }

      // 2. Parallelize All Queries (Incremental if possible)
      const syncAnchor = lastSyncIso;
      
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
        newData.forEach(item => map.set(item.id || item.key, item));
        return Array.from(map.values());
      };

      // Calculate Merged States
      let nextStudents = merge(students, (sRes.status === 'fulfilled' ? sRes.value.data : null));
      let nextAssessments = merge(assessments, (aRes.status === 'fulfilled' ? aRes.value.data : null));
      let nextMarks = merge(marks, (mRes.status === 'fulfilled' ? mRes.value.data : null));
      let nextAttendance = merge(attendance, (attRes.status === 'fulfilled' ? attRes.value.data : null));
      let nextSubjects = merge(subjects, (subRes.status === 'fulfilled' ? subRes.value.data : null));
      
      let nextSettings = { ...settings };
      if (setRes.status === 'fulfilled' && setRes.value.data) {
        setRes.value.data.forEach((r: any) => { nextSettings[r.key] = r.value; });
      }

      // Apply Deletions
      if (delRes.status === 'fulfilled' && delRes.value.data && delRes.value.data.length > 0) {
        const deletions = delRes.value.data;
        deletions.forEach((del: any) => {
          if (del.table_name === 'students') nextStudents = nextStudents.filter(r => r.id !== del.record_id);
          else if (del.table_name === 'assessments') nextAssessments = nextAssessments.filter(r => r.id !== del.record_id);
          else if (del.table_name === 'marks') nextMarks = nextMarks.filter(r => r.id !== del.record_id);
          else if (del.table_name === 'attendance') nextAttendance = nextAttendance.filter(r => r.id !== del.record_id);
        });
      }

      // Update State
      setStudents(nextStudents);
      setAssessments(nextAssessments);
      setMarks(nextMarks);
      setAttendance(nextAttendance);
      setSubjects(nextSubjects);
      setSettings(nextSettings);

      const now = formatEthiopianTime(new Date());
      const nowIso = new Date().toISOString();
      setLastSync(now);
      setLastSyncIso(nowIso);

      // Async Persistent Storage
      await Promise.all([
        AsyncStorage.setItem('cached_students', JSON.stringify(nextStudents)),
        AsyncStorage.setItem('cached_assessments', JSON.stringify(nextAssessments)),
        AsyncStorage.setItem('cached_marks', JSON.stringify(nextMarks)),
        AsyncStorage.setItem('cached_attendance', JSON.stringify(nextAttendance)),
        AsyncStorage.setItem('cached_subjects', JSON.stringify(nextSubjects)),
        AsyncStorage.setItem('cached_settings', JSON.stringify(nextSettings)),
        AsyncStorage.setItem('last_sync_time', now),
        AsyncStorage.setItem('last_sync_iso', nowIso)
      ]);

      if (!isBackground) showToast('✅ ' + t('common.syncComplete', 'Sync complete'), 'success');
    } catch (err: any) {
      console.error('Sync error', err);
      if (!isBackground) showToast('⚠️ ' + t('common.syncFailed', 'Sync failed'), 'error');
    } finally {
      if (!isBackground) setSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, isOnline, lastSyncIso, t, students, assessments, marks, attendance, subjects, settings]); 

  useEffect(() => {
    if (teacher) syncData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher?.id]); // Only run on login or teacher change, NOT on syncData function change

  const handleLogin = async (t: Teacher) => {
    setTeacher(t);
    await AsyncStorage.setItem('senbet_teacher_auth', JSON.stringify(t));
  };

  // Auto-sync every 5 minutes
  useEffect(() => {
    if (!teacher) return;
    const interval = setInterval(() => {
      console.log('Mobile: Running background auto-sync...');
      syncData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [teacher]);

  const handleLogout = async () => {
    setTeacher(null);
    setStudents([]); setAssessments([]); setMarks([]); setAttendance([]);
    await AsyncStorage.multiRemove([
      'senbet_teacher_auth', 'cached_students', 'cached_assessments', 'cached_marks', 'cached_attendance', 'last_sync_time', 'cached_subjects', 'cached_settings'
    ]);
  };

  const handleHardRefresh = async () => {
    Alert.alert(
      t('common.hardRefresh', 'Hard Refresh'),
      t('common.hardRefreshConfirm', 'This will wipe your local cache and download everything fresh from the cloud. Proceed?'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.proceed'), 
          onPress: async () => {
            setSyncing(true);
            try {
              await AsyncStorage.multiRemove([
                'cached_students', 'cached_assessments', 'cached_marks', 'cached_attendance', 'cached_subjects', 'cached_settings', 'last_sync_time'
              ]);
              setStudents([]); setAssessments([]); setMarks([]); setAttendance([]);
              await syncData();
              showToast('✨ Cache cleared and fresh data synced');
            } catch (e) {
              showToast('❌ Refresh failed', 'error');
            } finally {
              setSyncing(false);
            }
          }
        }
      ]
    );
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
          const isStudents = activeName === 'Main' && nestedScreen === 'Students';
          const isMarks = activeName === 'Main' && nestedScreen === 'Marks';
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
                onPress={() => props.navigation.navigate('Main', { screen: 'Students' })} 
                style={[s.sidebarItem, isStudents && { backgroundColor: C.accent + '15' }]}
              >
                <View style={[s.sidebarIcon, { backgroundColor: C.accent + (isStudents ? '20' : '10') }]}><Users size={18} color={isStudents ? C.accent : C.slate} /></View>
                <Text style={[s.sidebarText, isStudents && { color: C.accent, fontWeight: '700' }]}>{t('teacher.students')}</Text>
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

              <TouchableOpacity 
                onPress={() => props.navigation.navigate('Main', { screen: 'Marks' })} 
                style={[s.sidebarItem, isMarks && { backgroundColor: C.green + '15' }]}
              >
                <View style={[s.sidebarIcon, { backgroundColor: C.green + (isMarks ? '20' : '10') }]}><BarChart3 size={18} color={isMarks ? C.green : C.slate} /></View>
                <Text style={[s.sidebarText, isMarks && { color: C.green, fontWeight: '700' }]}>{t('teacher.marks')}</Text>
              </TouchableOpacity>

              {!!(teacher?.cancreateassessments || teacher?.canCreateAssessments) && (
                <TouchableOpacity 
                  onPress={() => props.navigation.navigate('AssessmentsMgmt')} 
                  style={[s.sidebarItem, isAssessments && { backgroundColor: C.accent + '15' }]}
                >
                  <View style={[s.sidebarIcon, { backgroundColor: C.accent + (isAssessments ? '20' : '10') }]}><FileText size={18} color={isAssessments ? C.accent : C.slate} /></View>
                  <Text style={[s.sidebarText, isAssessments && { color: C.accent, fontWeight: '700' }]}>Assessments</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ padding: 24, marginTop: 'auto', borderTopWidth: 1, borderTopColor: C.border }}>
              <TouchableOpacity onPress={toggleLanguage} style={s.sidebarItem}>
                <View style={[s.sidebarIcon, { backgroundColor: C.accent + '10' }]}><Languages size={18} color={C.accent} /></View>
                <Text style={s.sidebarText}>{i18n.language === 'en' ? 'Amharic (አማርኛ)' : 'English'}</Text>
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
        )}}
        screenOptions={{
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
        }}
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
                  if (route.name === 'Attendance') return <CalendarCheck size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
                  if (route.name === 'Marks') return <BarChart3 size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
                  return null;
                }
              })}
            >
              <Tab.Screen name="Dashboard">{(props: any) => <DashboardTab {...props} teacher={teacher!} students={students} assessments={assessments} marks={marks} attendance={attendance} subjects={subjects} settings={settings} C={C} s={s} setTab={(t: any) => props.navigation.navigate(t)} onSync={() => syncData()} isSyncing={syncing} isOnline={isOnline} lastSync={lastSync} showToast={showToast} />}</Tab.Screen>
              <Tab.Screen name="Students">{(props: any) => <StudentsTab {...props} teacher={teacher!} students={students} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} />}</Tab.Screen>
              <Tab.Screen name="Attendance">{(props: any) => <AttendanceTab {...props} teacher={teacher!} students={students} attendanceData={attendance} setAttendanceData={setAttendance} onRefresh={() => syncData()} C={C} s={s} showToast={showToast} settings={settings} />}</Tab.Screen>
              <Tab.Screen name="Marks">{(props: any) => <MarksTab {...props} teacher={teacher!} students={students} assessments={assessments} marksData={marks} setMarksData={setMarks} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} showToast={showToast} settings={settings} subjects={subjects} />}</Tab.Screen>
            </Tab.Navigator>
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Analytics" options={{ title: t('dashboard.analytics'), drawerIcon: ({ color }) => <TrendingUp size={18} color={color} />, drawerLabel: t('dashboard.analytics') }}>
          {(props: any) => <AnalyticsTab {...props} teacher={teacher!} students={students} assessments={assessments} marks={marks} C={C} s={s} onRefresh={() => syncData()} settings={settings} subjects={subjects} />}
        </Drawer.Screen>
        <Drawer.Screen name="Urgent" options={{ title: t('teacher.urgent'), drawerIcon: ({ color }) => <AlertTriangle size={18} color={color} />, drawerLabel: t('teacher.urgent') }}>
          {(props: any) => <UrgentMattersTab {...props} teacher={teacher!} students={students} assessments={assessments} marksData={marks} subjects={subjects} settings={settings} C={C} s={s} onRefresh={() => syncData()} />}
        </Drawer.Screen>
        {!!(teacher!.cancreateassessments || teacher!.canCreateAssessments) && (
          <Drawer.Screen name="AssessmentsMgmt" options={{ title: 'Assessments', drawerIcon: ({ color }) => <FileText size={18} color={color} />, drawerLabel: 'Assessments' }}>
            {(props: any) => <AssessmentManagementTab {...props} teacher={teacher!} assessments={assessments} subjects={subjects} settings={settings} C={C} s={s} showToast={showToast} onRefresh={() => syncData()} />}
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
        C={C}
        s={s}
      />

      {toast.visible && (
        <Animated.View style={{
          position: 'absolute', bottom: Platform.OS === 'ios' ? 110 : 90, alignSelf: 'center', opacity: toastOp,
          backgroundColor: toast.type === 'error' ? C.red : (toast.type === 'info' ? C.amber : C.green),
          paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30, elevation: 5,
          shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 8,
          flexDirection: 'row', alignItems: 'center', zIndex: 9999
        }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>{toast.msg}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
               />
               
               <Text style={s.inputLabel}>{t('parent.portalAccessCode', 'Portal Access Code')}</Text>
               <View style={{ position: 'relative' }}>
                 <TextInput 
                   style={[s.loginInput, { height: 56, paddingRight: 50 }]}
                   placeholder="------"
                   keyboardType="numeric"
                   maxLength={6}
                   placeholderTextColor={C.muted}
                   value={accessCode}
                   onChangeText={setAccessCode}
                   secureTextEntry={!showCode}
                 />
                 <TouchableOpacity 
                   onPress={() => setShowCode(!showCode)} 
                   style={{ position: 'absolute', right: 15, top: 15 }}
                 >
                   {showCode ? <EyeOff size={24} color={C.muted} /> : <Eye size={24} color={C.muted} />}
                 </TouchableOpacity>
               </View>

               <TouchableOpacity style={[s.loginBtn, { marginTop: 24, height: 56, borderRadius: 12 }]} onPress={doSearch} disabled={loading}>
                 {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>{t('parent.viewResults', 'View Student Results')}</Text>}
               </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <View style={[s.dashboardCard, { marginBottom: 24, alignItems: 'center', padding: 24 }]}>
               <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.accent + '33' }}>
                 <User size={40} color={C.accent} />
               </View>
               <Text style={{ color: C.text, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{student.name}</Text>
               <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                 <View style={{ backgroundColor: C.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                   <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{fmtGrade(student.grade)}</Text>
                 </View>
                 <Text style={{ color: C.muted }}>•</Text>
                 <Text style={{ color: C.muted, fontWeight: '600' }}>ID: {student.portalcode || student.id.slice(0, 8)}</Text>
               </View>
               
               <TouchableOpacity 
                 style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: C.accent + '10', borderWidth: 1, borderColor: C.accent + '20' }} 
                 onPress={() => setStudent(null)}
               >
                 <Text style={{ color: C.accent, fontWeight: '800', fontSize: 13 }}>{t('parent.searchAnother', 'Search Another Student')}</Text>
               </TouchableOpacity>
            </View>
            
            {/* Attendance Summary */}
            <View style={{ marginBottom: 32 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
                 <CalendarCheck size={20} color={C.accent} />
                 <Text style={[s.sectionTitle, { marginBottom: 0 }]}>{t('profile.attendance', 'Attendance')}</Text>
               </View>

               <View style={[s.dashboardCard, { padding: 16 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                     <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: C.accent, fontSize: 24, fontWeight: '900' }}>
                           {attendance.length > 0 ? Math.round(((attendance.filter(a => a.status !== 'absent').length) / attendance.length) * 100) : 100}%
                        </Text>
                        <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Attendance Rate</Text>
                     </View>
                     <View style={{ width: 1, height: '80%', backgroundColor: C.border, alignSelf: 'center' }} />
                     <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: C.red, fontSize: 24, fontWeight: '900' }}>{attendance.filter(a => a.status === 'absent').length}</Text>
                        <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Absences</Text>
                     </View>
                     <View style={{ width: 1, height: '80%', backgroundColor: C.border, alignSelf: 'center' }} />
                     <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: C.amber, fontSize: 24, fontWeight: '900' }}>{attendance.filter(a => a.status === 'late').length}</Text>
                        <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Lates</Text>
                     </View>
                  </View>

                  {attendance.filter(a => a.status !== 'present').length > 0 ? (
                     <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 }}>
                        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase' }}>{t('parent.recentHistory')}</Text>
                        {attendance.filter(a => a.status !== 'present').slice(0, 3).map((a, i) => (
                           <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, backgroundColor: C.bg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
                              <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>{formatEthiopianDate(a.date)}</Text>
                              <View style={{ backgroundColor: a.status === 'absent' ? C.red + '15' : C.amber + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                                 <Text style={{ color: a.status === 'absent' ? C.red : C.amber, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{t(`teacher.${a.status}`, a.status) as string}</Text>
                              </View>
                           </View>
                        ))}
                     </View>
                  ) : (
                     <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16, alignItems: 'center' }}>
                        <Text style={{ color: C.green, fontSize: 13, fontWeight: '700' }}>✨ Perfect attendance so far!</Text>
                     </View>
                  )}
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
                        <View style={{ alignItems: 'flex-end', backgroundColor: C.bg, padding: 10, borderRadius: 12, minWidth: 60, borderWidth: 1, borderColor: C.border }}>
                          <Text style={{ color: mark ? C.accent : C.muted, fontSize: 20, fontWeight: '900' }}>{mark ? mark.score : '-'}</Text>
                          <Text style={{ color: C.muted, fontSize: 10, fontWeight: '600' }}>/ {a.maxscore}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}

            <View style={{ marginTop: 24, padding: 24, backgroundColor: C.card, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: C.border, alignItems: 'center' }}>
               <CalendarCheck size={32} color={C.muted} opacity={0.4} />
               <Text style={{ color: C.muted, textAlign: 'center', marginTop: 12, fontWeight: '600', fontSize: 13 }}>{t('parent.attendanceSoon', 'Detailed attendance history integration coming soon.')}</Text>
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
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
              <View style={{ width: 100, height: 100, borderRadius: 24, padding: 4, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 20 }}>
                {/* @ts-ignore */}
                <RNImage source={require('./assets/logo.png')} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="contain" />
              </View>
              <Text style={s.loginTitle}>በግ/ደ/አ/ቅ/አርሴማ</Text>
              <Text style={s.loginSub}>ፍኖተ ብርሃን ሰ/ቤት</Text>
            </View>

            <View style={s.loginCard}>
              {errorMsg ? (
                <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#fca5a5' }}>
                   <Text style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: 'bold' }}>{errorMsg}</Text>
                </View>
              ) : null}

              <Text style={s.inputLabel}>{t('teacher.name', 'Full Name')}</Text>
              <TextInput
                style={s.loginInput}
                value={name}
                onChangeText={(text) => { setName(text); setErrorMsg(''); }}
                placeholder="e.g. Abebe Kebede"
                placeholderTextColor={C.muted}
              />

              <Text style={s.inputLabel}>{t('teacher.accessCode', 'Access Code')}</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[s.loginInput, { paddingRight: 50 }]}
                  value={code}
                  onChangeText={(text) => { setCode(text); setErrorMsg(''); }}
                  secureTextEntry={!showCode}
                  placeholder="6-digit code"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <TouchableOpacity 
                  onPress={() => setShowCode(!showCode)} 
                  style={{ position: 'absolute', right: 15, top: 12 }}
                >
                  {showCode ? <EyeOff size={24} color={C.muted} /> : <Eye size={24} color={C.muted} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.loginBtn} onPress={doLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>{t('teacher.login', 'Login')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  WIDGETS
// ═══════════════════════════════════════════════════════════════
const EthiopicClockWidget = ({ C }: { C: any }) => {
  const [timeObj, setTimeObj] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTimeObj(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fullEtTime = formatEthiopianTime(timeObj);
  const [etTime, etSuffix] = fullEtTime.split(' ');

  const gregDateStr = timeObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ethpoianDateStr = formatEthiopianDate(timeObj); 
  const amhDays = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "አርብ", "ቅዳሜ"];
  const ethDayName = amhDays[timeObj.getDay()];

  return (
    <View style={{
      width: '100%',
      backgroundColor: C.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }}>
      {/* Visual Decorations - subtle hints */}
      <View style={{ 
        position: 'absolute', top: -40, right: -40, width: 140, height: 140, 
        borderRadius: 70, backgroundColor: C.accent, opacity: 0.05 
      }} />
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 38, fontWeight: '700', color: C.text, letterSpacing: -1 }}>{etTime}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.muted, marginLeft: 6 }}>{etSuffix}</Text>
          </View>
          <Text style={{ fontSize: 13, color: C.muted, marginTop: 2, fontWeight: '500' }}>{gregDateStr}</Text>
        </View>

        <View style={{ width: 1, height: 40, backgroundColor: C.border, marginHorizontal: 12 }} />

        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.accent, marginBottom: 2 }}>{ethDayName}</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>{ethpoianDateStr}</Text>
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ teacher, students: allStudents, assessments: allAssessments, marks, attendance, subjects, settings, C, s, setTab, onSync, isSyncing, isOnline, lastSync, showToast }: {
  teacher: Teacher, students: Student[], assessments: Assessment[], marks: any[], attendance: any[], subjects: any[], settings: Record<string, string>, C: any, s: any, setTab: (t: any) => void, onSync: () => void, isSyncing: boolean, isOnline: boolean, lastSync: string | null, showToast?: (msg: string, type: 'success'|'error'|'info') => void
}) {
  const { t } = useTranslation();
  const today = formatEthiopianDate(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Filter data for THIS teacher's dashboard (Memoized to prevent infinite loops)
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];
  const assignedSubjectsRaw = (teacher as any)?.assignedsubjects ?? (teacher as any)?.assignedSubjects;
  const hasTeacherAssignedSubjects = Array.isArray(assignedSubjectsRaw) && assignedSubjectsRaw.length > 0;
  const mySubjects = hasTeacherAssignedSubjects ? assignedSubjectsRaw : [];
  const students = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );
  const assessments = useMemo(() => 
    allAssessments.filter(a => {
      const isGradeMatch = !hasTeacherAssignedGrades || myGrades.includes(normG(a.grade)) || myGrades.includes(a.grade);
      const isSubjectMatch = !hasTeacherAssignedSubjects || mySubjects.includes(a.subjectname);
      
      const subject = subjects.find(sub => normS(sub.name) === normS(a.subjectname));
      const assessmentSemester = subject?.semester || 'Semester I';
      const isSemesterMatch = assessmentSemester === (settings.currentSemester || 'Semester I');
      
      return isGradeMatch && isSubjectMatch && isSemesterMatch;
    }),
    [allAssessments, hasTeacherAssignedGrades, myGrades, hasTeacherAssignedSubjects, mySubjects, subjects, settings.currentSemester]
  );

  const handleRefresh = async () => { setRefreshing(true); await onSync(); setRefreshing(false); };

  // Dashboard missing marks: use same logic as Urgent Matters (all students * all assessments for their grade)
  const missingCount = students.reduce((acc, st) => {
    const stGrade = normG(st.grade);
    const stAsses = assessments.filter(a => normG(a.grade) === stGrade);
    const missing = stAsses.filter(a => !marks.some(m => m.studentid === st.id && m.assessmentid === a.id));
    return acc + missing.length;
  }, 0);
  const stats = [
    { label: t('dashboard.totalStudents'), value: students.length, icon: <Users size={24} color={C.accent} stroke={C.accent} />, bg: C.accentMuted, target: 'Students' },
    { label: t('dashboard.attendanceToday'), value: attendance.filter(a => a.status === 'present' || a.status === 'late').length, icon: <CalendarCheck size={24} color={C.green} stroke={C.green} />, bg: C.green + '15', target: 'Attendance' },
    { label: t('teacher.missingMarks'), value: missingCount, icon: <AlertTriangle size={24} color={C.red} stroke={C.red} />, bg: C.red + '15', target: 'Urgent' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}>
      <EthiopicClockWidget C={C} />
      
      <View style={{ marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={[s.sectionTitle, { marginBottom: 4 }]}>{t('dashboard.title')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOnline ? C.green : C.red }} />
            <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>{isOnline ? t('common.online') : t('common.offline')}</Text>
            <Text style={{ color: C.border, fontSize: 12 }}>|</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{lastSync ? `${t('common.synced')} ${lastSync}` : t('common.notSynced')}</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={onSync} 
          disabled={isSyncing}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentMuted, justifyContent: 'center', alignItems: 'center' }}
        >
          {isSyncing ? <ActivityIndicator size="small" color={C.accent} /> : <RefreshCw size={20} color={C.accent} />}
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {stats.map((item, idx) => (
          <TouchableOpacity 
            key={idx} 
            onPress={() => setTab(item.target)}
            activeOpacity={0.7}
            style={[s.dashboardCard, { width: '48%', gap: 12, minHeight: 120 }]}
          >
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center' }}>
              {item.icon}
            </View>
            <View>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: '900' }}>{item.value}</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{item.label}</Text>
            </View>
            <View style={{ position: 'absolute', top: 12, right: 12 }}>
              <ChevronRight size={14} color={C.muted} opacity={0.5} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.sectionTitle, { marginTop: 32, marginBottom: 16 }]}>{t('dashboard.recentActivity')}</Text>

      <TouchableOpacity style={s.dashboardAction} onPress={() => setTab('Attendance')}>
        <View style={[s.sidebarIcon, { backgroundColor: C.accent + '15' }]}><CalendarCheck size={20} color={C.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{t('teacher.attendance')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{t('dashboard.attendanceDesc')}</Text>
        </View>
        <TrendingUp size={16} color={C.muted} />
      </TouchableOpacity>

      <TouchableOpacity style={s.dashboardAction} onPress={() => setTab('Marks')}>
        <View style={[s.sidebarIcon, { backgroundColor: C.amber + '15' }]}><BarChart3 size={20} color={C.amber} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{t('teacher.marks')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{t('dashboard.marksDesc')}</Text>
        </View>
        <TrendingUp size={16} color={C.muted} />
      </TouchableOpacity>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STUDENTS TAB
// ═══════════════════════════════════════════════════════════════
function StudentsTab({ route, navigation, teacher, students: allStudents, onRefresh, C, s, onStudentPress }: {
  route: any, navigation: any, teacher: Teacher, students: Student[], onRefresh: () => Promise<void>, C: any, s: any, onStudentPress: (s: Student) => void
}) {
  const { t } = useTranslation();
  
  // Filter for THIS teacher (Memoized)
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];
  const students = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');

  useEffect(() => {
    const uniqueGrades = [...new Set(students.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
    setGrades(uniqueGrades);
    if (!selectedGrade && uniqueGrades.length > 0) setSelectedGrade(uniqueGrades[0]);
  }, [students, selectedGrade]);

  useEffect(() => {
    if (route.params?.search) {
      setSearch(route.params.search);
    }
    if (route.params?.grade) {
      setSelectedGrade(String(route.params.grade));
    }
  }, [route.params]);


  const [page, setPage] = useState(0);
  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    await onRefresh();
    setRefreshing(false);
  };

  const gradeFiltered = students.filter(st => !selectedGrade || normG(st.grade) === normG(selectedGrade));
  const filtered = gradeFiltered.filter((st) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return st.name?.toLowerCase().includes(q) || st.id?.toLowerCase().includes(q);
  }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {grades.map((g) => (
            <TouchableOpacity
              key={g}
              style={[s.gradeChip, selectedGrade === g && s.gradeChipActive]}
              onPress={() => setSelectedGrade(g)}
            >
              <Text style={[s.gradeChipText, selectedGrade === g && s.gradeChipTextActive]}>{fmtGrade(g)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={[s.searchInput, { margin: 0 }]}
          placeholder={t('common.searchStudents')}
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={paginate(filtered, page)}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Users size={48} color={C.border} />
            <Text style={[s.empty, { marginTop: 12 }]}>{t('common.noStudentsFound')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[s.studentCard, { padding: 12, borderRadius: 16 }]} onPress={() => onStudentPress(item)}>
            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Text style={{ fontSize: 20 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.studentName, { fontSize: 15 }]}>{item.name}</Text>
              {item.baptismalname ? <Text style={[s.studentSub, { fontSize: 12 }]}>{item.baptismalname}</Text> : null}
            </View>
            <View style={[s.badge, { borderRadius: 10 }]}>
              <Text style={[s.badgeText, { fontSize: 11 }]}>{fmtGrade(item.grade)}</Text>
            </View>
          </TouchableOpacity>
        )}
        onEndReached={() => setPage(p => p + 1)}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE TAB  (uses lowercase: studentid)
// ═══════════════════════════════════════════════════════════════
function AttendanceTab({ route, navigation, teacher, students: allStudents, attendanceData, setAttendanceData, onRefresh, C, s, showToast, settings }: {
  route: any, navigation: any, teacher: Teacher, students: Student[], attendanceData: any[], setAttendanceData: (data: any[]) => void, onRefresh: () => void, C: any, s: any, showToast?: (msg: string, type: 'success'|'error'|'info') => void, settings: any
}) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };
  // Filter for THIS teacher (Memoized)
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];
  const students = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );

  const { t } = useTranslation();
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [date] = useState(dayjs().format('YYYY-MM-DD'));
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [attendanceIds, setAttendanceIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const etDate = formatEthiopianDate(new Date());

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan QR codes.');
        return;
      }
    }
    setScannerVisible(true);
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    setScannerVisible(false);
    const student = students.find(st => st.id === data);
    if (student) {
      setAttendance(prev => ({ ...prev, [student.id]: 'present' }));
      showToast?.(`✅ ${student.name} marked Present`, 'success');
    } else {
      showToast?.('❌ Student ID not recognized', 'error');
    }
  };

  useEffect(() => {
    const uniqueGrades = [...new Set(students.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
    setGrades(uniqueGrades);
    // If assignments are present, make sure selection stays within allowed grades.
    if (hasTeacherAssignedGrades) {
      const isSelectedAllowed = selectedGrade && uniqueGrades.some(g => normG(g) === normG(selectedGrade));
      if (!isSelectedAllowed) setSelectedGrade(uniqueGrades[0] || '');
    } else {
      if (!selectedGrade && uniqueGrades.length > 0) setSelectedGrade(uniqueGrades[0]);
    }
  }, [students, hasTeacherAssignedGrades, selectedGrade]);

  useEffect(() => {
    if (!selectedGrade) return;
    (async () => {
      try {
        const { data } = await supabase.from('attendance').select('*').eq('date', date);
        const map: Record<string, string> = {};
        const idMap: Record<string, string> = {};
        data?.forEach((r: any) => { 
          map[r.studentid] = r.status;
          idMap[r.studentid] = r.id;
        });
        setAttendance(map);
        setAttendanceIds(idMap);
      } catch (e) {
        console.error('Attendance fetch error', e);
      }
    })();
  }, [selectedGrade, date]);

  const gradeStudents = students.filter((st) => normG(st.grade) === normG(selectedGrade));
  const filteredStudents = gradeStudents.filter(st => {
    if (!search) return true;
    return st.name.toLowerCase().includes(search.toLowerCase()) || st.id.toLowerCase().includes(search.toLowerCase());
  });

  const saveAttendance = async () => {
    if (!selectedGrade) return;
    setSaving(true);
    try {
      const records = gradeStudents.map(st => ({
        id: attendanceIds[st.id] || generateUUID(),
        studentid: st.id,
        date,
        status: attendance[st.id] || 'absent',
        last_modified_by: teacher.id,
        semester: settings.currentSemester || 'Semester I',
        updated_at: new Date().toISOString()
      }));

      // Immediate local update for "persistence" feel
      const newAttendanceData = [...attendanceData];
      records.forEach(r => {
        const idx = newAttendanceData.findIndex(exist => exist.studentid === r.studentid && exist.date === r.date);
        if (r.status === null) {
          if (idx !== -1) newAttendanceData.splice(idx, 1);
        } else {
          if (idx !== -1) newAttendanceData[idx] = r;
          else newAttendanceData.push(r);
        }
      });
      setAttendanceData(newAttendanceData);

      const toUpsert = records.filter(r => r.status !== null);
      const { error: upErr } = await supabase.from('attendance').upsert(toUpsert);
      if (upErr) throw upErr;
      
      const toDelete = records.filter(r => r.status === null).map(r => r.id);
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('attendance').delete().in('id', toDelete);
        if (delErr) throw delErr;
      }
      
      showToast?.(`✅ ${t('common.statusSaved')}`, 'success');
      onRefresh();
    } catch (e: any) {
      showToast?.('❌ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View>
            <Text style={[s.sectionTitle, { marginBottom: 4 }]}>{t('teacher.attendance')}</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{etDate}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {grades.map(g => (
            <TouchableOpacity
              key={g}
              onPress={() => setSelectedGrade(g)}
              style={[s.gradeChip, selectedGrade === g && s.gradeChipActive]}
            >
              <Text style={[s.gradeChipText, selectedGrade === g && s.gradeChipTextActive]}>{fmtGrade(g)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={[s.searchInput, { margin: 0, marginBottom: 16 }]}
          placeholder={t('common.searchStudents')}
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <View style={[s.attendanceRow, { padding: 12, borderRadius: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.studentName}>{item.name}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['present', 'late', 'absent'] as const).map(status => (
                <TouchableOpacity
                  key={status}
                  onPress={() => setAttendance(prev => ({ ...prev, [item.id]: status }))}
                  style={[
                    s.statusBadge,
                    {
                      borderColor: attendance[item.id] === status
                        ? (status === 'present' ? C.green : status === 'late' ? C.amber : C.red)
                        : C.border,
                      backgroundColor: attendance[item.id] === status
                        ? (status === 'present' ? C.green + '15' : status === 'late' ? C.amber + '15' : C.red + '15')
                        : 'transparent'
                    }
                  ]}
                >
                  <Text style={[
                    s.statusText,
                    {
                      color: attendance[item.id] === status
                        ? (status === 'present' ? C.green : status === 'late' ? C.amber : C.red)
                        : C.muted
                    }
                  ]}>{t(`teacher.${status}`).toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      />

      <Modal visible={scannerVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flex: 1 }}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={onBarcodeScanned}
            />
            {/* Scanner Overlay UI */}
            <View style={StyleSheet.absoluteFillObject}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                <View style={{ width: 280, height: 280, borderWidth: 2, borderColor: C.accent, borderRadius: 24 }} />
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Scan Student ID Card</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 12 }}>Align the QR code within the frame</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setScannerVisible(false)}
              style={{ position: 'absolute', top: 60, right: 30, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity style={[s.loginBtn, { marginTop: 0, flex: 1 }]} onPress={saveAttendance}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Save Attendance</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={openScanner} style={[s.loginBtn, { marginTop: 0, width: 64, backgroundColor: C.accentMuted, borderWidth: 1, borderColor: C.accent }]}>
          <CalendarCheck size={24} color={C.accent} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════
// PREMIUM DROPDOWN
// ═══════════════════════════════════════════════════════════════
function PremiumDropdown({ label, placeholder, items, selectedKey, onSelect, C, s, disabled = false }: {
  label: string; placeholder: string; items: {key: string, label: string}[]; selectedKey: string | null; onSelect: (key: string) => void; C: any; s: any; disabled?: boolean;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedItem = items.find(i => i.key === selectedKey);

  return (
    <View style={{ marginBottom: 12, opacity: disabled ? 0.6 : 1 }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity 
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
        activeOpacity={disabled ? 1 : 0.7}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: disabled ? C.bg : C.card, 
          borderWidth: 1, 
          borderColor: disabled ? C.border : (selectedKey ? C.accent : C.border),
          paddingHorizontal: 16, height: 50, borderRadius: 12
        }}
      >
        <Text style={{ color: selectedItem ? C.text : C.muted, fontWeight: selectedItem ? '700' : '500', fontSize: 14 }} numberOfLines={1}>
          {selectedItem ? selectedItem.label : placeholder}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ChevronDown size={18} color={selectedKey && !disabled ? C.accent : C.muted} />
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 16 }}>{placeholder}</Text>
            <FlatList
              data={items}
              keyExtractor={item => item.key}
              renderItem={({ item }) => {
                const isActive = item.key === selectedKey;
                return (
                  <TouchableOpacity
                    onPress={() => { onSelect(item.key); setModalVisible(false); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingVertical: 14, paddingHorizontal: 16,
                      backgroundColor: isActive ? C.accent + '15' : 'transparent',
                      borderRadius: 12, marginBottom: 4
                    }}
                  >
                    <Text style={{ color: isActive ? C.accent : C.text, fontWeight: isActive ? '700' : '500', fontSize: 15 }}>{item.label}</Text>
                    {isActive && <Check size={18} color={C.accent} />}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MARKS TAB  (uses lowercase: studentid, assessmentid, etc.)
// ═══════════════════════════════════════════════════════════════
function MarksTab({ route, navigation, teacher, students: allStudents, assessments: allAssessments, marksData, setMarksData, onRefresh, C, s, onStudentPress, showToast, settings, subjects }: {
  route: any, navigation: any, teacher: Teacher, students: Student[], assessments: Assessment[], marksData: any[], setMarksData: (data: any[]) => void, onRefresh: () => void, C: any, s: any, onStudentPress: (s: Student) => void, showToast?: (msg: string, type: 'success'|'error'|'info') => void, settings: any, subjects: any[]
}) {
  // Filter for THIS teacher (Memoized)
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];

  const assignedSubjectsRaw = (teacher as any)?.assignedsubjects ?? (teacher as any)?.assignedSubjects;
  const hasTeacherAssignedSubjects = Array.isArray(assignedSubjectsRaw) && assignedSubjectsRaw.length > 0;
  const mySubjects = hasTeacherAssignedSubjects ? assignedSubjectsRaw : [];
  const normalizedMySubjects = mySubjects.map(normS).filter(Boolean);
  
  const myStudents = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );
  const myAssessments = useMemo(() => 
    allAssessments.filter(a => {
      const isGradeMatch = !hasTeacherAssignedGrades || myGrades.includes(normG(a.grade)) || myGrades.includes(a.grade);
      const isSubjectMatch = !hasTeacherAssignedSubjects || normalizedMySubjects.includes(normS(a.subjectname));

      const subject = subjects.find(sub => normS(sub.name) === normS(a.subjectname));
      const assessmentSemester = subject?.semester || 'Semester I';
      const isSemesterMatch = assessmentSemester === (settings.currentSemester || 'Semester I');
      
      return isGradeMatch && isSubjectMatch && !isConduct(a) && isSemesterMatch;
    }),
    [allAssessments, hasTeacherAssignedGrades, myGrades, hasTeacherAssignedSubjects, normalizedMySubjects, subjects, settings.currentSemester]
  );

  const { t } = useTranslation();
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [markIds, setMarkIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkScore, setBulkScore] = useState('');
  const [predictVisible, setPredictVisible] = useState(false);
  const [clearAllVisible, setClearAllVisible] = useState(false);
  const [predictDetails, setPredictDetails] = useState<{count: number, subject: string, students: any[]}>({ count: 0, subject: '', students: [] });
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightEmptyData, setHighlightEmptyData] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null); 
  const lastRoutedNonce = useRef<number | null>(null);
  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };

  const gradeAssessments = myAssessments.filter((a) => normG(a.grade) === normG(selectedGrade));
  // Subject chips come from the teacher-assigned subjects list (like desktop "Subjects:" block),
  // without extra filtering (assessments list is filtered separately by grade/semester/subject).
  const allowedSubjectKeyToLabel = new Map<string, string>();
  (mySubjects || []).forEach((subj) => {
    const key = normS(subj);
    if (!key) return;
    if (!allowedSubjectKeyToLabel.has(key)) allowedSubjectKeyToLabel.set(key, subj);
  });

  const gradeSubjects = [...allowedSubjectKeyToLabel.entries()]
    .map(([key, label]) => ({ key, label }));

  const selectedSubjectKey = normS(selectedSubject);
  // If no subject is selected yet, show all assessments for the selected grade.
  const filteredAssessments = selectedSubject
    ? gradeAssessments.filter(a => normS(a.subjectname) === selectedSubjectKey)
    : gradeAssessments;
  
  const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));
  const filteredStudents = gradeStudents.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (highlightEmptyData) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 400, useNativeDriver: false })
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [highlightEmptyData]);

  useEffect(() => {
    const nonce = route.params?.nonce;
    if (route.params?.assessmentId && lastRoutedNonce.current !== nonce) {
      const ass = myAssessments.find(a => a.id === route.params.assessmentId);
      if (ass) {
        setSelectedGrade(String(ass.grade));
        setSelectedSubject(normS(ass.subjectname));
        setSelectedAssessment(ass);
      }
    } else if (route.params?.grade && !route.params.assessmentId) {
      setSelectedGrade(String(route.params.grade));
    }
    
    if (route.params?.highlightEmpty && route.params?.assessmentId) {
      if (lastRoutedNonce.current === nonce) return;

      // 1. Prepare: Render the full list (no pagination) first
      setPage(99); 
      
      // 2. Scroll: Wait for render then scroll
      setTimeout(() => {
        if (filteredStudents.length > 0) {
          const firstMissingIndex = filteredStudents.findIndex(st => !marks[st.id] || marks[st.id] === '');
          if (firstMissingIndex !== -1) {
            flatListRef.current?.scrollToIndex({ index: firstMissingIndex, animated: true, viewPosition: 0 });
            lastRoutedNonce.current = nonce;

            // 3. Highlight: Wait for scroll animation (approx 500ms) then pulse
            setTimeout(() => {
              setHighlightEmptyData(true);
              // 4. Cleanup: Clear pulse after 1.5s
              setTimeout(() => setHighlightEmptyData(false), 2000); // Increased to 2s to match desktop
            }, 600);
          }
        }
      }, 800);
    }
  }, [route.params, myAssessments, marks, filteredStudents.length]); 

  useEffect(() => {
    const uniqueGrades = [...new Set(myStudents.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
    setGrades(uniqueGrades);
    if (hasTeacherAssignedGrades) {
      const isSelectedAllowed = selectedGrade && uniqueGrades.some(g => normG(g) === normG(selectedGrade));
      if (!isSelectedAllowed) {
        setSelectedGrade(uniqueGrades[0] || '');
        setSelectedSubject('');
        setSelectedAssessment(null);
      }
    } else if (!selectedGrade && uniqueGrades.length > 0) {
      setSelectedGrade(uniqueGrades[0]);
    }
  }, [myStudents, hasTeacherAssignedGrades, selectedGrade]);

  // Keep subject/assessment selection consistent when grade changes via navigation.
  useEffect(() => {
    if (selectedAssessment && normG(selectedAssessment.grade) !== normG(selectedGrade)) {
      setSelectedSubject('');
      setSelectedAssessment(null);
      return;
    }
    if (!selectedAssessment) {
      setSelectedSubject('');
    }
  }, [selectedGrade]); 

  useEffect(() => {
    if (!selectedAssessment) {
      setMarks({});
      setMarkIds({});
      return;
    }
    const map: Record<string, string> = {};
    const idMap: Record<string, string> = {};
    marksData
      .filter(m => m.assessmentid === selectedAssessment.id)
      .forEach(m => { 
        map[m.studentid] = String(m.score);
        idMap[m.studentid] = m.id;
      });
    setMarks(map);
    setMarkIds(idMap);
  }, [selectedAssessment, marksData]);


  const saveMarksWithData = async (currentMarksData: Record<string, string>) => {
    if (!selectedAssessment) return;
    setSaving(true);
    try {
      const toUpsert: any[] = [];
      const toDeleteIds: string[] = [];
      const recordsToProcess: any[] = [];

      gradeStudents.forEach(student => {
        const scoreStr = currentMarksData[student.id];
        const score = scoreStr && scoreStr !== '' ? Math.round(parseFloat(scoreStr)) : null;
        const existingId = markIds[student.id];

        const record = {
          id: existingId || generateUUID(),
          studentid: student.id,
          assessmentid: selectedAssessment.id,
          score,
          assessmentdate: selectedAssessment.date,
          semester: settings.currentSemester || 'Semester I',
          last_modified_by: teacher.id,
          updated_at: new Date().toISOString()
        };
        recordsToProcess.push(record);

        if (score !== null) {
          toUpsert.push(record);
        } else if (existingId) {
          toDeleteIds.push(existingId);
        }
      });

      // Immediate local update for "persistence" feel
      const newMarksData = [...marksData];
      recordsToProcess.forEach(r => {
        const idx = newMarksData.findIndex(exist => exist.studentid === r.studentid && exist.assessmentid === r.assessmentid);
        if (r.score === null) {
          if (idx !== -1) newMarksData.splice(idx, 1);
        } else {
          if (idx !== -1) newMarksData[idx] = r;
          else newMarksData.push(r);
        }
      });
      setMarksData(newMarksData);

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('marks').upsert(toUpsert, { onConflict: 'id' });
        if (error) throw error;
      }
      if (toDeleteIds.length > 0) {
        const { error } = await supabase.from('marks').delete().in('id', toDeleteIds);
        if (error) throw error;
      }

      showToast?.('✅ Marks saved successfully', 'success');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast?.('❌ ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveMarks = () => saveMarksWithData(marks);

  const handleFillConstantMark = () => {
    if (!selectedAssessment) return;
    const studentsWithoutMarks = gradeStudents.filter(st => marks[st.id] === undefined || marks[st.id] === '');
    if (studentsWithoutMarks.length === 0) {
      showToast?.('ℹ️ All students already have marks', 'info');
      return;
    }
    setBulkVisible(true);
  };

  const applyBulkFill = () => {
    const val = parseFloat(bulkScore);
    if (isNaN(val) || val < 0 || val > selectedAssessment!.maxscore) {
      showToast?.(`❌ ${t('teacher.validScore')}: 0–${selectedAssessment!.maxscore}`, 'error');
      return;
    }
    const studentsWithoutMarks = gradeStudents.filter(st => marks[st.id] === undefined || marks[st.id] === '');
    const updates = { ...marks };
    studentsWithoutMarks.forEach(s => updates[s.id] = val.toString());
    setMarks(updates);
    setBulkVisible(false);
    setBulkScore('');
    
    // Auto-save
    saveMarksWithData(updates);
  };

  const handleClearMarks = () => {
    if (!selectedAssessment) return;

    // If everything is already cleared for the current assessment, don't show confirmation.
    const studentsWithMarks = gradeStudents.filter((s) => {
      const v = marks[s.id];
      if (v === undefined || v === '') return false;
      // Guard against nullable scores mapping to strings like "null".
      const n = parseFloat(v);
      return v !== 'null' && !Number.isNaN(n);
    });

    if (studentsWithMarks.length === 0) {
      showToast?.(`ℹ️ ${t('teacher.alreadyCleared')}`, 'info');
      return;
    }

    setClearAllVisible(true);
  };

  const applyClearAllMarks = () => {
    if (!selectedAssessment) return;
    const updates = { ...marks };
    gradeStudents.forEach(s => updates[s.id] = '');
    setMarks(updates);
    setClearAllVisible(false);
    saveMarksWithData(updates);
    showToast?.(`🧹 ${t('teacher.clearedSuccess')}`, 'success');
  };

  const handlePredictMarks = () => {
    if (!selectedAssessment) return;
    const studentsWithoutMarks = gradeStudents.filter(st => marks[st.id] === undefined || marks[st.id] === '');
    if (studentsWithoutMarks.length === 0) {
      showToast?.(`ℹ️ ${t('teacher.allHaveMarks')}`, 'info');
      return;
    }

    const targetSubject = normS(selectedAssessment.subjectname);
    const studentsWithHistory = [];
    for (const student of studentsWithoutMarks) {
      const historyCount = marksData.filter(m => m.studentid === student.id).filter(m => {
        // Use m.subject directly for robustness if available, or look up assessment
        const markSubject = m.subject ? normS(m.subject) : null;
        if (markSubject) return markSubject === targetSubject;
        
        const a = myAssessments.find(ax => ax.id === m.assessmentid);
        return a && normS(a.subjectname) === targetSubject;
      }).length;
      if (historyCount > 0) studentsWithHistory.push(student);
    }

    if (studentsWithHistory.length === 0) {
      showToast?.(`⚠️ ${t('teacher.noHistoryPoints')}`, 'info');
      return;
    }

    setPredictDetails({ 
      count: studentsWithHistory.length, 
      subject: selectedAssessment.subjectname, 
      students: studentsWithHistory 
    });
    setPredictVisible(true);
  };

  const applyPrediction = () => {
    const updates = { ...marks };
    let count = 0;
    for (const student of predictDetails.students) {
      const subjectMarks = marksData.filter(m => m.studentid === student.id).filter(m => {
        const a = myAssessments.find(ax => ax.id === m.assessmentid);
        return a && normS(a.subjectname) === normS(predictDetails.subject);
      });

      if (subjectMarks.length > 0) {
        let totalPercentage = 0;
        let validCount = 0;
        for (const m of subjectMarks) {
          const assessment = myAssessments.find(a => a.id === m.assessmentid);
          if (assessment && assessment.maxscore > 0) {
            totalPercentage += (Number(m.score) / assessment.maxscore);
            validCount++;
          }
        }
        if (validCount > 0) {
          const avgPercentage = totalPercentage / validCount;
          const predictedScore = Math.round(avgPercentage * selectedAssessment!.maxscore * 10) / 10;
          updates[student.id] = predictedScore.toString();
          count++;
        }
      }
    }
    setMarks(updates);
    setPredictVisible(false);

    // Auto-save
    saveMarksWithData(updates);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={[s.sectionTitle, { marginBottom: 16 }]}>{t('teacher.marks')}</Text>

        <View style={{ marginBottom: 12 }}>
          <PremiumDropdown 
            label={t('profile.grade', 'Grade')} 
            placeholder={t('common.selectGrade', 'Select Grade')}
            items={grades.map(g => ({ key: g, label: fmtGrade(g) }))}
            selectedKey={selectedGrade}
            onSelect={(key) => { setSelectedGrade(key); setSelectedSubject(''); setSelectedAssessment(null); }}
            C={C} s={s}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <PremiumDropdown 
              label={t('assessment.subject', 'Subject')} 
              placeholder={t('common.selectSubject', 'Select Subject')}
              items={gradeSubjects}
              selectedKey={selectedSubjectKey}
              onSelect={(key) => { setSelectedSubject(key); setSelectedAssessment(null); }}
              C={C} s={s}
              disabled={!selectedGrade}
            />
          </View>

          <View style={{ flex: 1 }}>
            <PremiumDropdown 
              label={t('assessment.label', 'Assessment')} 
              placeholder={t('common.selectAssessment', 'Select Assessment')}
              items={filteredAssessments.map(a => ({ key: a.id, label: a.name }))}
              selectedKey={selectedAssessment?.id || null}
              onSelect={(key) => {
                const a = filteredAssessments.find(ax => ax.id === key);
                if (a) {
                  setSelectedAssessment(a);
                  setSelectedSubject(normS(a.subjectname));
                }
              }}
              C={C} s={s}
              disabled={!selectedSubjectKey}
            />
          </View>
        </View>

        <TextInput
          style={[s.searchInput, { margin: 0, marginBottom: 16 }]}
          placeholder={t('common.searchStudents')}
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={paginate(filteredStudents, page)}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
        getItemLayout={(data, index) => (
          { length: 80, offset: 80 * index, index }
        )}
        onScrollToIndexFailed={info => {
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
        }}
        // Force refresh when selected assessment changes (header buttons) or marks map changes (row inputs).
        extraData={[selectedAssessment?.id, marks]}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={selectedAssessment ? (
          <View style={[s.maxScoreBar, { borderRadius: 12, marginBottom: 16, padding: 16 }]}>
            <Text style={{ color: C.accent, fontWeight: '800', textAlign: 'center', marginBottom: 12, fontSize: 16 }}>
              {selectedAssessment.name} - {t('teacher.maxScoreLabel')}: {selectedAssessment.maxscore}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
              <TouchableOpacity onPress={handlePredictMarks} style={{ flex: 1, backgroundColor: C.accent + '22', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.accent + '44' }}>
                <TrendingUp size={18} color={C.accent} style={{ marginBottom: 4 }} />
                <Text style={{ color: C.accent, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{t('teacher.predict')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleFillConstantMark} style={{ flex: 1, backgroundColor: C.accent + '22', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.accent + '44' }}>
                <Text style={{ fontSize: 16, marginBottom: 2 }}>📝</Text>
                <Text style={{ color: C.accent, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{t('teacher.constant')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearMarks} style={{ flex: 1, backgroundColor: C.red + '11', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.red + '33' }}>
                <Trash2 size={18} color={C.red} style={{ marginBottom: 4 }} />
                <Text style={{ color: C.red, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>{t('teacher.clearAll')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        renderItem={({ item }) => {
          const isMissing = !marks[item.id] || marks[item.id] === '';
          const shouldHighlight = highlightEmptyData && isMissing;

          const animatedBorderColor = pulseAnim.interpolate({
             inputRange: [0, 1],
             outputRange: [C.border, C.accent]
          });

          const animatedShadow = pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 4]
          });

          return (
          <Animated.View style={[
            s.markRow, 
            { padding: 12, borderRadius: 16 }, 
            shouldHighlight ? { 
              borderColor: animatedBorderColor, 
              borderWidth: 2,
              elevation: animatedShadow,
              shadowColor: C.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: pulseAnim,
              shadowRadius: 10,
              backgroundColor: C.card 
            } : null
          ]}>
            <View style={{ flex: 1 }}>
              <Text style={s.studentName}>{item.name}</Text>
              {item.baptismalname ? <Text style={s.studentSub}>{item.baptismalname}</Text> : null}
            </View>
            <TextInput
              style={[s.markInput, { width: 80, height: 44, borderRadius: 10 }]}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={C.muted}
              value={marks[item.id] || ''}
              onChangeText={(val) => {
                const score = parseFloat(val);
                if (val !== '' && !isNaN(score) && selectedAssessment && score > selectedAssessment.maxscore) {
                  showToast?.(`❌ Max score is ${selectedAssessment.maxscore}`, 'error');
                  return;
                }
                setMarks(prev => ({ ...prev, [item.id]: val }));
              }}
              editable={!!selectedAssessment}
            />
          </Animated.View>
        )}}
        onEndReached={() => setPage(p => p + 1)}
        onEndReachedThreshold={0.5}
      />

      <Modal visible={bulkVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('teacher.fillConstant')}</Text>
            <Text style={s.modalSub}>{t('teacher.fillConstantDesc', 'Enter a score to fill for all currently ungraded students')} (Max: {selectedAssessment?.maxscore})</Text>
            <TextInput
              style={[s.loginInput, { width: '100%', textAlign: 'center', marginBottom: 20, fontSize: 20, fontWeight: '800' }]}
              keyboardType="numeric"
              placeholder={`0 - ${selectedAssessment?.maxscore || 10}`}
              placeholderTextColor={C.muted}
              value={bulkScore}
              onChangeText={setBulkScore}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => { setBulkVisible(false); setBulkScore(''); }} style={[s.modalBtn, { backgroundColor: C.border }]}>
                <Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyBulkFill} style={s.modalBtn}>
                <Text style={s.modalBtnText}>{t('common.apply', 'Apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={predictVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('teacher.predictMarks')}</Text>
            <Text style={[s.modalSub, { marginBottom: 20 }]}>
              {t('teacher.predictDesc', { count: predictDetails.count, subject: predictDetails.subject })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setPredictVisible(false)} style={[s.modalBtn, { backgroundColor: C.border }]}>
                <Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyPrediction} style={[s.modalBtn, { backgroundColor: C.accent }]}>
                <Text style={[s.modalBtnText, { color: '#fff' }]}>{t('teacher.predict')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={clearAllVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('teacher.clearAllMarks', 'Clear All Marks?')}</Text>
            <Text style={[s.modalSub, { marginBottom: 20 }]}>
              {t(
                'teacher.confirmClearAll',
                'This will remove all marks for the current assessment. This cannot be undone once saved.'
              )}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setClearAllVisible(false)}
                style={[s.modalBtn, { backgroundColor: C.border }]}
              >
                <Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyClearAllMarks}
                style={[s.modalBtn, { backgroundColor: C.red + '33', borderColor: C.red + '66', borderWidth: 1 }]}
              >
                <Text style={[s.modalBtnText, { color: C.red, fontWeight: '800' }]}>{t('common.yes', 'Yes')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {selectedAssessment && (
        <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
          <TouchableOpacity
            style={[s.loginBtn, { marginTop: 0 }]}
            onPress={saveMarks}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>{t('teacher.saveMarks', 'Save Marks')}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  URGENT MATTERS TAB
// ═══════════════════════════════════════════════════════════════
function UrgentMattersTab({ navigation, teacher, students: allStudents, assessments: allAssessments, marksData, subjects, settings, C, s, onRefresh }: {
  navigation: any, teacher: Teacher, students: Student[], assessments: Assessment[], marksData: any[], subjects: any[], settings: Record<string, string>, C: any, s: any, onRefresh?: () => Promise<void> | void
}) {
  const { t } = useTranslation();

  // Filter for THIS teacher (Memoized)
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];

  const assignedSubjectsRaw = (teacher as any)?.assignedsubjects ?? (teacher as any)?.assignedSubjects;
  const hasTeacherAssignedSubjects = Array.isArray(assignedSubjectsRaw) && assignedSubjectsRaw.length > 0;
  const mySubjects = hasTeacherAssignedSubjects ? assignedSubjectsRaw : [];

  const students = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );
  const assessments = useMemo(() => 
    allAssessments.filter(a => {
      const isGradeMatch = !hasTeacherAssignedGrades || myGrades.includes(normG(a.grade)) || myGrades.includes(a.grade);
      const isSubjectMatch = !hasTeacherAssignedSubjects || mySubjects.includes(a.subjectname);
      
      const subject = subjects.find(sub => normS(sub.name) === normS(a.subjectname));
      const assessmentSemester = subject?.semester || 'Semester I';
      const isSemesterMatch = assessmentSemester === (settings.currentSemester || 'Semester I');

      return isGradeMatch && isSubjectMatch && !isConduct(a) && isSemesterMatch;
    }),
    [allAssessments, hasTeacherAssignedGrades, myGrades, hasTeacherAssignedSubjects, mySubjects, subjects, settings.currentSemester]
  );
  
  const [refreshing, setRefreshing] = useState(false);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showAllAssessments, setShowAllAssessments] = useState(false);
  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };

  const currentSemester = settings.currentSemester || 'Semester I';

  const myAssessments = assessments;

  const missingMarksByAssessment = myAssessments.map(a => {
    const studentsForGrade = students.filter(st => normG(st.grade) === normG(a.grade));
    const ungraded = studentsForGrade.filter(st => !marksData.some(m => 
        (m.studentid === st.id || m.studentId === st.id) && 
        (m.assessmentid === a.id || m.assessmentId === a.id)
    ));
    return { assessment: a, count: ungraded.length, students: ungraded };
  }).filter(item => item.count > 0);

  const studentsWithNoMarks = students.filter(st => {
    const assessmentsForGrade = myAssessments.filter(a => normG(a.grade) === normG(st.grade));
    if (assessmentsForGrade.length === 0) return false;
    return !marksData.some(m => 
        (m.studentid === st.id || m.studentId === st.id) && 
        assessmentsForGrade.some(a => a.id === (m.assessmentid || m.assessmentId))
    );
  });

  const PAGE_SIZE = 5;
  const displayedStudents = showAllStudents ? studentsWithNoMarks : studentsWithNoMarks.slice(0, PAGE_SIZE);
  const displayedAssessments = showAllAssessments ? missingMarksByAssessment : missingMarksByAssessment.slice(0, PAGE_SIZE);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}>
      <View style={{ marginBottom: 24 }}>
        <Text style={s.sectionTitle}>⚠️ {t('teacher.urgent')}</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>{t('teacher.urgentSubtitle')}</Text>
      </View>

      {studentsWithNoMarks.length > 0 && (
        <View style={[s.issueCard, { borderRadius: 20, padding: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <AlertTriangle size={20} color={C.red} stroke={C.red} />
            <Text style={[s.issueTitle, { marginLeft: 8, marginBottom: 0 }]}>{t('teacher.noMarksTitle')}</Text>
            <View style={{ flex: 1 }} />
            <View style={{ backgroundColor: C.red + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
              <Text style={{ color: C.red, fontSize: 12, fontWeight: '800' }}>{studentsWithNoMarks.length}</Text>
            </View>
          </View>
          <Text style={s.issueSub}>{t('teacher.noMarksDesc')}</Text>
          {displayedStudents.map(st => (
            <View key={st.id} style={[s.issueRow, { borderTopColor: C.border }]}>
              <Users size={14} color={C.muted} stroke={C.muted} />
              <Text style={[s.issueText, { marginLeft: 8 }]}>{st.name}</Text>
              <View style={{ flex: 1 }} />
              <View style={s.badge}><Text style={s.badgeText}>{fmtGrade(st.grade)}</Text></View>
            </View>
          ))}
          {studentsWithNoMarks.length > PAGE_SIZE && (
            <TouchableOpacity
              onPress={() => setShowAllStudents(!showAllStudents)}
              style={{ alignSelf: 'center', marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: C.red + '12' }}
            >
              <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>
                {showAllStudents ? t('urgent.showLess') : t('urgent.showAllStudents', { count: studentsWithNoMarks.length })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {missingMarksByAssessment.length > 0 && (
        <View style={[s.issueCard, { borderRadius: 20, padding: 20, marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <BarChart3 size={20} color={C.amber} stroke={C.amber} />
            <Text style={[s.issueTitle, { marginLeft: 8, marginBottom: 0 }]}>{t('urgent.incompleteAssessments')}</Text>
            <View style={{ flex: 1 }} />
            <View style={{ backgroundColor: C.amber + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}>
              <Text style={{ color: C.amber, fontSize: 12, fontWeight: '800' }}>{missingMarksByAssessment.length}</Text>
            </View>
          </View>
          <Text style={s.issueSub}>{t('urgent.missingScoresDesc')}</Text>
          {displayedAssessments.map(item => (
            <TouchableOpacity 
              key={item.assessment.id} 
              style={[s.issueRow, { borderTopColor: C.border, flexDirection: 'column', alignItems: 'stretch' }]}
              onPress={() => navigation.navigate('Main', { screen: 'Marks', params: { assessmentId: item.assessment.id, grade: item.assessment.grade, highlightEmpty: true, nonce: Date.now() } })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.issueText}>{item.assessment.name}</Text>
                  <Text style={s.issueSub}>{item.assessment.subjectname} • {fmtGrade(item.assessment.grade)} • {t('urgent.missingCount', { count: item.count })}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Main', { screen: 'Marks', params: { assessmentId: item.assessment.id, grade: item.assessment.grade, highlightEmpty: true, nonce: Date.now() } })}
                  style={{ backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{t('urgent.fixNow')}</Text>
                </TouchableOpacity>
              </View>
              {/* Show missing students */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {item.students.map(st => (
                  <View key={st.id} style={{ backgroundColor: C.amber + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: C.amber + '30' }}>
                    <Text style={{ fontSize: 11, color: C.amber, fontWeight: '700' }}>{st.name}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
          {missingMarksByAssessment.length > PAGE_SIZE && (
            <TouchableOpacity
              onPress={() => setShowAllAssessments(!showAllAssessments)}
              style={{ alignSelf: 'center', marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: C.amber + '12' }}
            >
              <Text style={{ color: C.amber, fontWeight: '700', fontSize: 13 }}>
                {showAllAssessments ? t('urgent.showLess') : t('urgent.showAllAssessments', { count: missingMarksByAssessment.length })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {studentsWithNoMarks.length === 0 && missingMarksByAssessment.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 100 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.green + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <TrendingUp size={40} color={C.green} stroke={C.green} />
          </View>
          <Text style={[s.empty, { color: C.text, fontWeight: '700' }]}>{t('urgent.everyoneUpToDate')}</Text>
          <Text style={{ color: C.muted, marginTop: 4 }}>{t('urgent.noUrgentMatters')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ASSESSMENT MANAGEMENT TAB (Teacher)
// ═══════════════════════════════════════════════════════════════
function AssessmentManagementTab({ teacher, assessments: allAssessments, subjects, settings, C, s, showToast, onRefresh }: {
  teacher: Teacher, assessments: Assessment[], subjects: any[], settings: any, C: any, s: any, showToast?: (msg: string, type: 'success'|'error'|'info') => void, onRefresh?: () => Promise<void> | void
}) {
  const { t } = useTranslation();
  const myGrades = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades ?? [];
  const mySubjects = (teacher as any)?.assignedsubjects ?? (teacher as any)?.assignedSubjects ?? [];

  const myAssessments = allAssessments.filter(a =>
    myGrades.some((g: string) => normG(g) === normG(a.grade)) &&
    mySubjects.some((sub: string) => normS(sub) === normS(a.subjectname))
  );

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [name, setName] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };

  useEffect(() => {
    if (myGrades.length === 1 && !selectedGrade) {
      setSelectedGrade(myGrades[0]);
    }
  }, [myGrades]);

  useEffect(() => {
    if (mySubjects.length === 1 && !selectedSubject) {
      setSelectedSubject(mySubjects[0]);
    }
  }, [mySubjects]);

  const filteredAssessments = myAssessments.filter(a => {
    if (selectedGrade && normG(a.grade) !== normG(selectedGrade)) return false;
    if (selectedSubject && normS(a.subjectname) !== normS(selectedSubject)) return false;
    return true;
  });

  const handleSave = async () => {
    if (!selectedGrade) { showToast?.('❌ Please select a grade', 'error'); return; }
    if (!selectedSubject) { showToast?.('❌ Please select a subject', 'error'); return; }
    if (!name.trim()) { showToast?.('❌ Please enter an assessment name', 'error'); return; }
    if (!maxScore) { showToast?.('❌ Please enter a max score', 'error'); return; }

    const ms = parseFloat(maxScore);
    if (isNaN(ms) || ms <= 0) {
      showToast?.('❌ Max score must be a positive number', 'error');
      return;
    }

    setSaving(true);
    try {
      const record = {
        id: editingId || generateUUID(),
        name: name.trim(),
        subjectname: selectedSubject,
        grade: selectedGrade,
        maxscore: ms,
        date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('assessments').upsert(record, { onConflict: 'id' });
      if (error) throw error;

      showToast?.(editingId ? '✅ Assessment updated' : '✅ Assessment created', 'success');
      setName(''); setMaxScore(''); setEditingId(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast?.('❌ ' + (err.message || 'Failed to save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('assessments').delete().eq('id', id);
      if (error) throw error;
      showToast?.(`🗑️ ${t('assessment.deletedSuccess')}`, 'success');
      setDeleteConfirmId(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast?.(`❌ ${err.message || t('common.error')}`, 'error');
    }
  };

  const handleEdit = (a: Assessment) => {
    setSelectedGrade(a.grade);
    setSelectedSubject(a.subjectname);
    setName(a.name);
    setMaxScore(String(a.maxscore));
    setEditingId(a.id);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView 
      style={{ flex: 1, backgroundColor: C.bg }} 
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
      keyboardShouldPersistTaps="handled" 
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
    >
      <Text style={[s.sectionTitle, { marginBottom: 16 }]}>{t('assessment.manageTitle')}</Text>

      {/* Create / Edit Form */}
      <View style={[s.dashboardCard, { borderRadius: 20, padding: 16, marginBottom: 20 }]}>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 15, marginBottom: 12 }}>
          {editingId ? `✏️ ${t('common.save')}` : `➕ ${t('assessment.newTitle')}`}
        </Text>

        {/* Grade selector */}
        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>{t('profile.grade')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {myGrades.map((g: string) => (
            <TouchableOpacity
              key={g}
              style={[s.gradeChip, normG(selectedGrade) === normG(g) && s.gradeChipActive]}
              onPress={() => { setSelectedGrade(g); setSelectedSubject(''); }}
            >
              <Text style={[s.gradeChipText, normG(selectedGrade) === normG(g) && s.gradeChipTextActive]}>{fmtGrade(g)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Subject selector */}
        {selectedGrade ? (
          <>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>{t('assessment.subject')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {mySubjects.map((subName: string, i: number) => (
                <TouchableOpacity
                  key={`sub-${i}`}
                  style={[s.gradeChip, normS(selectedSubject) === normS(subName) && s.gradeChipActive]}
                  onPress={() => setSelectedSubject(subName)}
                >
                  <Text style={[s.gradeChipText, normS(selectedSubject) === normS(subName) && s.gradeChipTextActive]}>{subName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Name & Max Score */}
        <TextInput
          style={[s.searchInput, { marginBottom: 10 }]}
          placeholder={t('assessment.namePlaceholder')}
          placeholderTextColor={C.muted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[s.searchInput, { marginBottom: 14 }]}
          placeholder={t('assessment.maxScorePlaceholder')}
          placeholderTextColor={C.muted}
          value={maxScore}
          onChangeText={setMaxScore}
          keyboardType="numeric"
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {editingId && (
            <TouchableOpacity
              onPress={() => { setName(''); setMaxScore(''); setEditingId(null); }}
              style={{ flex: 1, backgroundColor: C.border, padding: 12, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ flex: 1, backgroundColor: C.accent, padding: 12, borderRadius: 12, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '800' }}>{editingId ? t('common.save') : t('common.save')}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Assessment List */}
      <Text style={{ color: C.text, fontWeight: '800', fontSize: 15, marginBottom: 12 }}>
        {t('assessment.yourAssessments', { count: filteredAssessments.length })}
      </Text>

      {filteredAssessments.length === 0 && (
        <Text style={[s.empty, { marginTop: 32 }]}>{t('assessment.noAssessments')}</Text>
      )}

      {filteredAssessments.map(a => (
        <View key={a.id} style={[s.dashboardCard, { borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{a.name}</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{a.subjectname} • {fmtGrade(a.grade)} • Max: {a.maxscore}</Text>
          </View>
          <TouchableOpacity onPress={() => handleEdit(a)} style={{ padding: 8, marginRight: 4 }}>
            <Edit size={18} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDeleteConfirmId(a.id)} style={{ padding: 8 }}>
            <Trash2 size={18} color={C.red} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Delete confirmation modal */}
      <Modal visible={!!deleteConfirmId} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('assessment.confirmDelete')}</Text>
            <Text style={[s.modalSub, { marginBottom: 20 }]}>
              {t('assessment.deleteWarning')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setDeleteConfirmId(null)} style={[s.modalBtn, { backgroundColor: C.border }]}>
                <Text style={[s.modalBtnText, { color: C.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteConfirmId && handleDelete(deleteConfirmId)} style={[s.modalBtn, { backgroundColor: C.red }]}>
                <Text style={[s.modalBtnText, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}


// ═══════════════════════════════════════════════════════════════
//  ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════
function AnalyticsTab({ teacher, students: allStudents, assessments: allAssessments, marks, C, s, onRefresh, settings, subjects }: {
  teacher: Teacher, students: Student[], assessments: Assessment[], marks: any[], C: any, s: any, onRefresh?: () => Promise<void> | void, settings: any, subjects: any[]
}) {
  const { t } = useTranslation();
  
  // Filter for THIS teacher (Memoized)
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];

  const assignedSubjectsRaw = (teacher as any)?.assignedsubjects ?? (teacher as any)?.assignedSubjects;
  const hasTeacherAssignedSubjects = Array.isArray(assignedSubjectsRaw) && assignedSubjectsRaw.length > 0;
  const mySubjects = hasTeacherAssignedSubjects ? assignedSubjectsRaw : [];
  
  const students = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );
  const assessments = useMemo(() => 
    allAssessments.filter(a => {
      const isGradeMatch = !hasTeacherAssignedGrades || myGrades.includes(normG(a.grade)) || myGrades.includes(a.grade);
      const isSubjectMatch = (!hasTeacherAssignedSubjects || mySubjects.includes(a.subjectname)) && !isConduct(a);
      
      const subject = subjects.find(sub => normS(sub.name) === normS(a.subjectname));
      const assessmentSemester = subject?.semester || 'Semester I';
      const isSemesterMatch = assessmentSemester === (settings.currentSemester || 'Semester I');

      return isGradeMatch && isSubjectMatch && isSemesterMatch;
    }),
    [allAssessments, hasTeacherAssignedGrades, myGrades, hasTeacherAssignedSubjects, mySubjects, subjects, settings.currentSemester]
  );

  const etYear = computeEthiopianYear();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };

  const studentStats = students.map(st => {
    const sMarks = marks.filter(m => m.studentid === st.id);
    const total = sMarks.reduce((acc, m) => acc + (Number(m.score) || 0), 0);
    const maxPoss = sMarks.reduce((acc, m) => {
      const ass = assessments.find(a => a.id === m.assessmentid);
      return acc + (ass?.maxscore || 100);
    }, 0);
    const perc = maxPoss > 0 ? (total / maxPoss) * 100 : 0;
    return { name: st.name, perc, count: sMarks.length };
  }).filter(s => s.count > 0).sort((a, b) => b.perc - a.perc);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}>
      <View style={{ marginBottom: 24 }}>
        <Text style={s.sectionTitle}>{t('teacher.analytics')}</Text>
        <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>📅 {etYear} E.C. • {settings.currentSemester || 'Semester I'}</Text>
      </View>

      <View style={[s.dashboardCard, { borderRadius: 24, padding: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TrendingUp size={20} color={C.green} stroke={C.green} />
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginLeft: 8 }}>{t('teacher.topPerformers')}</Text>
        </View>
        {studentStats.slice(0, 5).map((st, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: C.border }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Text style={{ color: C.accent, fontWeight: '900', fontSize: 12 }}>{i + 1}</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '600', flex: 1 }}>{st.name}</Text>
            <Text style={{ color: C.green, fontWeight: '900', fontSize: 15 }}>{st.perc.toFixed(1)}%</Text>
          </View>
        ))}
        {studentStats.length === 0 && <Text style={[s.empty, { marginTop: 20 }]}>{t('teacher.noPerfData')}</Text>}
      </View>

      <View style={[s.dashboardCard, { borderRadius: 24, padding: 20, marginTop: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <BarChart3 size={20} color={C.accent} stroke={C.accent} />
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginLeft: 8 }}>{t('teacher.classTrend')}</Text>
        </View>
        {assessments.slice(0, 5).map((ass, i) => {
          const aMarks = marks.filter(m => m.assessmentid === ass.id);
          const total = aMarks.reduce((acc, m) => acc + (Number(m.score) || 0), 0);
          const avgPerc = aMarks.length > 0 ? (total / (aMarks.length * ass.maxscore)) * 100 : 0;
          return (
            <View key={i} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{ass.name}</Text>
                <Text style={{ color: C.accent, fontWeight: '800' }}>{avgPerc.toFixed(1)}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3 }}>
                <View style={{ height: 6, backgroundColor: C.accent, borderRadius: 3, width: `${Math.max(avgPerc, 2)}%` }} />
              </View>
            </View>
          );
        })}
        {assessments.length === 0 && <Text style={[s.empty, { marginTop: 20 }]}>{t('teacher.noAssData')}</Text>}
      </View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STUDENT PROFILE MODAL
// ═══════════════════════════════════════════════════════════════
function StudentProfileModal({ student, onClose, assessments, marks, allStudents, C, s }: {
  student: Student | null, onClose: () => void, assessments: Assessment[], marks: any[], allStudents: Student[], C: any, s: any
}) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'overview' | 'attendance' | 'marks' | 'cert'>('overview');

  if (!student) return null;

  const studentMarks = marks.filter(m => {
    const ass = assessments.find(a => a.id === m.assessmentid);
    return m.studentid === student.id && ass && !isConduct(ass);
  });
  
  // Rank Calculations
  const calculateRanks = () => {
    if (!student || !allStudents || !marks || !assessments) return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };

    const studentGradeNorm = String(student.grade);
    const gradeAssesses = assessments.filter(a => 
      String(a.grade) === studentGradeNorm && !isConduct(a)
    );
    if (gradeAssesses.length === 0) return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };
    
    const assessIds = gradeAssesses.map(a => a.id);
    const pertinentMarks = marks.filter(m => assessIds.includes(m.assessmentid));

    const studentsInGrade = allStudents.filter(s => String(s.grade) === studentGradeNorm);
    
    const rankings = studentsInGrade.map(s => {
      let sTotalScore = 0;
      let sTotalMax = 0;
      
      gradeAssesses.forEach(a => {
        const mark = pertinentMarks.find(m => m.studentid === s.id && m.assessmentid === a.id);
        if (mark) sTotalScore += Number(mark.score) || 0;
        sTotalMax += a.maxscore;
      });
      
      const sPercentage = sTotalMax > 0 ? (sTotalScore / sTotalMax) * 100 : 0;
      return { id: s.id, grade: s.grade, percentage: sPercentage, hasData: sTotalMax > 0 };
    }).filter(s => s.hasData);

    rankings.sort((a, b) => b.percentage - a.percentage);

    const overallRankIndex = rankings.findIndex(r => r.id === student.id);
    const overallRank = overallRankIndex !== -1 ? overallRankIndex + 1 : 'N/A';
    const totalInGrade = rankings.length;

    const classRankings = rankings.filter(r => r.grade === student.grade);
    const classRankIndex = classRankings.findIndex(r => r.id === student.id);
    const classRank = classRankIndex !== -1 ? classRankIndex + 1 : 'N/A';
    const totalInClass = classRankings.length;

    return { classRank, overallRank, totalInClass, totalInGrade };
  };

  const { classRank, overallRank, totalInClass, totalInGrade } = calculateRanks();

  const totalScore = studentMarks.reduce((acc, m) => acc + (Number(m.score) || 0), 0);
  const maxPossible = studentMarks.reduce((acc, m) => {
    const ass = assessments.find(a => a.id === m.assessmentid);
    return acc + (ass?.maxscore || 100);
  }, 0);
  const avg = maxPossible > 0 ? ((totalScore / maxPossible) * 100).toFixed(1) : '0';

  const sections = [
    { key: 'overview', label: t('profile.overview'), icon: <Info size={18} color={subTab === 'overview' ? C.accent : C.muted} stroke={subTab === 'overview' ? C.accent : C.muted} /> },
    { key: 'attendance', label: t('profile.attendance'), icon: <CalendarCheck size={18} color={subTab === 'attendance' ? C.accent : C.muted} stroke={subTab === 'attendance' ? C.accent : C.muted} /> },
    { key: 'marks', label: t('profile.marks'), icon: <TrendingUp size={18} color={subTab === 'marks' ? C.accent : C.muted} stroke={subTab === 'marks' ? C.accent : C.muted} /> },
    { key: 'cert', label: t('profile.cert'), icon: <Users size={18} color={subTab === 'cert' ? C.accent : C.muted} stroke={subTab === 'cert' ? C.accent : C.muted} /> },
  ];

  return (
    <Modal visible={!!student} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={C.isDark ? 'dark' : 'light'} />
        <View style={[s.modalCard, { height: '85%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 0, overflow: 'hidden' }]}>
          <View style={{ padding: 24, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={[s.modalTitle, { fontSize: 24, fontWeight: '900', color: C.text }]}>{student.name}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={[s.themeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
                <Text style={{ color: C.text, fontSize: 24, lineHeight: 28 }}>×</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            {sections.map(sec => (
              <TouchableOpacity
                key={sec.key}
                onPress={() => setSubTab(sec.key as any)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: subTab === sec.key ? 2 : 0, borderBottomColor: C.accent }}
              >
                {sec.icon}
                <Text style={{ color: subTab === sec.key ? C.accent : C.muted, fontSize: 11, fontWeight: subTab === sec.key ? '800' : '600', marginTop: 4 }}>
                  {sec.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {subTab === 'overview' && (
              <View>
                <View style={[s.dashboardCard, { flexDirection: 'row', padding: 20, marginBottom: 20, borderRadius: 24 }]}>
                  <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border }}>
                    <Text style={{ color: C.green, fontSize: 28, fontWeight: '900' }}>{avg}%</Text>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{t('profile.average').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: C.accent, fontSize: 28, fontWeight: '900' }}>{student.grade}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{t('profile.grade').toUpperCase()}</Text>
                  </View>
                </View>

                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{t('profile.baptismalName').toUpperCase()}</Text>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.baptismalname || t('profile.notProvided')}</Text>
                  </View>
                  <View>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{t('profile.contact').toUpperCase()}</Text>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.parentcontact || t('profile.notProvided')}</Text>
                  </View>
                </View>
              </View>
            )}

            {subTab === 'marks' && (
              <View style={{ gap: 12 }}>
                {assessments.filter(a => 
                  normG(a.grade) === normG(student.grade) && !isConduct(a)
                ).map((ass, idx) => {
                  const mark = studentMarks.find(m => m.assessmentid === ass.id);
                  const perc = mark ? (Number(mark.score) / ass.maxscore) * 100 : 0;
                  return (
                    <View key={idx} style={[s.dashboardCard, { borderRadius: 16, padding: 16, borderStyle: mark ? 'solid' : 'dashed', borderColor: mark ? C.border : C.amber + '44' }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{ass.name}</Text>
                          <Text style={{ color: C.muted, fontSize: 12 }}>{ass.subjectname}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          {mark ? (
                            <>
                              <Text style={{ color: C.accent, fontWeight: '900', fontSize: 18 }}>{mark.score}</Text>
                              <Text style={{ color: C.muted, fontSize: 11 }}>/ {ass.maxscore}</Text>
                            </>
                          ) : (
                            <View style={{ backgroundColor: C.amber + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                              <Text style={{ color: C.amber, fontWeight: '900', fontSize: 12 }}>{t('profile.missing').toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {mark ? (
                        <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2 }}>
                          <View style={{ height: 4, backgroundColor: perc > 50 ? C.green : C.amber, borderRadius: 2, width: `${perc}%` }} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {subTab === 'cert' && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: '100%', minHeight: 480, backgroundColor: '#fdfbf7', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#e8dfce', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }}>
                  {/* Minimalist Corner Accents */}
                  <View style={{ position: 'absolute', top: 16, left: 16, width: 32, height: 32, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#d4af37' }} />
                  <View style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#d4af37' }} />
                  <View style={{ position: 'absolute', bottom: 16, left: 16, width: 32, height: 32, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: '#d4af37' }} />
                  <View style={{ position: 'absolute', bottom: 16, right: 16, width: 32, height: 32, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#d4af37' }} />

                  {/* Header - Amharic First */}
                  <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <EthiopianCross size={40} />
                    <Text style={{ color: '#2c1810', fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 12 }}>{t('cert.title', { lng: 'am' })}</Text>
                    <Text style={{ color: '#5c4033', fontSize: 11, textAlign: 'center', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginTop: 4 }}>{t('cert.title', { lng: 'am' })}</Text>
                    <View style={{ height: 1, width: 40, backgroundColor: '#d4af37', marginVertical: 12 }} />
                    <Text style={{ color: '#8b0000', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('cert.title', { lng: 'en' })}</Text>
                  </View>

                  {/* Student Info - Amharic/English Labels */}
                  <View style={{ borderBottomWidth: 1, borderBottomColor: '#e8dfce', paddingBottom: 16, marginBottom: 24 }}>
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 10, color: '#8c7361', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('cert.name', { lng: 'am' })} / {t('cert.name', { lng: 'en' })}</Text>
                      <Text style={{ fontSize: 20, color: '#2c1810', fontWeight: '700' }}>{student.name}</Text>
                      {student.baptismalname ? <Text style={{ fontSize: 13, color: '#5c4033', fontStyle: 'italic', fontWeight: '500' }}>{student.baptismalname}</Text> : null}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 10, color: '#8c7361', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('cert.grade', { lng: 'am' })} / {t('cert.grade', { lng: 'en' })}</Text>
                        <Text style={{ fontSize: 16, color: '#2c1810', fontWeight: '700' }}>{fmtGrade(student.grade)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: '#8c7361', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('cert.year', { lng: 'am' })} / {t('cert.year', { lng: 'en' })}</Text>
                        <Text style={{ fontSize: 16, color: '#2c1810', fontWeight: '700' }}>{computeEthiopianYear()} E.C.</Text>
                      </View>
                    </View>
                  </View>

                  {/* Table - Amharic Headers First */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d4af3733', paddingBottom: 10, marginBottom: 12 }}>
                      <Text style={{ flex: 2, fontSize: 11, fontWeight: '800', color: '#8c7361' }}>{t('cert.subject', { lng: 'am' })} / {t('cert.subject', { lng: 'en' })}</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: '#8c7361', textAlign: 'center' }}>{t('cert.score', { lng: 'am' })} / {t('cert.score', { lng: 'en' })}</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: '#8c7361', textAlign: 'center' }}>{t('cert.avg', { lng: 'am' })} / {t('cert.avg', { lng: 'en' })}</Text>
                    </View>
                    
                    {assessments.filter(a => String(a.grade) === String(student.grade) && !isConduct(a)).slice(0, 7).map((a, i) => {
                      const m = marks.find(mark => mark.studentid === student.id && mark.assessmentid === a.id);
                      const perc = m ? ((Number(m.score) / a.maxscore) * 100).toFixed(0) : null;
                      return (
                        <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e8dfce55' }}>
                          <Text style={{ flex: 2, fontSize: 12, color: '#2c1810', fontWeight: '600' }}>{a.name}</Text>
                          <Text style={{ flex: 1, fontSize: 12, color: '#5c4033', textAlign: 'center' }}>{m ? `${m.score}/${a.maxscore}` : '—'}</Text>
                          <Text style={{ flex: 1, fontSize: 12, color: '#2c1810', textAlign: 'center', fontWeight: '800' }}>{perc ? `${perc}%` : '—'}</Text>
                        </View>
                      );
                    })}

                    <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 2, borderTopColor: '#e8dfce' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#2c1810' }}>{t('cert.total', { lng: 'am' })} / {t('cert.total', { lng: 'en' })}</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#8b0000' }}>{avg}%</Text>
                      </View>
                      
                      {totalInClass > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#5c4033' }}>ክፍል ደረጃ / Class Rank</Text>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#2c1810' }}>{classRank} / {totalInClass}</Text>
                        </View>
                      )}
                      
                      {totalInGrade > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#5c4033' }}>አጠቃላይ ደረጃ / Grade Rank</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#5c4033' }}>{overallRank} / {totalInGrade}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Status Banner */}
                  <View style={{ marginTop: 24, backgroundColor: '#8b000010', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#8b000020' }}>
                    <Text style={{ color: '#8b0000', fontSize: 10, textAlign: 'center', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Live Preview (Senbet Management System)
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {subTab === 'attendance' && (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <CalendarCheck size={48} color={C.accent + '44'} stroke={C.accent + '44'} />
                <Text style={{ color: C.muted, textAlign: 'center', marginTop: 16, fontWeight: '600' }}>Attendance history feature coming soon</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════
function makeStyles(C: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 36 : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  loginRoot: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 24 },
  loginTitle: { color: C.text, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  loginSub: { color: C.accent, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 32 },
  loginCard: { backgroundColor: C.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border },
  inputLabel: { color: C.muted, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  loginInput: {
    backgroundColor: C.input, color: C.text, borderRadius: 12, padding: 14, fontSize: 16,
    borderWidth: 1, borderColor: C.border
  },
  loginBtn: { backgroundColor: C.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  logoutBtn: { backgroundColor: C.red + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.red },
  logoutBtnText: { color: C.red, fontSize: 16, fontWeight: '700' },

  syncBtn: { backgroundColor: C.border, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  themeBtn: { backgroundColor: C.border, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  syncBtnText: { fontSize: 16 },

  dashboardCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border },
  dashboardAction: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 18,
    borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },

  tabBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card,
    paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  tabItem: { alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 22, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: C.muted, fontWeight: '600' },
  tabLabelActive: { color: C.accent },

  searchInput: {
    margin: 16, marginBottom: 0, backgroundColor: C.card, color: C.text,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: C.border,
  },

  studentCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  studentName: { color: C.text, fontSize: 16, fontWeight: '600' },
  studentSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: C.accent + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { color: C.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },

  gradeChip: {
    backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: C.border,
  },
  gradeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  gradeChipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  gradeChipTextActive: { color: '#fff' },

  attendanceRow: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  markRow: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  markInput: {
    backgroundColor: C.input, color: C.text, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, width: 100, textAlign: 'right',
    fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: C.border,
  },
  markHistoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel: { color: C.muted, fontSize: 14 },
  infoValue: { color: C.text, fontSize: 14, fontWeight: '600' },
  maxScoreBar: {
    backgroundColor: C.accent + '15', borderRadius: 8, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: C.accent + '44',
  },

  saveBtn: {
    backgroundColor: C.accent, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  issueCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  issueTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  issueSub: { color: C.muted, fontSize: 13, marginBottom: 16 },
  issueRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  issueText: { color: C.text, fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: C.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalSub: { color: C.muted, fontSize: 14, marginBottom: 20 },
  modalBtn: { flex: 1, backgroundColor: C.accent, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, marginBottom: 4
  },
  sidebarIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.border + '33',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  sidebarText: { color: C.text, fontSize: 15, fontWeight: '600' },
  });
}
