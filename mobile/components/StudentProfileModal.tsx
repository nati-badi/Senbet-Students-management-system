import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TouchableWithoutFeedback, Pressable, Platform, StyleSheet, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { Info, CalendarCheck, TrendingUp, Users } from 'lucide-react-native';
import { Student, Assessment, normG, normS, isConduct } from '../utils';
import { calculateSingleStudentRank, calculateSubjectRows } from '../analyticsEngine';

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
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: '100%', minHeight: 480, backgroundColor: '#fdfbf7', padding: 24, borderWidth: 1, borderColor: '#e8dfce', position: 'relative' }}>
                      <View style={{ position: 'absolute', top: 12, left: 12, width: 16, height: 16, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#d4af37' }} />
                      <View style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#d4af37' }} />
                      <View style={{ position: 'absolute', bottom: 12, left: 12, width: 16, height: 16, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: '#d4af37' }} />
                      <View style={{ position: 'absolute', bottom: 12, right: 12, width: 16, height: 16, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#d4af37' }} />

                      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 12 }}>
                        <Image source={require('../assets/logo.png')} style={{ width: 42, height: 42, resizeMode: 'contain' }} />
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ textAlign: 'center', color: '#2c1810', fontSize: 16, fontWeight: '900', marginBottom: 2 }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Text>
                          <Text style={{ textAlign: 'center', color: '#5c4033', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>የተማሪዎች ውጤት መግለጫ</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'center', marginBottom: 24 }}>
                        <View style={{ width: 40, height: 1, backgroundColor: '#d4af37', marginBottom: 12 }} />
                        <Text style={{ textAlign: 'center', color: '#8b0000', fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>ACADEMIC TRANSCRIPT</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#e8dfce', paddingBottom: 12, marginBottom: 24 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 9, color: '#8c7361', fontWeight: '800', letterSpacing: 1 }}>ሙሉ ስም / NAME</Text>
                          <Text style={{ fontSize: 16, color: '#2c1810', fontWeight: '800', marginTop: 2 }}>{student.name}</Text>
                          {!!(student.baptismalName || student.baptismalname) && (
                            <Text style={{ fontSize: 12, color: '#5c4033', fontStyle: 'italic', marginTop: 2 }}>የክርስትና ስም: {student.baptismalName || student.baptismalname}</Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                           <Text style={{ fontSize: 9, color: '#8c7361', fontWeight: '800', letterSpacing: 1 }}>ክፍል / GRADE</Text>
                           <Text style={{ fontSize: 14, color: '#2c1810', fontWeight: '800', marginTop: 2, marginBottom: 8 }}>{student.grade}</Text>
                           <Text style={{ fontSize: 9, color: '#8c7361', fontWeight: '800', letterSpacing: 1 }}>ዓ.ም / YEAR</Text>
                           <Text style={{ fontSize: 14, color: '#2c1810', fontWeight: '800', marginTop: 2 }}>{getEthiopianYear(student.academicYear || student.academicyear)}</Text>
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
                             <Text style={{ fontSize: 18, color: '#8b0000', fontWeight: '900' }}>{overallAvg}%</Text>
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

                         <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e8dfce', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                           <QRCode value={student.id} size={48} color="#2c1810" backgroundColor="#fdfbf7" />
                           <View style={{ flex: 1 }}>
                             <Text style={{ fontSize: 9, fontWeight: '900', color: '#2c1810', letterSpacing: 1 }}>OFFICIAL RECORD</Text>
                             <Text style={{ fontSize: 8, color: '#8c7361', marginTop: 2 }}>Digitally verified academic transcript.</Text>
                           </View>
                         </View>
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
      </View>
    </Modal>
  );
});
