import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Users, BarChart3, TrendingUp } from 'lucide-react-native';
import { Student, Assessment, Teacher, normG, normS, isConduct, fmtGrade } from '../utils';

export const UrgentMattersTab = React.memo(({ navigation, teacher, students: allStudents, assessments: allAssessments, marksData, subjects, settings, C, s, onRefresh }: {
  navigation: any, teacher: Teacher, students: Student[], assessments: Assessment[], marksData: any[], subjects: any[], settings: Record<string, string>, C: any, s: any, onRefresh?: () => Promise<void> | void
}) => {
  const { t } = useTranslation();
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

  const missingMarksByAssessment = useMemo(() => assessments.map(a => {
    const studentsForGrade = students.filter(st => normG(st.grade) === normG(a.grade));
    const ungraded = studentsForGrade.filter(st => !marksData.some(m => (m.studentid || m.studentId) === st.id && (m.assessmentid || m.assessmentId) === a.id));
    return { assessment: a, count: ungraded.length, students: ungraded };
  }).filter(item => item.count > 0), [assessments, students, marksData]);

  const PAGE_SIZE = 5;
  const displayedAssessments = showAllAssessments ? missingMarksByAssessment : missingMarksByAssessment.slice(0, PAGE_SIZE);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}>
      <View style={{ marginBottom: 24 }}><Text style={s.sectionTitle}>⚠️ {t('teacher.urgent')}</Text><Text style={{ color: C.muted, fontSize: 13 }}>{t('teacher.urgentSubtitle')}</Text></View>

      {missingMarksByAssessment.length > 0 && (
        <View style={[s.issueCard, { borderRadius: 20, padding: 20, marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><BarChart3 size={20} color={C.amber} stroke={C.amber} /><Text style={[s.issueTitle, { marginLeft: 8, marginBottom: 0 }]}>{t('urgent.incompleteAssessments')}</Text><View style={{ flex: 1 }} /><View style={{ backgroundColor: C.amber + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}><Text style={{ color: C.amber, fontSize: 12, fontWeight: '800' }}>{missingMarksByAssessment.length}</Text></View></View>
          <Text style={s.issueSub}>{t('urgent.missingScoresDesc')}</Text>
          {displayedAssessments.map(item => (
            <TouchableOpacity key={item.assessment.id} style={[s.issueRow, { borderTopColor: C.border, flexDirection: 'column', alignItems: 'stretch' }]} onPress={() => navigation.navigate('Main', { screen: 'Marks', params: { assessmentId: item.assessment.id, grade: item.assessment.grade, highlightEmpty: true, nonce: Date.now() } })}><View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={s.issueText}>{item.assessment.name}</Text><Text style={s.issueSub}>{item.assessment.subjectname} • {fmtGrade(item.assessment.grade)} • {t('urgent.missingCount', { count: item.count })}</Text></View><TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Marks', params: { assessmentId: item.assessment.id, grade: item.assessment.grade, highlightEmpty: true, nonce: Date.now() } })} style={{ backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{t('urgent.fixNow')}</Text></TouchableOpacity></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>{item.students.map(st => (<View key={st.id} style={{ backgroundColor: C.amber + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: C.amber + '30' }}><Text style={{ fontSize: 11, color: C.amber, fontWeight: '700' }}>{st.name}</Text></View>))}</View></TouchableOpacity>
          ))}
          {missingMarksByAssessment.length > PAGE_SIZE && (<TouchableOpacity onPress={() => setShowAllAssessments(!showAllAssessments)} style={{ alignSelf: 'center', marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: C.amber + '12' }}><Text style={{ color: C.amber, fontWeight: '700', fontSize: 13 }}>{showAllAssessments ? t('urgent.showLess') : t('urgent.showAllAssessments', { count: missingMarksByAssessment.length })}</Text></TouchableOpacity>)}
        </View>
      )}

      {missingMarksByAssessment.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 100 }}><View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.green + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}><TrendingUp size={40} color={C.green} stroke={C.green} /></View><Text style={[s.empty, { color: C.text, fontWeight: '700' }]}>{t('urgent.everyoneUpToDate')}</Text><Text style={{ color: C.muted, marginTop: 4 }}>{t('urgent.noUrgentMatters')}</Text></View>
      )}
    </ScrollView>
  );
});
