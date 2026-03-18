import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  Modal,
  Image,
  Image as RNImage,
} from 'react-native';
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
  Home, Users, CalendarCheck, BarChart3, AlertTriangle, Settings, LogOut, Moon, Sun, Languages, RefreshCw, TrendingUp, Info, BookOpen
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
}
interface Assessment {
  id: string;
  name: string;
  subjectname: string;
  grade: string;
  maxscore: number;
  date: string;
  issystemconductassessment?: boolean;
}
interface Teacher {
  id: string;
  name: string;
  accesscode: string;
  assignedgrades?: string[];
  assignedsubjects?: string[];
}

// ── Theme Management ──────────────────────────────────────────
const THEMES = {
  dark: {
    bg: '#020617', // Deeper blue-black
    card: '#0f172a',
    border: '#1e293b',
    accent: '#3b82f6',
    accentMuted: '#3b82f622',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    slate: '#64748b',
    text: '#f8fafc',
    muted: '#64748b',
    input: '#1e293b',
    glass: 'rgba(15, 23, 42, 0.8)',
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
  }
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
  const [authLoading, setAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);

  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);

  const C = isDark ? THEMES.dark : THEMES.light;
  const s = makeStyles(C);

  // Load Auth, Theme & Cached Data
  useEffect(() => {
    (async () => {
      try {
        const [savedAuth, savedTheme, savedStudents, savedAssessments, savedMarks, savedLastSync] = await Promise.all([
          AsyncStorage.getItem('senbet_teacher_auth'),
          AsyncStorage.getItem('senbet_theme'),
          AsyncStorage.getItem('cached_students'),
          AsyncStorage.getItem('cached_assessments'),
          AsyncStorage.getItem('cached_marks'),
          AsyncStorage.getItem('last_sync_time'),
        ]);

        if (savedAuth) setTeacher(JSON.parse(savedAuth));
        if (savedTheme) setIsDark(savedTheme === 'dark');
        if (savedStudents) setStudents(JSON.parse(savedStudents));
        if (savedAssessments) setAssessments(JSON.parse(savedAssessments));
        if (savedMarks) setMarks(JSON.parse(savedMarks));
        if (await AsyncStorage.getItem('cached_attendance')) setAttendance(JSON.parse(await AsyncStorage.getItem('cached_attendance') || '[]'));
        if (savedLastSync) setLastSync(savedLastSync);

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
    if (!teacher) return;
    if (!isBackground) setSyncing(true);

    try {
      let sQuery = supabase.from('students').select('*').order('name');
      if (teacher.assignedgrades && teacher.assignedgrades.length > 0) {
        sQuery = sQuery.in('grade', teacher.assignedgrades);
      }
      const { data: sRes, error: sErr } = await sQuery;
      if (sErr) throw sErr;

      let aQuery = supabase.from('assessments').select('*').order('name');
      if (teacher.assignedgrades && teacher.assignedgrades.length > 0) {
        aQuery = aQuery.in('grade', teacher.assignedgrades);
      }
      if (teacher.assignedsubjects && teacher.assignedsubjects.length > 0) {
        aQuery = aQuery.in('subjectname', teacher.assignedsubjects);
      }
      const { data: aRes, error: aErr } = await aQuery;
      if (aErr) throw aErr;

      const aIds = (aRes || []).map(a => a.id);
      let mRes: any[] = [];
      if (aIds.length > 0) {
        const { data, error: mErr } = await supabase.from('marks').select('*').in('assessmentid', aIds);
        if (mErr) throw mErr;
        mRes = data || [];
      }

      const { data: attRes, error: attErr } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', dayjs().format('YYYY-MM-DD'));
      if (attErr) throw attErr;

      const now = formatEthiopianTime(new Date());
      setStudents(sRes || []);
      setAssessments(aRes || []);
      setMarks(mRes);
      setAttendance(attRes || []);
      setLastSync(now);

      await Promise.all([
        AsyncStorage.setItem('cached_students', JSON.stringify(sRes || [])),
        AsyncStorage.setItem('cached_assessments', JSON.stringify(aRes || [])),
        AsyncStorage.setItem('cached_marks', JSON.stringify(mRes)),
        AsyncStorage.setItem('cached_attendance', JSON.stringify(attRes || [])),
        AsyncStorage.setItem('last_sync_time', now),
      ]);

      if (!isBackground) Alert.alert('Sync Complete', 'Data updated from cloud.');
    } catch (err: any) {
      console.error('Sync error', err);
      if (!isBackground) Alert.alert('Sync Failed', 'Could not reach server. Using offline data.');
    } finally {
      if (!isBackground) setSyncing(false);
    }
  }, [teacher]);

  useEffect(() => {
    if (teacher) syncData(true);
  }, [teacher, syncData]);

  const handleLogin = async (t: Teacher) => {
    setTeacher(t);
    await AsyncStorage.setItem('senbet_teacher_auth', JSON.stringify(t));
  };

  const handleLogout = async () => {
    setTeacher(null);
    setStudents([]); setAssessments([]); setMarks([]); setAttendance([]);
    await AsyncStorage.multiRemove([
      'senbet_teacher_auth', 'cached_students', 'cached_assessments', 'cached_marks', 'cached_attendance', 'last_sync_time'
    ]);
  };

  if (authLoading) return <View style={[s.center, { backgroundColor: C.bg }]}><ActivityIndicator size="large" color={C.accent} /></View>;
  if (!teacher) return <TeacherLogin onLogin={handleLogin} isDark={isDark} toggleTheme={toggleTheme} toggleLanguage={toggleLanguage} />;

  // ── Tab Navigator ───────────────────────────────────────────
  function Tabs({ navigation }: any) {
    return (
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
            if (route.name === 'Analytics') return <TrendingUp size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
            return <AlertTriangle size={size} color={color} strokeWidth={focused ? 2.5 : 2} />;
          }
        })}
      >
        <Tab.Screen name="Dashboard">{(props: any) => <DashboardTab {...props} teacher={teacher!} students={students} assessments={assessments} marks={marks} attendance={attendance} C={C} s={s} setTab={(t: any) => props.navigation.navigate(t)} onSync={() => syncData()} isSyncing={syncing} />}</Tab.Screen>
        <Tab.Screen name="Students">{() => <StudentsTab teacher={teacher!} students={students} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} />}</Tab.Screen>
        <Tab.Screen name="Attendance">{() => <AttendanceTab teacher={teacher!} students={students} attendanceData={attendance} onRefresh={() => syncData()} C={C} s={s} />}</Tab.Screen>
        <Tab.Screen name="Marks">{() => <MarksTab teacher={teacher!} students={students} assessments={assessments} marksData={marks} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} />}</Tab.Screen>
        <Tab.Screen name="Analytics">{() => <AnalyticsTab students={students} assessments={assessments} marks={marks} C={C} s={s} />}</Tab.Screen>
        <Tab.Screen name="Urgent">{() => <UrgentMattersTab teacher={teacher!} students={students} assessments={assessments} marksData={marks} C={C} s={s} />}</Tab.Screen>
      </Tab.Navigator>
    );
  }

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <Drawer.Navigator
        drawerContent={(props) => (
          <DrawerContentScrollView {...props} style={{ backgroundColor: C.bg }}>
            <View style={{ padding: 24, paddingBottom: 32, alignItems: 'center' }}>
              <View style={{ width: 100, height: 100, borderRadius: 24, padding: 4, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 20 }}>
                <RNImage source={require('./assets/logo.jpg')} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="contain" />
              </View>
              <Text style={{ color: C.text, fontWeight: '900', fontSize: 16, textAlign: 'center', lineHeight: 22 }}>{t('app.title')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: C.accent + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginRight: 6 }} />
                <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>{teacher.name}</Text>
              </View>
            </View>

            <View style={{ padding: 16, paddingBottom: 0 }}>
              <DrawerItemList {...props} />
            </View>

            <View style={{ padding: 24, marginTop: 'auto', borderTopWidth: 1, borderTopColor: C.border }}>
              <TouchableOpacity onPress={toggleLanguage} style={s.sidebarItem}>
                <View style={[s.sidebarIcon, { backgroundColor: C.accent + '10' }]}><Languages size={18} color={C.accent} /></View>
                <Text style={s.sidebarText}>{i18n.language === 'en' ? 'Amharic (አማርኛ)' : 'English'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleTheme} style={s.sidebarItem}>
                <View style={[s.sidebarIcon, { backgroundColor: C.amber + '10' }]}>{isDark ? <Sun size={18} color={C.amber} /> : <Moon size={18} color={C.slate} />}</View>
                <Text style={s.sidebarText}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
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
        )}
        screenOptions={{
          headerStyle: { backgroundColor: C.bg, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: C.border },
          headerTitleStyle: { color: C.text, fontWeight: '900', fontSize: 18, letterSpacing: -0.5 },
          headerTintColor: C.accent,
          drawerActiveBackgroundColor: C.accent + '15',
          drawerActiveTintColor: C.accent,
          drawerInactiveTintColor: C.muted,
          drawerLabelStyle: { fontWeight: '700', fontSize: 14, marginLeft: -12 },
          drawerStyle: { width: 280, borderRightWidth: 0 },
        }}
      >
        <Drawer.Screen
          name="Main"
          component={Tabs}
          options={{
            title: t('app.title'),
            drawerIcon: ({ color }) => <Home size={18} color={color} />,
            drawerLabel: t('dashboard.title')
          }}
        />
        <Drawer.Screen
          name="StudentList"
          options={{
            title: t('teacher.students'),
            drawerIcon: ({ color }) => <Users size={18} color={color} />
          }}
        >{() => (
          <View style={{ flex: 1 }}>
            <StudentsTab teacher={teacher} students={students} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} />
          </View>
        )}</Drawer.Screen>
        <Drawer.Screen
          name="UrgentList"
          options={{
            title: t('teacher.urgent'),
            drawerIcon: ({ color }) => <AlertTriangle size={18} color={color} />
          }}
        >{() => <UrgentMattersTab teacher={teacher} students={students} assessments={assessments} marksData={marks} C={C} s={s} />}</Drawer.Screen>
      </Drawer.Navigator>

      <StudentProfileModal
        student={profileStudent}
        onClose={() => setProfileStudent(null)}
        assessments={assessments}
        marks={marks}
        allStudents={students}
        C={C}
        s={s}
      />
    </NavigationContainer>
  );
}

