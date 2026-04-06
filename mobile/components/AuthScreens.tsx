import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image as RNImage, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Key, Users, ArrowLeft, Search, Eye, EyeOff, User, CalendarCheck, Clock, BarChart3, Info } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../supabase';
import { THEMES, Teacher, Student, Assessment, fmtGrade } from '../utils';

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

export const ParentPortal = React.memo(({ isDark, onBack, isOnline, s }: { isDark: boolean, onBack: () => void, isOnline: boolean, s: any }) => {
  const { t } = useTranslation();
  const C = isDark ? THEMES.dark : THEMES.light;
  
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
        Platform.OS === 'web' ? (
          <View style={{ flex: 1 }}>{renderSearchForm()}</View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {renderSearchForm()}
          </KeyboardAvoidingView>
        )
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
            
            <View style={{ marginBottom: 32 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
                 <CalendarCheck size={20} color={C.muted} />
                 <Text style={[s.sectionTitle, { marginBottom: 0, color: C.muted }]}>{t('profile.attendance', 'Attendance')}</Text>
                 <View style={{ backgroundColor: C.amber + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: C.amber, fontSize: 10, fontWeight: '900' }}>COMING SOON</Text>
                 </View>
               </View>

               <View style={[s.dashboardCard, { padding: 16, opacity: 0.6 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, opacity: 0.5 }}>
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
});

export const TeacherLogin = React.memo(({ onLogin, onBack, isDark, isOnline, s }: { onLogin: (t: Teacher) => void, onBack: () => void, isDark: boolean, isOnline: boolean, s: any }) => {
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
      keyboardShouldPersistTaps={Platform.OS === 'web' ? undefined : "handled"}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode={Platform.OS === 'web' ? "none" : "on-drag"}
    >
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{ width: 104, height: 104, borderRadius: 26, padding: 6, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6, marginBottom: 20 }}>
          {/* @ts-ignore */}
          <RNImage source={require('../assets/logo.png')} style={{ width: '100%', height: '100%', borderRadius: 22 }} resizeMode="contain" />
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
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} animated={true} translucent={true} />
      <View style={{ position: 'absolute', top: 32, left: 24, zIndex: 100 }}>
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
