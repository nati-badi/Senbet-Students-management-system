import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TrendingUp, BarChart3 } from 'lucide-react-native';
import { Student, Assessment, Teacher, normG, normS, isConduct } from '../utils';
import { computeEthiopianYear } from '../dateUtils';

export const AnalyticsTab = React.memo(({ teacher, students: allStudents, assessments: allAssessments, marks, C, s, onRefresh, settings, subjects }: {
  teacher: Teacher, students: Student[], assessments: Assessment[], marks: any[], C: any, s: any, onRefresh?: () => Promise<void> | void, settings: any, subjects: any[]
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
      const isSubjectMatch = (!hasTeacherAssignedSubjects || mySubjects.includes(a.subjectname)) && !isConduct(a);
      const subject = subjects.find(sub => normS(sub.name) === normS(a.subjectname));
      const assessmentSemester = subject?.semester || 'Semester I';
      return isGradeMatch && isSubjectMatch && assessmentSemester === (settings.currentSemester || 'Semester I');
    }),
    [allAssessments, myGrades, mySubjects, subjects, settings.currentSemester]
  );

  const etYear = computeEthiopianYear();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };

  const studentStats = useMemo(() => students.map(st => {
    const sMarks = marks.filter(m => (m.studentid || m.studentId) === st.id);
    const total = sMarks.reduce((acc, m) => acc + (Number(m.score) || 0), 0);
    const maxPoss = sMarks.reduce((acc, m) => {
      const ass = assessments.find(a => a.id === (m.assessmentid || m.assessmentId));
      return acc + (ass?.maxscore || 100);
    }, 0);
    const perc = maxPoss > 0 ? (total / maxPoss) * 100 : 0;
    return { name: st.name, perc, count: sMarks.length };
  }).filter(s => s.count > 0).sort((a, b) => b.perc - a.perc), [students, marks, assessments]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}>
      <View style={{ marginBottom: 24 }}>
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
          const aMarks = marks.filter(m => (m.assessmentid || m.assessmentId) === ass.id);
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
});
