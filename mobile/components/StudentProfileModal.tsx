import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TouchableWithoutFeedback, Pressable, Platform, StyleSheet, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { Info, CalendarCheck, TrendingUp, Users } from 'lucide-react-native';
import { Student, Assessment, normG, normS, isConduct } from '../utils';
import { calculateSingleStudentRank, calculateSubjectRows } from '../analyticsEngine';
import { LiveCertificate } from './LiveCertificate';

export const StudentProfileModal = React.memo(({ student, onClose, assessments, marks, allStudents, subjects, settings, C, s }: {
  student: Student | null, onClose: () => void, assessments: Assessment[], marks: any[], allStudents: Student[], subjects: any[], settings: any, C: any, s: any
}) => {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'overview' | 'attendance' | 'marks' | 'cert'>('overview');
  
  const getEthiopianYear = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const sDate = String(dateString);
    if (sDate.includes('E.C.') || sDate.includes('ዓ.ም')) return sDate;
    if (sDate.includes('-')) {
      const d = new Date(dateString);
      if (!isNaN(d.getTime())) {
        const month = d.getMonth(); 
        const year = d.getFullYear();
        const ethiopianYear = month >= 8 ? year - 7 : year - 8;
        return `${ethiopianYear} ዓ.ም`;
      }
    }
    const m = String(dateString).match(/^(\d{4})$/);
    if (m) return `${m[1]} ዓ.ም`;
    return `${dateString} ዓ.ም`;
  };

  const studentMarks = useMemo(() => marks.filter(m => {
    if (!student) return false;
    const ass = assessments.find(a => a.id === (m.assessmentid || m.assessmentId));
    const mStudentId = m.studentid || m.studentId;
    return mStudentId === student.id && ass && !isConduct(ass);
  }), [marks, assessments, student?.id]);
  
  const activeSemester = settings?.currentSemester || 'Semester I';

  const rankings = useMemo(() => {
    return calculateSingleStudentRank(student!, allStudents, assessments, marks, activeSemester, subjects);
  }, [student?.id, student?.grade, assessments, marks, allStudents, activeSemester, subjects]);

  const { classRank, overallRank, totalInClass, totalInGrade } = rankings;

  const subjectRows = useMemo(() => {
    return calculateSubjectRows(student!, assessments, marks, subjects, activeSemester);
  }, [student?.id, student?.grade, assessments, marks, subjects, activeSemester]);

  const academicStats = useMemo(() => {
    const stats = (rankings as any).stats || { totalScore: 0, totalMax: 0, percentage: 0 };
    const avg = stats.percentage.toFixed(1);
    return { totalScore: stats.totalScore, totalMax: stats.totalMax, avg };
  }, [rankings.stats]);

  const { totalScore, totalMax, avg: studentAvg } = academicStats;
  const overallAvg = studentAvg; // Consistency: both views use the same value

  const sections = [
    { key: 'overview', label: t('profile.overview'), icon: <Info size={18} color={subTab === 'overview' ? C.accent : C.muted} /> },
    { key: 'attendance', label: t('profile.attendance'), icon: <CalendarCheck size={18} color={subTab === 'attendance' ? C.accent : C.muted} /> },
    { key: 'marks', label: t('profile.marks'), icon: <TrendingUp size={18} color={subTab === 'marks' ? C.accent : C.muted} /> },
    { key: 'cert', label: t('profile.cert'), icon: <Users size={18} color={subTab === 'cert' ? C.accent : C.muted} /> },
  ];

  if (!student) return null;

  return (
    <Modal visible={!!student} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[s.modalOverlay, { padding: 16, alignItems: 'center', justifyContent: 'center' }]}>
        {/* Background Overlay - Sibling to the Card to prevent gesture hijacking */}
        <Pressable 
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
          onPress={onClose} 
        />
        
        <View style={[s.modalCard, { 
          maxHeight: '92%', 
          minHeight: Platform.OS === 'web' ? 400 : 0,
          padding: 0, 
          overflow: 'hidden', 
          flex: 0, 
          width: Platform.OS === 'web' ? 600 : '100%', 
          maxWidth: '100%' 
        }]}>
              <View style={{ padding: 20, paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 12 }}><Text style={[s.modalTitle, { fontSize: 22, fontWeight: '900', color: C.text }]} numberOfLines={2}>{student.name}</Text></View>
                  <TouchableOpacity onPress={onClose} style={[s.themeBtn, { width: 36, height: 36, borderRadius: 18 }]}><Text style={{ color: C.text, fontSize: 22, lineHeight: 26 }}>×</Text></TouchableOpacity>
                </View>
              </View>
              <View style={{ flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                {sections.map(sec => (
                  <TouchableOpacity key={sec.key} onPress={() => setSubTab(sec.key as any)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: subTab === sec.key ? 2 : 0, borderBottomColor: C.accent }}>
                    {sec.icon}<Text style={{ color: subTab === sec.key ? C.accent : C.muted, fontSize: 10, fontWeight: subTab === sec.key ? '800' : '600', marginTop: 3 }}>{sec.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <ScrollView style={{ flexGrow: 1, flexShrink: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                {subTab === 'overview' && (
                  <View>
                    <View style={[s.dashboardCard, { flexDirection: 'row', padding: 20, marginBottom: 20, borderRadius: 24 }]}>
                      <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border }}><Text style={{ color: C.green, fontSize: 28, fontWeight: '900' }}>{studentAvg}%</Text><Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{t('profile.average').toUpperCase()}</Text></View>
                      <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.accent, fontSize: 28, fontWeight: '900' }}>{student.grade}</Text><Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{t('profile.grade').toUpperCase()}</Text></View>
                    </View>
                    <View style={{ gap: 16 }}>
                       <View><Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{t('profile.baptismalName').toUpperCase()}</Text><Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.baptismalName || student.baptismalname || t('profile.notProvided')}</Text></View>
                       <View><Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{t('profile.contact').toUpperCase()}</Text><Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.parentContact || student.parentcontact || t('profile.notProvided')}</Text></View>
                    </View>
                  </View>
                )}
                {subTab === 'marks' && (
                  <View style={{ gap: 12 }}>
                    {assessments.filter(a => normG(a.grade) === normG(student.grade) && !isConduct(a)).map((ass, idx) => {
                      const mark = studentMarks.find(m => (m.assessmentid || m.assessmentId) === ass.id);
                      const perc = mark ? (Number(mark.score) / ass.maxscore) * 100 : 0;
                      return (
                        <View key={idx} style={[s.dashboardCard, { borderRadius: 16, padding: 16, borderStyle: mark ? 'solid' : 'dashed', borderColor: mark ? C.border : C.amber + '44' }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flex: 1 }}><Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{ass.name}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{ass.subjectname}</Text></View>
                            <View style={{ alignItems: 'flex-end' }}>{mark ? (<><Text style={{ color: C.accent, fontWeight: '900', fontSize: 18 }}>{mark.score}</Text><Text style={{ color: C.muted, fontSize: 11 }}>/ {ass.maxscore}</Text></>) : (<View style={{ backgroundColor: C.amber + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}><Text style={{ color: C.amber, fontWeight: '900', fontSize: 12 }}>{t('profile.missing').toUpperCase()}</Text></View>)}</View>
                          </View>
                          {mark ? (<View style={{ height: 4, backgroundColor: C.border, borderRadius: 2 }}><View style={{ height: 4, backgroundColor: perc > 50 ? C.green : C.amber, borderRadius: 2, width: `${perc}%` }} /></View>) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
                {subTab === 'cert' && (
                  <LiveCertificate 
                    student={student}
                    assessments={assessments}
                    marks={marks}
                    allStudents={allStudents}
                    subjects={subjects}
                    settings={settings}
                    C={C}
                  />
                )}
                {subTab === 'attendance' && (
                  <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.8 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
                      <CalendarCheck size={40} color={C.accent} />
                    </View>
                    <Text style={{ color: C.text, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>{t('common.comingSoon')}</Text>
                    <Text style={{ color: C.muted, textAlign: 'center', fontSize: 14, lineHeight: 22, paddingHorizontal: 20 }}>
                      {t('common.underDevelopment')}
                    </Text>
                    <View style={{ marginTop: 24, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, backgroundColor: C.accent + '15', borderWidth: 1, borderColor: C.accent + '30' }}>
                      <Text style={{ color: C.accent, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 }}>{t('common.stayTuned')}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
      </View>
    </Modal>
  );
});