function TeacherLogin({ onLogin, isDark, toggleTheme, toggleLanguage }: { onLogin: (t: Teacher) => void, isDark: boolean, toggleTheme: () => void, toggleLanguage: () => void }) {
  const { t, i18n } = useTranslation();
  const C = isDark ? THEMES.dark : THEMES.light;
  const s = makeStyles(C);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!name || !code) return Alert.alert('Missing info', 'Name and code required.');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .ilike('name', name.trim())
        .eq('accesscode', code.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) return Alert.alert('Error', 'Invalid name or access code.');

      onLogin(data);
    } catch (err: any) {
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.loginRoot}>
      <View style={{ position: 'absolute', top: 60, right: 24 }}>
        <TouchableOpacity onPress={toggleTheme}><Text style={{ fontSize: 24 }}>{isDark ? '🌙' : '☀️'}</Text></TouchableOpacity>
      </View>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{ width: 100, height: 100, borderRadius: 24, padding: 4, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 20 }}>
          {/* @ts-ignore */}
          <Image source={require('./assets/logo.jpg')} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="contain" />
        </View>
        <Text style={s.loginTitle}>በግ/ደ/አ/ቅ/አርሴማ</Text>
        <Text style={s.loginSub}>ፍኖተ ብርሃን ሰ/ቤት</Text>
      </View>

      <View style={s.loginCard}>
        <Text style={s.inputLabel}>Full Name</Text>
        <TextInput
          style={s.loginInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Abebe Kedebe"
          placeholderTextColor={C.muted}
        />

        <Text style={s.inputLabel}>Access Code</Text>
        <TextInput
          style={s.loginInput}
          value={code}
          onChangeText={setCode}
          secureTextEntry
          placeholder="6-digit code"
          placeholderTextColor={C.muted}
        />

        <TouchableOpacity style={s.loginBtn} onPress={doLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Login</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ teacher, students, assessments, marks, attendance, C, s, setTab, onSync, isSyncing }: {
  teacher: Teacher, students: Student[], assessments: Assessment[], marks: any[], attendance: any[], C: any, s: any, setTab: (t: any) => void, onSync: () => void, isSyncing: boolean
}) {
  const { t } = useTranslation();
  const today = formatEthiopianDate(new Date());

  const stats = [
    { label: t('dashboard.totalStudents'), value: students.length, icon: <Users size={24} color={C.accent} stroke={C.accent} />, bg: C.accentMuted },
    { label: t('dashboard.attendanceToday'), value: attendance.filter(a => a.status === 'present' || a.status === 'late').length, icon: <CalendarCheck size={24} color={C.green} stroke={C.green} />, bg: C.green + '15' },
    { label: t('teacher.missingMarks'), value: assessments.length * students.length - marks.length, icon: <AlertTriangle size={24} color={C.red} stroke={C.red} />, bg: C.red + '15' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={{ marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={[s.sectionTitle, { marginBottom: 4 }]}>{t('dashboard.title')}</Text>
          <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>📅 {today}</Text>
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
          <View key={idx} style={[s.dashboardCard, { width: '48%', gap: 12 }]}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center' }}>
              {item.icon}
            </View>
            <View>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: '900' }}>{item.value}</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{item.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[s.sectionTitle, { marginTop: 32, marginBottom: 16 }]}>{t('dashboard.recentActivity')}</Text>

      <TouchableOpacity style={s.dashboardAction} onPress={() => setTab('Attendance')}>
        <View style={[s.sidebarIcon, { backgroundColor: C.accent + '15' }]}><CalendarCheck size={20} color={C.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{t('teacher.attendance')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Mark or review student presence</Text>
        </View>
        <TrendingUp size={16} color={C.muted} />
      </TouchableOpacity>

      <TouchableOpacity style={s.dashboardAction} onPress={() => setTab('Marks')}>
        <View style={[s.sidebarIcon, { backgroundColor: C.amber + '15' }]}><BarChart3 size={20} color={C.amber} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{t('teacher.marks')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Update scores and performance</Text>
        </View>
        <TrendingUp size={16} color={C.muted} />
      </TouchableOpacity>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STUDENTS TAB
// ═══════════════════════════════════════════════════════════════
function StudentsTab({ teacher, students, onRefresh, C, s, onStudentPress }: {
  teacher: Teacher, students: Student[], onRefresh: () => Promise<void>, C: any, s: any, onStudentPress: (s: Student) => void
}) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(0);
  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    await onRefresh();
    setRefreshing(false);
  };

  const filtered = students.filter((st) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return st.name?.toLowerCase().includes(q) || st.id?.toLowerCase().includes(q);
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <TextInput
          style={[s.searchInput, { margin: 0 }]}
          placeholder="Search students…"
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
            <Text style={[s.empty, { marginTop: 12 }]}>No students found</Text>
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
function AttendanceTab({ teacher, students, attendanceData, onRefresh, C, s }: {
  teacher: Teacher, students: Student[], attendanceData: any[], onRefresh: () => void, C: any, s: any
}) {
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
      Alert.alert('Success', `Marked ${student.name} as Present`);
    } else {
      Alert.alert('Not Found', 'Student ID not recognized.');
    }
  };

  useEffect(() => {
    const uniqueGrades = [...new Set(students.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
    setGrades(uniqueGrades);
    if (!selectedGrade && uniqueGrades.length > 0) setSelectedGrade(uniqueGrades[0]);
  }, [students]);

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

  const gradeStudents = students.filter((st) => String(st.grade) === selectedGrade);
  const filteredStudents = gradeStudents.filter(st => {
    if (!search) return true;
    return st.name.toLowerCase().includes(search.toLowerCase()) || st.id.toLowerCase().includes(search.toLowerCase());
  });

  const saveAttendance = async () => {
    if (!selectedGrade) return;
    setSaving(true);
    try {
      const records = gradeStudents.map(st => ({
        id: attendanceIds[st.id] || undefined,
        studentid: st.id,
        date,
        status: attendance[st.id] || 'absent',
        markedby: teacher.id,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'id' });
      if (error) throw error;
      Alert.alert('Success', 'Attendance saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
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
          placeholder="Search students..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
                  ]}>{status.toUpperCase()}</Text>
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
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MARKS TAB  (uses lowercase: studentid, assessmentid, etc.)
// ═══════════════════════════════════════════════════════════════
function MarksTab({ teacher, students, assessments, marksData, onRefresh, C, s, onStudentPress }: {
  teacher: Teacher, students: Student[], assessments: Assessment[], marksData: any[], onRefresh: () => void, C: any, s: any, onStudentPress: (s: Student) => void
}) {
  const { t } = useTranslation();
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [markIds, setMarkIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkScore, setBulkScore] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const uniqueGrades = [...new Set(students.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
    setGrades(uniqueGrades);
    if (!selectedGrade && uniqueGrades.length > 0) setSelectedGrade(uniqueGrades[0]);
  }, [students]);

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

  const gradeAssessments = assessments.filter((a) => String(a.grade) === selectedGrade);
  const gradeStudents = students.filter((st) => String(st.grade) === selectedGrade);
  const filteredStudents = gradeStudents.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()));

  const saveMarks = async () => {
    if (!selectedAssessment) return;
    setSaving(true);
    try {
      const records = gradeStudents.map(student => {
        const scoreStr = marks[student.id];
        const score = scoreStr && scoreStr !== '' ? Math.round(parseFloat(scoreStr)) : null;
        const existingId = markIds[student.id];
        
        return {
          id: existingId || undefined,
          studentid: student.id,
          assessmentid: selectedAssessment.id,
          score,
          assessmentdate: selectedAssessment.date,
          updated_at: new Date().toISOString()
        };
      }).filter(r => r.score !== null);

      const { error } = await supabase.from('marks').upsert(records, { onConflict: 'id' });
      if (error) throw error;
      Alert.alert('Success', 'Marks saved successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={[s.sectionTitle, { marginBottom: 16 }]}>{t('teacher.marks')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {grades.map((g) => (
            <TouchableOpacity
              key={g}
              style={[s.gradeChip, selectedGrade === g && s.gradeChipActive]}
              onPress={() => { setSelectedGrade(g); setSelectedAssessment(null); }}
            >
              <Text style={[s.gradeChipText, selectedGrade === g && s.gradeChipTextActive]}>{fmtGrade(g)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {gradeAssessments.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {gradeAssessments.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[s.gradeChip, { borderRadius: 12, paddingHorizontal: 12 }, selectedAssessment?.id === a.id && s.gradeChipActive]}
                onPress={() => setSelectedAssessment(a)}
              >
                <Text style={[s.gradeChipText, selectedAssessment?.id === a.id && s.gradeChipTextActive]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TextInput
          style={[s.searchInput, { margin: 0, marginBottom: 16 }]}
          placeholder="Search students..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={paginate(filteredStudents, page)}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={selectedAssessment ? (
          <View style={[s.maxScoreBar, { borderRadius: 12, marginBottom: 16 }]}>
            <Text style={{ color: C.accent, fontWeight: '700', textAlign: 'center' }}>
              {selectedAssessment.name} - Max Score: {selectedAssessment.maxscore}
            </Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={[s.markRow, { padding: 12, borderRadius: 16 }]}>
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
                  Alert.alert('Invalid Score', `Max score allowed is ${selectedAssessment.maxscore}`);
                  return;
                }
                setMarks(prev => ({ ...prev, [item.id]: val }));
              }}
              editable={!!selectedAssessment}
            />
          </View>
        )}
        onEndReached={() => setPage(p => p + 1)}
        onEndReachedThreshold={0.5}
      />

      {selectedAssessment && (
        <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
          <TouchableOpacity
            style={[s.loginBtn, { marginTop: 0 }]}
            onPress={saveMarks}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Save Marks</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  URGENT MATTERS TAB
// ═══════════════════════════════════════════════════════════════
function UrgentMattersTab({ teacher, students, assessments, marksData, C, s }: {
  teacher: Teacher, students: Student[], assessments: Assessment[], marksData: any[], C: any, s: any
}) {
  const { t } = useTranslation();
  const missingMarksByAssessment = assessments.map(a => {
    const studentsForGrade = students.filter(st => String(st.grade) === String(a.grade));
    const ungraded = studentsForGrade.filter(st => !marksData.some(m => m.studentid === st.id && m.assessmentid === a.id));
    return { assessment: a, count: ungraded.length, students: ungraded };
  }).filter(item => item.count > 0);

  const studentsWithNoMarks = students.filter(st => {
    const assessmentsForGrade = assessments.filter(a => String(a.grade) === String(st.grade));
    if (assessmentsForGrade.length === 0) return false;
    return !marksData.some(m => m.studentid === st.id && assessmentsForGrade.some(a => a.id === m.assessmentid));
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={s.sectionTitle}>⚠️ {t('teacher.urgent')}</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>Items requiring immediate attention</Text>
      </View>

      {studentsWithNoMarks.length > 0 && (
        <View style={[s.issueCard, { borderRadius: 20, padding: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <AlertTriangle size={20} color={C.red} stroke={C.red} />
            <Text style={[s.issueTitle, { marginLeft: 8, marginBottom: 0 }]}>Students with NO Marks</Text>
          </View>
          <Text style={s.issueSub}>These students have no recorded assessments.</Text>
          {studentsWithNoMarks.map(st => (
            <View key={st.id} style={[s.issueRow, { borderTopColor: C.border }]}>
              <Users size={14} color={C.muted} stroke={C.muted} />
              <Text style={[s.issueText, { marginLeft: 8 }]}>{st.name}</Text>
              <View style={{ flex: 1 }} />
              <View style={s.badge}><Text style={s.badgeText}>{fmtGrade(st.grade)}</Text></View>
            </View>
          ))}
        </View>
      )}

      {missingMarksByAssessment.length > 0 && (
        <View style={[s.issueCard, { borderRadius: 20, padding: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <BarChart3 size={20} color={C.amber} stroke={C.amber} />
            <Text style={[s.issueTitle, { marginLeft: 8, marginBottom: 0 }]}>Incomplete Assessments</Text>
          </View>
          <Text style={s.issueSub}>Assessments with missing student scores.</Text>
          {missingMarksByAssessment.map(item => (
            <View key={item.assessment.id} style={[s.issueRow, { borderTopColor: C.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.issueText}>{item.assessment.name}</Text>
                <Text style={s.issueSub}>{item.count} students missing</Text>
              </View>
              <View style={s.badge}><Text style={s.badgeText}>{item.assessment.subjectname}</Text></View>
            </View>
          ))}
        </View>
      )}

      {studentsWithNoMarks.length === 0 && missingMarksByAssessment.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 100 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.green + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <TrendingUp size={40} color={C.green} stroke={C.green} />
          </View>
          <Text style={[s.empty, { color: C.text, fontWeight: '700' }]}>Everything is up to date!</Text>
          <Text style={{ color: C.muted, marginTop: 4 }}>No urgent matters found.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════
function AnalyticsTab({ students, assessments, marks, C, s }: {
  students: Student[], assessments: Assessment[], marks: any[], C: any, s: any
}) {
  const { t } = useTranslation();
  const etYear = computeEthiopianYear();

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
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={s.sectionTitle}>{t('teacher.analytics')}</Text>
        <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>📅 Academic Year: {etYear} E.C.</Text>
      </View>

      <View style={[s.dashboardCard, { borderRadius: 24, padding: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <TrendingUp size={20} color={C.green} stroke={C.green} />
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginLeft: 8 }}>Top Performers</Text>
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
        {studentStats.length === 0 && <Text style={[s.empty, { marginTop: 20 }]}>No performance data yet.</Text>}
      </View>

      <View style={[s.dashboardCard, { borderRadius: 24, padding: 20, marginTop: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <BarChart3 size={20} color={C.accent} stroke={C.accent} />
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', marginLeft: 8 }}>Class Average Trend</Text>
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
        {assessments.length === 0 && <Text style={[s.empty, { marginTop: 20 }]}>No assessment data yet.</Text>}
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

  const studentMarks = marks.filter(m => m.studentid === student.id);
  
  // Rank Calculations
  const calculateRanks = () => {
    if (!student || !allStudents || !marks || !assessments) return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };

    const studentGradeNorm = String(student.grade);
    const gradeAssesses = assessments.filter(a => String(a.grade) === studentGradeNorm);
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
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>GRADE</Text>
                  </View>
                </View>

                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>BAPTISMAL NAME</Text>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.baptismalname || 'Not provided'}</Text>
                  </View>
                  <View>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>PARENT CONTACT</Text>
                    <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.parentcontact || 'Not provided'}</Text>
                  </View>
                </View>
              </View>
            )}

            {subTab === 'marks' && (
              <View style={{ gap: 12 }}>
                {studentMarks.map((m, idx) => {
                  const ass = assessments.find(a => a.id === m.assessmentid);
                  const perc = ass ? (Number(m.score) / ass.maxscore) * 100 : 0;
                  return (
                    <View key={idx} style={[s.dashboardCard, { borderRadius: 16, padding: 16 }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View>
                          <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{ass?.name || 'Assessment'}</Text>
                          <Text style={{ color: C.muted, fontSize: 12 }}>{ass?.subjectname}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: C.accent, fontWeight: '900', fontSize: 18 }}>{m.score}</Text>
                          <Text style={{ color: C.muted, fontSize: 11 }}>/ {ass?.maxscore}</Text>
                        </View>
                      </View>
                      <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2 }}>
                        <View style={{ height: 4, backgroundColor: perc > 50 ? C.green : C.amber, borderRadius: 2, width: `${perc}%` }} />
                      </View>
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
                    <Text style={{ color: '#2c1810', fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 12 }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Text>
                    <Text style={{ color: '#5c4033', fontSize: 11, textAlign: 'center', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, marginTop: 4 }}>የተማሪዎች ውጤት መግለጫ</Text>
                    <View style={{ height: 1, width: 40, backgroundColor: '#d4af37', marginVertical: 12 }} />
                    <Text style={{ color: '#8b0000', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Academic Transcript</Text>
                  </View>

                  {/* Student Info - Amharic/English Labels */}
                  <View style={{ borderBottomWidth: 1, borderBottomColor: '#e8dfce', paddingBottom: 16, marginBottom: 24 }}>
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 10, color: '#8c7361', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>ሙሉ ስም / Name</Text>
                      <Text style={{ fontSize: 20, color: '#2c1810', fontWeight: '700' }}>{student.name}</Text>
                      {student.baptismalname ? <Text style={{ fontSize: 13, color: '#5c4033', fontStyle: 'italic', fontWeight: '500' }}>{student.baptismalname}</Text> : null}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 10, color: '#8c7361', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>ክፍል / Grade</Text>
                        <Text style={{ fontSize: 16, color: '#2c1810', fontWeight: '700' }}>{fmtGrade(student.grade)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: '#8c7361', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>ዓ.ም / Academic Year</Text>
                        <Text style={{ fontSize: 16, color: '#2c1810', fontWeight: '700' }}>{computeEthiopianYear()} E.C.</Text>
                      </View>
                    </View>
                  </View>

                  {/* Table - Amharic Headers First */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d4af3733', paddingBottom: 10, marginBottom: 12 }}>
                      <Text style={{ flex: 2, fontSize: 11, fontWeight: '800', color: '#8c7361' }}>የትምህርት አይነት / Subject</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: '#8c7361', textAlign: 'center' }}>ውጤት / Score</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: '#8c7361', textAlign: 'center' }}>አማካይ / Avg</Text>
                    </View>
                    
                    {assessments.filter(a => String(a.grade) === String(student.grade) && !a.issystemconductassessment).slice(0, 7).map((a, i) => {
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
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#2c1810' }}>አጠቃላይ ድምር / Grand Total</Text>
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
const makeStyles = (C: any) => StyleSheet.create({
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
