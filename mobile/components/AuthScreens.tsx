import React, { useState, useRef } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, TextInput, Image as RNImage, 
    KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, 
    ActivityIndicator, Alert 
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { 
    Key, Users, ArrowLeft, Search, Eye, EyeOff, User, CalendarCheck, Clock, 
    BarChart3, Info, Home, Languages, Sun, Moon, RefreshCw, LogOut, Save, Edit, Phone,
    Bell, MessageSquare
} from 'lucide-react-native';
import { LiveCertificate } from './LiveCertificate';
import { SchoolInfoTab } from './SchoolInfoTab';
import { EthiopicClockWidget } from './EthiopicClockWidget';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../supabase';
import { THEMES, Teacher, Student, Assessment, fmtGrade } from '../utils';
import { formatEthiopianDate } from '../dateUtils';

export const LandingPage = React.memo(({ onSelectMode, isDark, t, C, s }: { onSelectMode: (m: 'teacher' | 'parent') => void, isDark: boolean, t: any, C: any, s: any }) => {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 100 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{ width: 120, height: 120, borderRadius: 30, padding: 6, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, marginBottom: 24 }}>
            {/* @ts-ignore */}
            <RNImage source={require('../assets/logo.png')} style={{ width: '100%', height: '100%', borderRadius: 24 }} resizeMode="contain" />
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
});

