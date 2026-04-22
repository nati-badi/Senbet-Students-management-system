import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Users, CalendarCheck, AlertTriangle, RefreshCw, TrendingUp, ChevronRight, Clock, BarChart3 } from 'lucide-react-native';
import { formatEthiopianDate, formatEthiopianTime } from '../dateUtils';
import { Teacher, Student, Assessment, normG, normS } from '../utils';
import { useToast } from './ToastContext';
import { EthiopicClockWidget } from './EthiopicClockWidget';


export const DashboardTab = React.memo(({ teacher, students: allStudents, assessments: allAssessments, marks, attendance, subjects, settings, C, s, setTab, onSync, isSyncing, isOnline, lastSync }: {
  teacher: Teacher, students: Student[], assessments: Assessment[], marks: any[], attendance: any[], subjects: any[], settings: Record<string, string>, C: any, s: any, setTab: (t: any) => void, onSync: () => void, isSyncing: boolean, isOnline: boolean, lastSync: string | null
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

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

  const missingCount = useMemo(() => students.reduce((acc, st) => {
    const stGrade = normG(st.grade);
    const stAsses = assessments.filter(a => normG(a.grade) === stGrade);
    const missing = stAsses.filter(a => !marks.some(m => m.studentid === st.id && m.assessmentid === a.id));
    return acc + missing.length;
  }, 0), [students, assessments, marks]);
  
  const stats = useMemo(() => [
    { label: t('dashboard.totalStudents'), value: students.length, icon: <Users size={24} color={C.accent} stroke={C.accent} />, bg: C.accentMuted, target: 'Students' },
    { label: t('dashboard.attendanceToday'), value: '—', icon: <CalendarCheck size={24} color={C.muted} stroke={C.muted} />, bg: C.border + '30', target: 'Attendance', disabled: true },
    { label: t('teacher.missingMarks'), value: missingCount, icon: <AlertTriangle size={24} color={C.red} stroke={C.red} />, bg: C.red + '15', target: 'Urgent' },
  ], [students.length, missingCount, t, C]);

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
          onPress={() => {
              showToast?.(t('common.syncing', 'Syncing...'), 'info');
              onSync();
          }} 
          disabled={isSyncing}
          activeOpacity={0.7}
          style={{ 
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: C.accent + '15', 
              justifyContent: 'center',
              alignItems: 'center',
          }}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <RefreshCw size={24} color={C.accent} strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {stats.map((item, idx) => (
          <TouchableOpacity 
            key={idx} 
            onPress={() => item.disabled ? showToast?.('🚧 ' + t('common.comingSoon'), 'info') : setTab(item.target)}
            activeOpacity={0.7}
            style={[s.dashboardCard, { width: '48%', gap: 12, minHeight: 120, opacity: item.disabled ? 0.6 : 1 }]}
          >
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center' }}>
              {item.icon}
            </View>
            <View style={item.disabled ? { opacity: 0.5 } : null}>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: '900' }}>{item.value}</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>{item.label}</Text>
            </View>
            <View style={{ position: 'absolute', top: 12, right: 12 }}>
              {item.disabled ? <Clock size={12} color={C.muted} /> : <ChevronRight size={14} color={C.muted} opacity={0.5} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.sectionTitle, { marginTop: 32, marginBottom: 16 }]}>{t('dashboard.recentActivity')}</Text>

      <TouchableOpacity 
        style={[s.dashboardAction, { opacity: 0.5 }]} 
        onPress={() => showToast?.('🚧 ' + t('common.comingSoon'), 'info')}
      >
        <View style={[s.sidebarIcon, { backgroundColor: C.border + '30' }]}><CalendarCheck size={20} color={C.muted} /></View>
        <View style={{ flex: 1, opacity: 0.5 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>{t('teacher.attendance')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{t('dashboard.attendanceDesc')}</Text>
        </View>
        <Clock size={16} color={C.muted} />
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
});
