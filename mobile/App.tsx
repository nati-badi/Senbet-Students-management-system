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

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

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
          tabBarStyle: [s.tabBar, { borderTopWidth: 0, position: 'absolute', bottom: 16, left: 16, right: 16, borderRadius: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 12, height: 64, backgroundColor: C.card, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 }],
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
        <Tab.Screen name="Dashboard">{() => <DashboardTab teacher={teacher} students={students} assessments={assessments} marks={marks} attendance={attendance} C={C} s={s} setTab={(t: any) => navigation.navigate(t)} />}</Tab.Screen>
        <Tab.Screen name="Students">{() => <StudentsTab teacher={teacher} students={students} onRefresh={() => syncData()} C={C} s={s} onStudentPress={setProfileStudent} />}</Tab.Screen>
        <Tab.Screen name="Attendance">{() => <AttendanceTab teacher={teacher} students={students} C={C} s={s} />}</Tab.Screen>
        <Tab.Screen name="Marks">{() => <MarksTab teacher={teacher} students={students} assessments={assessments} marksData={marks} C={C} s={s} />}</Tab.Screen>
        <Tab.Screen name="Analytics">{() => <AnalyticsTab students={students} assessments={assessments} marks={marks} C={C} s={s} />}</Tab.Screen>
        <Tab.Screen name="Urgent">{() => <UrgentMattersTab teacher={teacher} students={students} assessments={assessments} marksData={marks} C={C} s={s} />}</Tab.Screen>
      </Tab.Navigator>
    );
  }

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <Drawer.Navigator
        drawerContent={(props) => (
          <DrawerContentScrollView {...props} style={{ backgroundColor: C.card }}>
            <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12, alignItems: 'center' }}>
               <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                 <BookOpen size={40} color={C.accent} strokeWidth={1.5} />
               </View>
               <Text style={{ color: C.text, fontWeight: '900', fontSize: 20, letterSpacing: -0.5 }}>{t('app.title')}</Text>
               <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{teacher.name}</Text>
            </View>
            <DrawerItemList {...props} />
            <View style={{ padding: 16, marginTop: 24, borderTopWidth: 1, borderTopColor: C.border }}>
              <TouchableOpacity onPress={toggleLanguage} style={s.sidebarItem}>
                <View style={s.sidebarIcon}><Languages size={18} color={C.accent} /></View>
                <Text style={s.sidebarText}>{i18n.language === 'en' ? 'Amharic (አማርኛ)' : 'English'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleTheme} style={s.sidebarItem} id="theme-toggle">
                <View style={s.sidebarIcon}>{isDark ? <Sun size={18} color={C.amber} /> : <Moon size={18} color={C.slate} />}</View>
                <Text style={s.sidebarText}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { syncData(); props.navigation.closeDrawer(); }} style={s.sidebarItem}>
                <View style={s.sidebarIcon}><RefreshCw size={18} color={C.green} /></View>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                   <Text style={s.sidebarText}>{t('common.sync')}</Text>
                   {syncing && <ActivityIndicator size="small" color={C.accent} />}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={[s.sidebarItem, { marginTop: 32 }]}>
                <View style={[s.sidebarIcon, { backgroundColor: C.red + '15' }]}><LogOut size={18} color={C.red} /></View>
                <Text style={[s.sidebarText, { color: C.red, fontWeight: '700' }]}>{t('common.logout')}</Text>
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
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <BookOpen size={48} color={C.accent} strokeWidth={1.5} />
        </View>
        <Text style={s.loginTitle}>Senbet Teacher</Text>
        <Text style={s.loginSub}>Portal Login</Text>
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
function DashboardTab({ teacher, students, assessments, marks, attendance, C, s, setTab }: { 
  teacher: Teacher, students: Student[], assessments: Assessment[], marks: any[], attendance: any[], C: any, s: any, setTab: (t: any) => void 
}) {
  const { t } = useTranslation();
  const today = formatEthiopianDate(new Date());
  
  const stats = [
    { label: t('dashboard.totalStudents'), value: students.length, icon: <Users size={24} color={C.accent} stroke={C.accent} />, bg: C.accentMuted },
    { label: t('dashboard.attendanceToday'), value: attendance.filter(a => a.status === 'present' || a.status === 'late').length, icon: <CalendarCheck size={24} color={C.green} stroke={C.green} />, bg: C.green + '15' },
    { label: t('teacher.missingMarks'), value: assessments.length * students.length - marks.length, icon: <AlertTriangle size={24} color={C.red} stroke={C.red} />, bg: C.red + '15' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={[s.sectionTitle, { marginBottom: 4 }]}>{t('dashboard.title')}</Text>
        <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>📅 {today}</Text>
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

  const handleRefresh = async () => { 
    setRefreshing(true); 
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
        data={filtered}
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
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE TAB  (uses lowercase: studentid)
// ═══════════════════════════════════════════════════════════════
function AttendanceTab({ teacher, students, C, s }: { teacher: Teacher, students: Student[], C: any, s: any }) {
  const { t } = useTranslation();
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [date] = useState(dayjs().format('YYYY-MM-DD'));
  const [attendance, setAttendance] = useState<Record<string, string>>({});
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
        data?.forEach((r: any) => { map[r.studentid] = r.status; });
        setAttendance(map);
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
        studentid: st.id,
        date,
        status: attendance[st.id] || 'absent',
        markedby: teacher.id
      }));

      const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'studentid,date' });
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
      <View style={{ padding: 16, pb: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', mb: 16 }}>
          <View>
            <Text style={[s.sectionTitle, { mb: 4 }]}>{t('teacher.attendance')}</Text>
            <Text style={{ color: C.muted, fontSize: 13 }}>{etDate}</Text>
          </View>
          <TouchableOpacity onPress={openScanner} style={[s.themeBtn, { width: 44, height: 44, borderRadius: 12 }]}>
            <CalendarCheck size={20} color={C.accent} />
          </TouchableOpacity>
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
          style={[s.searchInput, { margin: 0, mb: 16 }]}
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
              <Text style={s.studentSub}>{item.id}</Text>
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
            <TouchableOpacity 
              onPress={() => setScannerVisible(false)}
              style={{ position: 'absolute', top: 60, right: 30, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 10 }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <View style={{ position: 'absolute', bottom: 90, left: 16, right: 16 }}>
        <TouchableOpacity style={[s.loginBtn, { marginTop: 0 }]} onPress={saveAttendance}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Save Attendance</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MARKS TAB  (uses lowercase: studentid, assessmentid, etc.)
// ═══════════════════════════════════════════════════════════════
function MarksTab({ teacher, students, assessments, marksData, C, s }: { 
  teacher: Teacher, students: Student[], assessments: Assessment[], marksData: any[], C: any, s: any 
}) {
  const { t } = useTranslation();
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkScore, setBulkScore] = useState('');

  useEffect(() => {
    const uniqueGrades = [...new Set(students.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
    setGrades(uniqueGrades);
    if (!selectedGrade && uniqueGrades.length > 0) setSelectedGrade(uniqueGrades[0]);
  }, [students]);

  useEffect(() => {
    if (!selectedAssessment) {
      setMarks({});
      return;
    }
    const map: Record<string, string> = {};
    marksData
      .filter(m => m.assessmentid === selectedAssessment.id)
      .forEach(m => { map[m.studentid] = String(m.score); });
    setMarks(map);
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
        const score = scoreStr && scoreStr !== '' ? parseFloat(scoreStr) : null;
        return {
          studentid: student.id,
          assessmentid: selectedAssessment.id,
          score,
          assessmentdate: selectedAssessment.date
        };
      }).filter(r => r.score !== null);

      const { error } = await supabase.from('marks').upsert(records, { onConflict: 'studentid,assessmentid' });
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
        data={filteredStudents}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
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
              <Text style={s.studentSub}>{item.id}</Text>
            </View>
            <TextInput
              style={[s.markInput, { width: 80, height: 44, borderRadius: 10 }]}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={C.muted}
              value={marks[item.id] || ''}
              onChangeText={(val) => setMarks(prev => ({ ...prev, [item.id]: val }))}
              disabled={!selectedAssessment}
            />
          </View>
        )}
      />

      <View style={{ position: 'absolute', bottom: 90, left: 16, right: 16 }}>
        <TouchableOpacity 
          style={[s.loginBtn, { marginTop: 0, opacity: selectedAssessment ? 1 : 0.5 }]} 
          onPress={saveMarks} 
          disabled={saving || !selectedAssessment}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Save Marks</Text>}
        </TouchableOpacity>
      </View>
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
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
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
  const etYear = computeEthiopianYear(new Date());

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
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
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
               <Text style={{ color: C.accent, fontWeight: '900', fontSize: 12 }}>{i+1}</Text>
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
function StudentProfileModal({ student, onClose, assessments, marks, C, s }: {
  student: Student | null, onClose: () => void, assessments: Assessment[], marks: any[], C: any, s: any
}) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'overview' | 'attendance' | 'marks' | 'cert'>('overview');

  if (!student) return null;

  const studentMarks = marks.filter(m => m.studentid === student.id);
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
                <Text style={{ color: C.accent, fontWeight: '700', marginTop: 4 }}>ID: {student.id}</Text>
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

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
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
                 <View style={{ width: '100%', aspectRatio: 1.4, backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 8, borderColor: '#f59e0b', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }}>
                    <Text style={{ color: '#10b981', fontSize: 20, fontWeight: '900', textAlign: 'center' }}>CERTIFICATE OF EXCELLENCE</Text>
                    <Text style={{ color: '#000', fontSize: 18, marginTop: 12, fontWeight: '700' }}>{student.name}</Text>
                    <View style={{ height: 2, width: '60%', backgroundColor: '#f59e0b', marginVertical: 8 }} />
                    <Text style={{ color: '#444', fontSize: 13, textAlign: 'center' }}>Issued for outstanding performance in {fmtGrade(student.grade)}</Text>
                 </View>
                 <TouchableOpacity style={[s.loginBtn, { marginTop: 20, width: '100%' }]}>
                    <Text style={s.loginBtnText}>Download Certificate</Text>
                 </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 16, 
    borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border 
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
  badge: { backgroundColor: C.accent + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: C.accent, fontSize: 12, fontWeight: '700' },

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