export const ParentPortal = React.memo(({ isDark, onBack, isOnline, toggleTheme, toggleLanguage, s }: { isDark: boolean, onBack: () => void, isOnline: boolean, toggleTheme: () => void, toggleLanguage: () => void, s: any }) => {
  const { t, i18n } = useTranslation();
  const C = isDark ? THEMES.dark : THEMES.light;
  const [activeTab, setActiveTab] = useState<'home' | 'marks' | 'info' | 'profile'>('home');
  
  const [studentName, setStudentName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const accessCodeRef = useRef<any>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [marks, setMarks] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [allStudentsInGrade, setAllStudentsInGrade] = useState<Student[]>([]);
  const [allMarksInGrade, setAllMarksInGrade] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingAnns, setLoadingAnns] = useState(false);

  // CRUD State
  const [editingProfile, setEditingProfile] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [baptName, setBaptName] = useState('');
  const [parentContact, setParentContact] = useState('');

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

      setLoadingAnns(true);
      setStudent(data);
      setEditableName(data.name || '');
      setBaptName(data.baptismalname || '');
      setParentContact(data.parentcontact || '');
      
      const [mRes, aRes, attRes, subRes, setRes, allStudentsRes] = await Promise.all([
        supabase.from('marks').select('*').eq('studentid', data.id),
        supabase.from('assessments').select('*').eq('grade', data.grade),
        supabase.from('attendance').select('*').eq('studentid', data.id).order('date', { ascending: false }),
        supabase.from('subjects').select('*'),
        supabase.from('settings').select('*'),
        supabase.from('students').select('*').eq('grade', data.grade)
      ]);
      
      const studentsInGrade = allStudentsRes.data || [];
      const studentIdsInGrade = studentsInGrade.map(s => s.id);
      
      const allMarksRes = await supabase
        .from('marks')
        .select('*')
        .in('studentid', studentIdsInGrade);

      setMarks(mRes.data || []);
      setAssessments(aRes.data || []);
      setAttendance(attRes.data || []);
      setSubjects(subRes.data || []);
      setAllStudentsInGrade(studentsInGrade);
      setAllMarksInGrade(allMarksRes.data || []);
      
      supabase.from('announcements').select('*').eq('active', 1).order('date', { ascending: false })
        .then(({ data }) => setAnnouncements(data || []))
        .finally(() => setLoadingAnns(false));
      
      if (setRes.data) {
        const sMap: any = {};
        setRes.data.forEach((r: any) => { sMap[r.key] = r.value; });
        setSettings(sMap);
      }
      // Clear login fields after success
      setStudentName('');
      setAccessCode('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!student || isSyncing) return;
    setIsSyncing(true);
    try {
      const [mRes, aRes, attRes, subRes, setRes, allStudentsRes, annRes] = await Promise.all([
        supabase.from('marks').select('*').eq('studentid', student.id),
        supabase.from('assessments').select('*').eq('grade', student.grade),
        supabase.from('attendance').select('*').eq('studentid', student.id).order('date', { ascending: false }),
        supabase.from('subjects').select('*'),
        supabase.from('settings').select('*'),
        supabase.from('students').select('*').eq('grade', student.grade),
        supabase.from('announcements').select('*').eq('active', 1).order('date', { ascending: false })
      ]);
      
      const studentsInGrade = allStudentsRes.data || [];
      const studentIdsInGrade = studentsInGrade.map(s => s.id);
      const allMarksRes = await supabase.from('marks').select('*').in('studentid', studentIdsInGrade);

      setMarks(mRes.data || []);
      setAssessments(aRes.data || []);
      setAttendance(attRes.data || []);
      setSubjects(subRes.data || []);
      setAllStudentsInGrade(studentsInGrade);
      setAllMarksInGrade(allMarksRes.data || []);
      setAnnouncements(annRes.data || []);
      
      if (setRes.data) {
          const sMap: any = {};
          setRes.data.forEach((r: any) => { sMap[r.key] = r.value; });
          setSettings(sMap);
      }
      Alert.alert('✅ ' + t('common.syncComplete'));
    } catch (e) {
      Alert.alert('❌ ' + t('common.syncFailed'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!student) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ name: editableName, baptismalname: baptName, parentcontact: parentContact, updated_at: new Date().toISOString() })
        .eq('id', student.id);
      
      if (error) throw error;
      setStudent({ ...student, name: editableName, baptismalname: baptName, parentcontact: parentContact });
      setEditingProfile(false);
      Alert.alert('✅ ' + t('common.saveSuccess'));
    } catch (e: any) {
      Alert.alert('❌ Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSearchForm = () => (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 24, paddingBottom: 200 }}
      keyboardShouldPersistTaps={Platform.OS === 'web' ? undefined : "handled"}
      keyboardDismissMode={Platform.OS === 'web' ? "none" : "on-drag"}
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
  );

  const renderDashboard = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? t('common.goodMorning') : hour < 18 ? t('common.goodAfternoon') : t('common.goodEvening');

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <EthiopicClockWidget C={C} />
          
          <View style={[s.dashboardCard, { marginBottom: 24, padding: 0, backgroundColor: C.card, overflow: 'hidden', borderWidth: 1, borderColor: C.border }]}>
               <View style={{ padding: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center' }}>
                      <User size={38} color={C.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>{greeting}</Text>
                      <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginTop: 2 }}>{student?.name}</Text>
                      {student?.baptismalname && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                           <Info size={14} color={C.accent} />
                           <Text style={{ color: C.muted, fontSize: 14, fontWeight: '600' }}>{student.baptismalname}</Text>
                        </View>
                      )}
                    </View>
                  </View>
               </View>
               
               <View style={{ flexDirection: 'row', backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 14, paddingHorizontal: 24, justifyContent: 'space-between', alignItems: 'center' }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ backgroundColor: C.accent + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                         <Text style={{ color: C.accent, fontSize: 12, fontWeight: '800' }}>{fmtGrade(student?.grade || '')}</Text>
                      </View>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.border }} />
                      <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{student?.portalcode}</Text>
                   </View>
                   <View style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.3)' }}>
                       <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' }} />
                       <Text style={{ color: '#4ADE80', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('common.active', 'Active')}</Text>
                   </View>
               </View>
          </View>

         <Text style={s.sectionTitle}>{t('parent.latestAnnouncements', 'Announcements')}</Text>
         
         {isSyncing || loadingAnns ? (
            <View style={[s.dashboardCard, { padding: 20, marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.muted, opacity: 0.3 }} />
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <View style={{ width: '60%', height: 16, backgroundColor: C.muted, borderRadius: 4, opacity: 0.3, marginBottom: 6 }} />
                        <View style={{ width: '30%', height: 12, backgroundColor: C.muted, borderRadius: 4, opacity: 0.2 }} />
                    </View>
                </View>
                <View style={{ width: '100%', height: 14, backgroundColor: C.muted, borderRadius: 4, opacity: 0.2, marginBottom: 6 }} />
                <View style={{ width: '80%', height: 14, backgroundColor: C.muted, borderRadius: 4, opacity: 0.2 }} />
            </View>
         ) : announcements.length === 0 ? (
            <View style={[s.dashboardCard, { padding: 32, alignItems: 'center', opacity: 0.6 }]}>
                <MessageSquare size={40} color={C.muted} />
                <Text style={{ color: C.muted, marginTop: 12, fontWeight: '600' }}>{t('parent.noAnnouncements', 'No recent announcements')}</Text>
            </View>
         ) : (
            announcements.map((ann, idx) => {
                const title = ann.title_am || ann.title_en;
                const content = ann.content_am || ann.content_en;
                const colors = { high: C.red, medium: C.accent, low: C.muted };
                const accentColor = colors[ann.priority as keyof typeof colors] || C.accent;

                return (
                    <View key={ann.id || idx} style={[s.dashboardCard, { padding: 20, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: accentColor }]}>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: accentColor + '15', justifyContent: 'center', alignItems: 'center' }}>
                                <Bell size={20} color={accentColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>{title}</Text>
                                <Text style={{ color: C.muted, fontSize: 11, marginTop: 2, fontWeight: '700' }}>{formatEthiopianDate(ann.date)}</Text>
                            </View>
                        </View>
                        <Text style={{ color: C.muted, fontSize: 14, lineHeight: 22 }}>{content}</Text>
                    </View>
                );
            })
         )}
    </ScrollView>
    );
  };

  const renderMarks = () => (
    <View style={{ flex: 1, padding: 16 }}>
        <LiveCertificate 
            student={student!}
            marks={allMarksInGrade.length > 0 ? allMarksInGrade : marks}
            assessments={assessments}
            allStudents={allStudentsInGrade}
            subjects={subjects}
            settings={settings}
            C={C}
        />
    </View>
  );

  const renderSchoolInfo = () => (
    <SchoolInfoTab C={C} s={s} />
  );

  const renderProfile = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={[s.dashboardCard, { padding: 24, marginBottom: 24 }]}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>{t('teacher.profile', 'Student Profile')}</Text>
                {!editingProfile && (
                     <TouchableOpacity onPress={() => setEditingProfile(true)}>
                        <Edit size={20} color={C.accent} />
                    </TouchableOpacity>
                )}
             </View>

             {editingProfile ? (
                 <View>
                    <Text style={s.inputLabel}>{t('admin.studentName', 'Student Full Name')}</Text>
                    <TextInput 
                        style={[s.loginInput, { marginBottom: 16 }]} 
                        value={editableName} 
                        onChangeText={setEditableName} 
                    />
                    <Text style={s.inputLabel}>{t('admin.baptismalName')}</Text>
                    <TextInput 
                        style={s.loginInput} 
                        value={baptName} 
                        onChangeText={setBaptName} 
                    />
                    <Text style={[s.inputLabel, { marginTop: 16 }]}>{t('admin.parentContact')}</Text>
                    <TextInput 
                        style={s.loginInput} 
                        value={parentContact} 
                        onChangeText={setParentContact} 
                        keyboardType="phone-pad"
                    />
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                        <TouchableOpacity 
                            style={[s.loginBtn, { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }]} 
                            onPress={() => setEditingProfile(false)}
                        >
                            <Text style={{ color: C.text }}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[s.loginBtn, { flex: 1, backgroundColor: C.accent }]} 
                            onPress={handleUpdateProfile}
                        >
                            <Text style={s.loginBtnText}>{t('common.save')}</Text>
                        </TouchableOpacity>
                    </View>
                 </View>
             ) : (
                 <View>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{t('admin.studentName', 'Student Full Name')}</Text>
                        <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', marginTop: 4 }}>{student?.name}</Text>
                    </View>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{t('admin.baptismalName')}</Text>
                        <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', marginTop: 4 }}>{student?.baptismalname || '—'}</Text>
                    </View>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{t('admin.parentContact')}</Text>
                        <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', marginTop: 4 }}>{student?.parentcontact || '—'}</Text>
                    </View>
                    <View>
                        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{t('parent.portalCode')}</Text>
                        <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', marginTop: 4 }}>{student?.portalcode}</Text>
                    </View>
                 </View>
             )}
        </View>

        <View style={[s.dashboardCard, { padding: 24 }]}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 20 }}>{t('common.settings', 'Settings')}</Text>
            
            <TouchableOpacity onPress={toggleLanguage} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center' }}>
                        <Languages size={18} color={C.accent} />
                    </View>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{t('common.language', 'Language')}</Text>
                </View>
                <Text style={{ color: C.accent, fontWeight: '800' }}>{i18n.language === 'en' ? 'EN' : 'አማ'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={toggleTheme} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.amber + '15', justifyContent: 'center', alignItems: 'center' }}>
                        {isDark ? <Sun size={18} color={C.amber} /> : <Moon size={18} color={C.slate} />}
                    </View>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{isDark ? t('common.lightMode') : t('common.darkMode')}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={() => { setStudent(null); setActiveTab('home'); }} 
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, paddingVertical: 12 }}
            >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.red + '15', justifyContent: 'center', alignItems: 'center' }}>
                    <LogOut size={18} color={C.red} />
                </View>
                <Text style={{ color: C.red, fontWeight: '800' }}>{t('common.logout', 'Sign Out')}</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      {!student ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <TouchableOpacity onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
            <ArrowLeft size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>{t('parent.title', 'Parent Portal')}</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
             <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, padding: 2 }}>
                <RNImage source={require('../assets/logo.png')} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="contain" />
             </View>
             <View>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '900' }}>በግ/ደ/አ/ቅ/አርሴማ</Text>
                <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700' }}>ፍኖተ ብርሃን ሰ/ቤት</Text>
             </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={handleSync} disabled={isSyncing} style={{ padding: 8, borderRadius: 10, backgroundColor: C.accent + '10' }}>
              {isSyncing ? <ActivityIndicator size="small" color={C.accent} /> : <RefreshCw size={18} color={C.accent} />}
            </TouchableOpacity>
             <TouchableOpacity onPress={() => { setStudent(null); setActiveTab('home'); }} style={{ padding: 8, borderRadius: 10, backgroundColor: C.red + '10' }}>
              <LogOut size={18} color={C.red} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!student ? (
        Platform.OS === 'web' ? (
          <View style={{ flex: 1 }}>{renderSearchForm()}</View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {renderSearchForm()}
          </KeyboardAvoidingView>
        )
      ) : (
            <View style={{ flex: 1 }}>
                {activeTab === 'home' && renderDashboard()}
                {activeTab === 'marks' && renderMarks()}
                {activeTab === 'info' && renderSchoolInfo()}
                {activeTab === 'profile' && renderProfile()}

                <View style={{ 
                    position: 'absolute', bottom: 24, left: 20, right: 20, height: 64, 
                    backgroundColor: C.card, borderRadius: 20, flexDirection: 'row', 
                    justifyContent: 'space-around', alignItems: 'center', elevation: 10,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.1, shadowRadius: 15, borderWidth: 1, borderColor: C.border
                }}>
                    {[
                        { id: 'home', icon: <Home size={22} color={activeTab === 'home' ? C.accent : C.muted} />, label: t('parent.home', 'Home') },
                        { id: 'marks', icon: <BarChart3 size={22} color={activeTab === 'marks' ? C.accent : C.muted} />, label: t('teacher.marks', 'Marks') },
                        { id: 'info', icon: <Info size={22} color={activeTab === 'info' ? C.accent : C.muted} />, label: t('parent.schoolInfo', 'Info') },
                        { id: 'profile', icon: <User size={22} color={activeTab === 'profile' ? C.accent : C.muted} />, label: t('teacher.profile', 'Profile') },
                    ].map(item => (
                        <TouchableOpacity key={item.id} onPress={() => setActiveTab(item.id as any)} style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                            {item.icon}
                            <Text style={{ fontSize: 9, fontWeight: '800', marginTop: 4, color: activeTab === item.id ? C.accent : C.muted }}>{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
      )}
    </View>
  );
});

