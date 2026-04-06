import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TouchableWithoutFeedback, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Info, CalendarCheck, TrendingUp, Users } from 'lucide-react-native';
import { Student, Assessment, normG, normS, isConduct } from '../utils';

export const StudentProfileModal = React.memo(({ student, onClose, assessments, marks, allStudents, subjects, settings, C, s }: {
  student: Student | null, onClose: () => void, assessments: Assessment[], marks: any[], allStudents: Student[], subjects: any[], settings: any, C: any, s: any
}) => {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'overview' | 'attendance' | 'marks' | 'cert'>('overview');
  
  const getEthiopianYear = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    if (String(dateString).includes('E.C.') || String(dateString).includes('ዓ.ም')) return dateString;
    if (String(dateString).includes('-')) {
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
    return (m.studentid || m.studentId) === student.id && ass && !isConduct(ass);
  }), [marks, assessments, student?.id]);
  
  const rankings = useMemo(() => {
    if (!student) return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };
    const sGrade = String(student.grade);
    const gAss = assessments.filter(a => String(a.grade) === sGrade && !isConduct(a));
    if (gAss.length === 0) return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };
    
    const aIds = gAss.map(a => a.id);
    const gMarks = marks.filter(m => aIds.includes(m.assessmentid || m.assessmentId));
    const gStudents = allStudents.filter(s => String(s.grade) === sGrade);
    
    const calculatedRankings = gStudents.map(s => {
      let score = 0, max = 0;
      gAss.forEach(a => {
        const m = gMarks.find(mx => (mx.studentid || mx.studentId) === s.id && (mx.assessmentid || mx.assessmentId) === a.id);
        if (m) score += Number(m.score) || 0;
        max += a.maxscore;
      });
      return { id: s.id, grade: s.grade, perc: max > 0 ? (score / max) * 100 : 0, hasData: max > 0 };
    }).filter(s => s.hasData).sort((a, b) => b.perc - a.perc);

    const overallIdx = calculatedRankings.findIndex(r => r.id === student.id);
    const classRanks = calculatedRankings.filter(r => r.grade === student.grade);
    const classIdx = classRanks.findIndex(r => r.id === student.id);

    return { 
      overallRank: overallIdx !== -1 ? overallIdx + 1 : 'N/A', 
      totalInGrade: calculatedRankings.length,
      classRank: classIdx !== -1 ? classIdx + 1 : 'N/A',
      totalInClass: classRanks.length
    };
  }, [student?.id, student?.grade, assessments, marks, allStudents]);

  const { classRank, overallRank, totalInClass, totalInGrade } = rankings;

  const stats = useMemo(() => {
    const totalScore = studentMarks.reduce((acc, m) => acc + (Number(m.score) || 0), 0);
    const maxPossible = studentMarks.reduce((acc, m) => {
      const ass = assessments.find(a => a.id === (m.assessmentid || m.assessmentId));
      return acc + (ass?.maxscore || 100);
    }, 0);
    const avg = maxPossible > 0 ? ((totalScore / maxPossible) * 100).toFixed(1) : '0';
    return { totalScore, maxPossible, avg };
  }, [studentMarks, assessments]);

  const activeSemester = settings?.currentSemester || 'Semester I';
  
  const subjectRows = useMemo(() => {
    if (!student) return [];
    const gradeAssessments = assessments.filter(a => normG(a.grade) === normG(student.grade) && !isConduct(a));
    const subjectsList = [...new Set(gradeAssessments.map(a => a.subjectname))].sort() as string[];
    
    return subjectsList.map(subject => {
      const semIAssessments = gradeAssessments.filter(a => {
        const subjObj = subjects.find(s => normS(s.name) === normS(a.subjectname));
        return normS(a.subjectname) === normS(subject) && (subjObj?.semester || 'Semester I') === 'Semester I';
      });
      const semIIAssessments = gradeAssessments.filter(a => {
        const subjObj = subjects.find(s => normS(s.name) === normS(a.subjectname));
        return normS(a.subjectname) === normS(subject) && subjObj?.semester === 'Semester II';
      });
      
      const semIEarned = semIAssessments.reduce((acc, a) => {
        const m = marks.find(mark => (mark.studentid || mark.studentId) === student.id && (mark.assessmentid || mark.assessmentId) === a.id);
        return acc + (m ? Number(m.score) : 0);
      }, 0);
      const semIMax = semIAssessments.reduce((acc, a) => acc + (Number(a.maxscore) || 0), 0);
      const semIHasData = semIAssessments.some(a => marks.find(m => (m.studentid || m.studentId) === student.id && (m.assessmentid || m.assessmentId) === a.id));

      const semIIEarned = semIIAssessments.reduce((acc, a) => {
        const m = marks.find(mark => (mark.studentid || mark.studentId) === student.id && (mark.assessmentid || mark.assessmentId) === a.id);
        return acc + (m ? Number(m.score) : 0);
      }, 0);
      const semIIMax = semIIAssessments.reduce((acc, a) => acc + (Number(a.maxscore) || 0), 0);
      const semIIHasData = semIIAssessments.some(a => marks.find(m => (m.studentid || m.studentId) === student.id && (m.assessmentid || m.assessmentId) === a.id));

      let totalMax = 0;
      let totalEarned = 0;

      if (activeSemester === 'Semester I') {
        totalMax = semIMax;
        totalEarned = semIEarned;
      } else {
        totalMax = semIMax + semIIMax;
        totalEarned = semIEarned + semIIEarned;
      }

      const avgPct = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(0) : '-';

      return {
        subject,
        semI: semIHasData ? `${semIEarned} / ${semIMax}` : (semIAssessments.length ? '—' : 'N/A'),
        semII: semIIHasData ? `${semIIEarned} / ${semIIMax}` : (semIIAssessments.length ? '—' : 'N/A'),
        avg: avgPct !== '-' ? `${avgPct}%` : '—',
        rowMax: totalMax,
        rowEarned: totalEarned
      };
    });
  }, [student?.id, student?.grade, assessments, marks, subjects, activeSemester]);

  const liveTotals = useMemo(() => {
    let liveTotalMax = 0;
    let liveTotalEarned = 0;
    subjectRows.forEach(row => {
      liveTotalMax += row.rowMax;
      liveTotalEarned += row.rowEarned;
    });
    const overallAvg = liveTotalMax > 0 ? ((liveTotalEarned / liveTotalMax) * 100).toFixed(1) : '0';
    return { liveTotalMax, liveTotalEarned, overallAvg };
  }, [subjectRows]);

  const sections = [
    { key: 'overview', label: t('profile.overview'), icon: <Info size={18} color={subTab === 'overview' ? C.accent : C.muted} /> },
    { key: 'attendance', label: t('profile.attendance'), icon: <CalendarCheck size={18} color={subTab === 'attendance' ? C.accent : C.muted} /> },
    { key: 'marks', label: t('profile.marks'), icon: <TrendingUp size={18} color={subTab === 'marks' ? C.accent : C.muted} /> },
    { key: 'cert', label: t('profile.cert'), icon: <Users size={18} color={subTab === 'cert' ? C.accent : C.muted} /> },
  ];

  if (!student) return null;

  return (
    <Modal visible={!!student} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable 
        style={[s.modalOverlay, { padding: 16, alignItems: 'center' }]} 
        onPress={onClose}
      >
        <Pressable 
          onPress={(e) => e.stopPropagation()} 
          style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
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
                      <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border }}><Text style={{ color: C.green, fontSize: 28, fontWeight: '900' }}>{stats.avg}%</Text><Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{t('profile.average').toUpperCase()}</Text></View>
                      <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: C.accent, fontSize: 28, fontWeight: '900' }}>{student.grade}</Text><Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{t('profile.grade').toUpperCase()}</Text></View>
                    </View>
                    <View style={{ gap: 16 }}>
                       <View><Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{t('profile.baptismalName').toUpperCase()}</Text><Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.baptismalname || t('profile.notProvided')}</Text></View>
                       <View><Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 4 }}>{t('profile.contact').toUpperCase()}</Text><Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>{student.parentcontact || t('profile.notProvided')}</Text></View>
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
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: '100%', minHeight: 480, backgroundColor: '#fdfbf7', padding: 24, borderWidth: 1, borderColor: '#e8dfce', position: 'relative' }}>
                      <View style={{ position: 'absolute', top: 12, left: 12, width: 16, height: 16, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#d4af37' }} />
                      <View style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#d4af37' }} />
                      <View style={{ position: 'absolute', bottom: 12, left: 12, width: 16, height: 16, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: '#d4af37' }} />
                      <View style={{ position: 'absolute', bottom: 12, right: 12, width: 16, height: 16, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#d4af37' }} />

                      <View style={{ alignItems: 'center', marginBottom: 24 }}>
                        <Text style={{ textAlign: 'center', color: '#2c1810', fontSize: 16, fontWeight: '900', marginBottom: 4 }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Text>
                        <Text style={{ textAlign: 'center', color: '#5c4033', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>የተማሪዎች ውጤት መግለጫ</Text>
                        <View style={{ width: 40, height: 1, backgroundColor: '#d4af37', marginVertical: 12 }} />
                        <Text style={{ textAlign: 'center', color: '#8b0000', fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>ACADEMIC TRANSCRIPT</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#e8dfce', paddingBottom: 12, marginBottom: 24 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 9, color: '#8c7361', fontWeight: '800', letterSpacing: 1 }}>ሙሉ ስም / NAME</Text>
                          <Text style={{ fontSize: 16, color: '#2c1810', fontWeight: '800', marginTop: 2 }}>{student.name}</Text>
                          {!!student.baptismalname && (
                            <Text style={{ fontSize: 12, color: '#5c4033', fontStyle: 'italic', marginTop: 2 }}>የክርስትና ስም: {student.baptismalname}</Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                           <Text style={{ fontSize: 9, color: '#8c7361', fontWeight: '800', letterSpacing: 1 }}>ክፍል / GRADE</Text>
                           <Text style={{ fontSize: 14, color: '#2c1810', fontWeight: '800', marginTop: 2, marginBottom: 8 }}>{student.grade}</Text>
                           <Text style={{ fontSize: 9, color: '#8c7361', fontWeight: '800', letterSpacing: 1 }}>ዓ.ም / YEAR</Text>
                           <Text style={{ fontSize: 14, color: '#2c1810', fontWeight: '800', marginTop: 2 }}>{getEthiopianYear(student.academicyear)}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.3)', paddingBottom: 8, marginBottom: 8 }}>
                          <Text style={{ flex: 2, fontSize: 9, color: '#8c7361', fontWeight: '800' }}>የትምህርት አይነት / SUBJECT</Text>
                          <Text style={{ flex: 1, fontSize: 8, color: '#8c7361', fontWeight: '800', textAlign: 'center' }}>፩ኛ መንፈቀ ዓመት / SEM I</Text>
                          <Text style={{ flex: 1, fontSize: 8, color: '#8c7361', fontWeight: '800', textAlign: 'center' }}>፪ኛ መንፈቀ ዓመት / SEM II</Text>
                          <Text style={{ flex: 1, fontSize: 9, color: '#8c7361', fontWeight: '800', textAlign: 'center' }}>አማካይ / AVG</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        {subjectRows.length === 0 ? (
                            <Text style={{ textAlign: 'center', padding: 24, fontStyle: 'italic', color: '#8c7361', fontSize: 12 }}>No assessments defined.</Text>
                        ) : (
                          subjectRows.map((row, i) => (
                            <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(232, 223, 206, 0.5)' }}>
                              <Text style={{ flex: 2, fontSize: 11, color: '#2c1810', fontWeight: '600' }}>{row.subject}</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: '#5c4033', textAlign: 'center' }}>{row.semI}</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: '#5c4033', textAlign: 'center' }}>{row.semII}</Text>
                              <Text style={{ flex: 1, fontSize: 11, color: '#2c1810', textAlign: 'center', fontWeight: '800' }}>{row.avg}</Text>
                            </View>
                          ))
                        )}
                      </View>

                      <View style={{ marginTop: 24 }}>
                         <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e8dfce' }}>
                             <Text style={{ fontSize: 10, color: '#2c1810', fontWeight: '800', letterSpacing: 1 }}>አጠቃላይ ድምር / GRAND TOTAL</Text>
                             <Text style={{ fontSize: 18, color: '#8b0000', fontWeight: '900' }}>{liveTotals.overallAvg}%</Text>
                         </View>
                         {totalInClass > 0 && (
                             <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                                 <Text style={{ fontSize: 9, color: '#5c4033', fontWeight: '800', letterSpacing: 1 }}>ክፍል ደረጃ / CLASS RANK</Text>
                                 <Text style={{ fontSize: 14, color: '#2c1810', fontWeight: '800' }}>{classRank} / {totalInClass}</Text>
                             </View>
                         )}
                         {totalInGrade > 0 && (
                             <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                                 <Text style={{ fontSize: 9, color: '#8c7361', fontWeight: '800', letterSpacing: 1 }}>አጠቃላይ ደረጃ / GRADE RANK</Text>
                                 <Text style={{ fontSize: 12, color: '#5c4033', fontWeight: '700' }}>{overallRank} / {totalInGrade}</Text>
                             </View>
                         )}
                      </View>
                    </View>
                  </View>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
});