export const TeacherLogin = React.memo(({ onLogin, onBack, isDark, toggleTheme, toggleLanguage, isOnline, s }: { onLogin: (t: Teacher) => void, onBack: () => void, isDark: boolean, toggleTheme: () => void, toggleLanguage: () => void, isOnline: boolean, s: any }) => {
  const { t } = useTranslation();
  const C = isDark ? THEMES.dark : THEMES.light;
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
      // Clear login fields after success
      setName('');
      setCode('');
      onLogin(data);
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.loginFailed', 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  const renderLoginForm = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 24, paddingTop: 96, paddingBottom: 250 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center' }}>
          <Key size={48} color={C.accent} />
        </View>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', marginTop: 20, textAlign: 'center' }}>{t('teacher.portalLogin', 'Teacher Portal')}</Text>
        <Text style={{ color: C.muted, textAlign: 'center', marginTop: 10, fontSize: 15, lineHeight: 22 }}>Enter your full name and the 6-digit access code provided by the school admin.</Text>
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
          <TouchableOpacity onPress={() => setShowCode(!showCode)} style={{ position: 'absolute', right: 15, top: 12 }}>
            {showCode ? <EyeOff size={24} color={C.muted} /> : <Eye size={24} color={C.muted} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.loginBtn, { marginTop: 32, height: 62, borderRadius: 18, shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }]} onPress={doLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={[s.loginBtnText, { fontSize: 17, fontWeight: '800' }]}>{t('teacher.login', 'Login')}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 48 : 32, left: 24, zIndex: 100 }}>
         <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, elevation: 2 }}>
           <ArrowLeft size={22} color={C.text} />
         </TouchableOpacity>
      </View>
      {Platform.OS === 'web' ? (
        <View style={{ flex: 1 }}>{renderLoginForm()}</View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {renderLoginForm()}
        </KeyboardAvoidingView>
      )}
    </View>
  );
});
