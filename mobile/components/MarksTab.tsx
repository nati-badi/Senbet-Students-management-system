import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, RefreshControl, Modal, TouchableWithoutFeedback, Animated, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Edit, Trash2, ChevronRight, Clock } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '../supabase';
import { Student, Assessment, Teacher, normG, normS, isConduct, generateUUID, fmtGrade, paginate } from '../utils';
import { PremiumDropdown } from './PremiumDropdown';
import { useToast } from './ToastContext';

export const MarksTab = React.memo(({ route, navigation, teacher, students: allStudents, assessments: allAssessments, marksData, setMarksData, onRefresh, C, s, onStudentPress, settings, subjects }: {
  route: any, navigation: any, teacher: Teacher, students: Student[], assessments: Assessment[], marksData: any[], setMarksData: (data: any[]) => void, onRefresh: () => void, C: any, s: any, onStudentPress: (s: Student) => void, settings: any, subjects: any[]
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];

  const assignedSubjectsRaw = (teacher as any)?.assignedsubjects ?? (teacher as any)?.assignedSubjects;
  const hasTeacherAssignedSubjects = Array.isArray(assignedSubjectsRaw) && assignedSubjectsRaw.length > 0;
  const mySubjects = hasTeacherAssignedSubjects ? assignedSubjectsRaw : [];
  const normalizedMySubjects = useMemo(() => mySubjects.map(normS).filter(Boolean), [mySubjects]);
  
  const myStudents = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );

  const myAssessments = useMemo(() => 
    allAssessments.filter(a => {
      const isGradeMatch = !hasTeacherAssignedGrades || myGrades.includes(normG(a.grade)) || myGrades.includes(a.grade);
      const isSubjectMatch = !hasTeacherAssignedSubjects || normalizedMySubjects.includes(normS(a.subjectname));

      const subject = subjects.find(sub => normS(sub.name) === normS(a.subjectname));
      const assessmentSemester = subject?.semester || 'Semester I';
      const isSemesterMatch = assessmentSemester === (settings.currentSemester || 'Semester I');
      
      return isGradeMatch && isSubjectMatch && !isConduct(a) && isSemesterMatch;
    }),
    [allAssessments, hasTeacherAssignedGrades, myGrades, hasTeacherAssignedSubjects, normalizedMySubjects, subjects, settings.currentSemester]
  );

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [markIds, setMarkIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [bulkVisible, setBulkVisible] = useState(false);
  const [bulkScore, setBulkScore] = useState('');
  const [predictVisible, setPredictVisible] = useState(false);
  const [clearAllVisible, setClearAllVisible] = useState(false);
  const [predictDetails, setPredictDetails] = useState<{count: number, subject: string, students: any[]}>({ count: 0, subject: '', students: [] });
  const [page, setPage] = useState(0);
  const [modalError, setModalError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightEmptyData, setHighlightEmptyData] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null); 
  const inputRefs = useRef<Record<string, any>>({});
  const lastRoutedNonce = useRef<number | null>(null);

  const grades = useMemo(() => {
    return [...new Set(myStudents.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
  }, [myStudents]);

  const gradeAssessments = useMemo(() => myAssessments.filter((a) => normG(a.grade) === normG(selectedGrade)), [myAssessments, selectedGrade]);

  const gradeSubjects = useMemo(() => {
    const allowedSubjectKeyToLabel = new Map<string, string>();
    (mySubjects || []).forEach((subj) => {
      const key = normS(subj);
      if (!key) return;
      if (!allowedSubjectKeyToLabel.has(key)) allowedSubjectKeyToLabel.set(key, subj);
    });
    return [...allowedSubjectKeyToLabel.entries()].map(([key, label]) => ({ key, label }));
  }, [mySubjects]);

  const selectedSubjectKey = normS(selectedSubject);
  
  const filteredAssessments = useMemo(() => selectedSubject
    ? gradeAssessments.filter(a => normS(a.subjectname) === selectedSubjectKey)
    : gradeAssessments, [selectedSubject, gradeAssessments, selectedSubjectKey]);
  
  const filteredStudents = useMemo(() => {
    const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));
    return gradeStudents.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase()));
  }, [myStudents, selectedGrade, search]);

  const focusNext = (currentIndex: number) => {
    const paginated = paginate(filteredStudents, page);
    if (currentIndex < paginated.length - 1) {
      const nextItem = paginated[currentIndex + 1];
      inputRefs.current[nextItem.id]?.focus();
    }
  };

  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };

  useEffect(() => {
    if (highlightEmptyData) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 400, useNativeDriver: false })
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [highlightEmptyData]);

  useEffect(() => {
    const nonce = route.params?.nonce;
    if (route.params?.assessmentId && lastRoutedNonce.current !== nonce) {
      const ass = myAssessments.find(a => a.id === route.params.assessmentId);
      if (ass) {
        setSelectedGrade(String(ass.grade));
        setSelectedSubject(normS(ass.subjectname));
        setSelectedAssessment(ass);
      }
    } else if (route.params?.grade && !route.params.assessmentId) {
      setSelectedGrade(String(route.params.grade));
    }
    
    if (route.params?.highlightEmpty && route.params?.assessmentId) {
      if (lastRoutedNonce.current === nonce) return;
      setPage(99); 
      setTimeout(() => {
        if (filteredStudents.length > 0) {
          const firstMissingIndex = filteredStudents.findIndex(st => !marks[st.id] || marks[st.id] === '');
          if (firstMissingIndex !== -1) {
            flatListRef.current?.scrollToIndex({ index: firstMissingIndex, animated: true, viewPosition: 0 });
            lastRoutedNonce.current = nonce;
            setTimeout(() => {
              setHighlightEmptyData(true);
              setTimeout(() => setHighlightEmptyData(false), 2000);
            }, 600);
          }
        }
      }, 800);
    }
  }, [route.params, myAssessments, marks, filteredStudents.length]); 

  useEffect(() => {
    if (!selectedGrade && grades.length > 0) setSelectedGrade(grades[0]);
  }, [grades, selectedGrade]);

  useEffect(() => {
    if (selectedAssessment && normG(selectedAssessment.grade) !== normG(selectedGrade)) {
      setSelectedSubject('');
      setSelectedAssessment(null);
      return;
    }
  }, [selectedGrade]); 

  useEffect(() => {
    if (!selectedAssessment) {
      setMarks({});
      setMarkIds({});
      return;
    }
    const map: Record<string, string> = {};
    const idMap: Record<string, string> = {};
    marksData
      .filter(m => m.assessmentid === (selectedAssessment.id || (selectedAssessment as any).assessmentId))
      .forEach(m => { 
        map[m.studentid || m.studentId] = String(m.score);
        idMap[m.studentid || m.studentId] = m.id;
      });
    setMarks(map);
    setMarkIds(idMap);
  }, [selectedAssessment, marksData]);

  const saveMarksWithData = async (currentMarksData: Record<string, string>) => {
    if (!selectedAssessment) return;
    setSaving(true);
    try {
      const toUpsert: any[] = [];
      const toDeleteIds: string[] = [];
      const recordsToProcess: any[] = [];
      const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));

      gradeStudents.forEach(student => {
        const scoreStr = currentMarksData[student.id];
        const score = scoreStr && scoreStr !== '' ? Math.round(parseFloat(scoreStr)) : null;
        const existingId = markIds[student.id];

        const record = {
          id: existingId || generateUUID(),
          studentid: student.id,
          assessmentid: selectedAssessment.id,
          score,
          assessmentdate: selectedAssessment.date,
          semester: settings.currentSemester || 'Semester I',
          last_modified_by: teacher.id,
          updated_at: new Date().toISOString()
        };
        recordsToProcess.push(record);

        if (score !== null) {
          toUpsert.push(record);
        } else if (existingId) {
          toDeleteIds.push(existingId);
        }
      });

      const newMarksData = [...marksData];
      recordsToProcess.forEach(r => {
        const idx = newMarksData.findIndex(exist => (exist.studentid || exist.studentId) === r.studentid && (exist.assessmentid || exist.assessmentId) === r.assessmentid);
        if (r.score === null) {
          if (idx !== -1) newMarksData.splice(idx, 1);
        } else {
          if (idx !== -1) newMarksData[idx] = r;
          else newMarksData.push(r);
        }
      });
      setMarksData(newMarksData);

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('marks').upsert(toUpsert, { onConflict: 'id' });
        if (error) throw error;
      }
      if (toDeleteIds.length > 0) {
        const { error } = await supabase.from('marks').delete().in('id', toDeleteIds);
        if (error) throw error;
      }

      showToast?.('✅ Marks saved successfully', 'success');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast?.('❌ ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveMarks = () => saveMarksWithData(marks);

  const handleFillConstantMark = () => {
    if (!selectedAssessment) return;
    const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));
    const studentsWithoutMarks = gradeStudents.filter(st => marks[st.id] === undefined || marks[st.id] === '');
    if (studentsWithoutMarks.length === 0) {
      showToast?.('ℹ️ All students already have marks', 'info');
      return;
    }
    setModalError(null);
    setBulkVisible(true);
  };

  const applyBulkFill = () => {
    setModalError(null);
    const val = parseFloat(bulkScore);
    if (isNaN(val) || val < 0 || val > selectedAssessment!.maxscore) {
      setModalError(`❌ ${t('teacher.validScore')}: 0–${selectedAssessment!.maxscore}`);
      return;
    }
    const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));
    const studentsWithoutMarks = gradeStudents.filter(st => marks[st.id] === undefined || marks[st.id] === '');
    const updates = { ...marks };
    studentsWithoutMarks.forEach(s => updates[s.id] = val.toString());
    setMarks(updates);
    setBulkVisible(false);
    setBulkScore('');
    saveMarksWithData(updates);
  };

  const handleClearMarks = () => {
    if (!selectedAssessment) return;
    const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));
    const studentsWithMarks = gradeStudents.filter((s) => {
      const v = marks[s.id];
      if (v === undefined || v === '') return false;
      const n = parseFloat(v);
      return v !== 'null' && !Number.isNaN(n);
    });
    if (studentsWithMarks.length === 0) {
      showToast?.(`ℹ️ ${t('teacher.alreadyCleared')}`, 'info');
      return;
    }
    setClearAllVisible(true);
  };

  const applyClearAllMarks = () => {
    if (!selectedAssessment) return;
    const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));
    const updates = { ...marks };
    gradeStudents.forEach(s => updates[s.id] = '');
    setMarks(updates);
    setClearAllVisible(false);
    saveMarksWithData(updates);
    showToast?.(`🧹 ${t('teacher.clearedSuccess')}`, 'success');
  };

  const handlePredictMarks = () => {
    if (!selectedAssessment) return;
    const gradeStudents = myStudents.filter((st) => normG(st.grade) === normG(selectedGrade));
    const studentsWithoutMarks = gradeStudents.filter(st => marks[st.id] === undefined || marks[st.id] === '');
    if (studentsWithoutMarks.length === 0) {
      showToast?.(`ℹ️ ${t('teacher.allHaveMarks')}`, 'info');
      return;
    }

    const targetSubject = normS(selectedAssessment.subjectname);
    const studentsWithHistory = [];
    for (const student of studentsWithoutMarks) {
      const historyCount = marksData.filter(m => (m.studentid || m.studentId) === student.id).filter(m => {
        const markSubject = m.subject ? normS(m.subject) : null;
        if (markSubject) return markSubject === targetSubject;
        const a = allAssessments.find(ax => ax.id === (m.assessmentid || m.assessmentId));
        return a && normS(a.subjectname) === targetSubject;
      }).length;
      if (historyCount > 0) studentsWithHistory.push(student);
    }

    if (studentsWithHistory.length === 0) {
      showToast?.(`⚠️ ${t('teacher.noHistoryPoints')}`, 'info');
      return;
    }
    setModalError(null);
    setPredictDetails({ count: studentsWithHistory.length, subject: selectedAssessment.subjectname, students: studentsWithHistory });
    setPredictVisible(true);
  };

  const applyPrediction = () => {
    const updates = { ...marks };
    for (const student of predictDetails.students) {
      const subjectMarks = marksData.filter(m => (m.studentid || m.studentId) === student.id).filter(m => {
        const a = allAssessments.find(ax => ax.id === (m.assessmentid || m.assessmentId));
        return a && normS(a.subjectname) === normS(predictDetails.subject);
      });
      if (subjectMarks.length > 0) {
        let totalPercentage = 0;
        let validCount = 0;
        for (const m of subjectMarks) {
          const assessment = allAssessments.find(a => a.id === (m.assessmentid || m.assessmentId));
          if (assessment && assessment.maxscore > 0) {
            totalPercentage += (Number(m.score) / assessment.maxscore);
            validCount++;
          }
        }
        if (validCount > 0) {
          const avgPercentage = totalPercentage / validCount;
          const predictedScore = Math.round(avgPercentage * selectedAssessment!.maxscore * 10) / 10;
          updates[student.id] = predictedScore.toString();
        }
      }
    }
    setMarks(updates);
    setPredictVisible(false);
    saveMarksWithData(updates);
  };

  const renderItem = useMemo(() => ({ item, index }: { item: Student, index: number }) => {
    const isMissing = !marks[item.id] || marks[item.id] === '';
    const shouldHighlight = highlightEmptyData && isMissing;
    return (
      <Animated.View style={[s.markRow, { padding: 12, borderRadius: 16 }, shouldHighlight ? { backgroundColor: C.accentMuted } : null]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.studentName, { fontSize: 15 }]}>{item.name}</Text>
          {item.baptismalname ? <Text style={s.studentSub}>{item.baptismalname}</Text> : null}
        </View>
        <TextInput 
          ref={el => { inputRefs.current[item.id] = el; }}
          style={[s.markInput, { width: 80, height: 44, borderRadius: 12, backgroundColor: C.bg }]} 
          keyboardType="numeric" 
          placeholder="0" 
          placeholderTextColor={C.muted} 
          value={marks[item.id] || ''} 
          onChangeText={(val) => { const score = parseFloat(val); if (val !== '' && !isNaN(score) && selectedAssessment && score > selectedAssessment.maxscore) { showToast?.(`❌ Max score is ${selectedAssessment.maxscore}`, 'error'); return; } setMarks(prev => ({ ...prev, [item.id]: val })); }} 
          editable={!!selectedAssessment}
          returnKeyType="next"
          onSubmitEditing={() => focusNext(index)}
        />
      </Animated.View>
    );
  }, [marks, highlightEmptyData, selectedAssessment, C, s, showToast, focusNext]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Text style={[s.sectionTitle, { marginBottom: 16 }]}>{t('teacher.marks')}</Text>

        <View style={{ marginBottom: 12 }}>
          <PremiumDropdown label={t('profile.grade', 'Grade')} placeholder={t('common.selectGrade', 'Select Grade')} items={grades.map(g => ({ key: g, label: fmtGrade(g) }))} selectedKey={selectedGrade} onSelect={(key) => { setSelectedGrade(key); setSelectedSubject(''); setSelectedAssessment(null); }} C={C} s={s} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <PremiumDropdown label={t('assessment.subject', 'Subject')} placeholder={t('common.selectSubject', 'Select Subject')} items={gradeSubjects} selectedKey={selectedSubjectKey} onSelect={(key) => { setSelectedSubject(key); setSelectedAssessment(null); }} C={C} s={s} disabled={!selectedGrade} />
          </View>
          <View style={{ flex: 1 }}>
            <PremiumDropdown label={t('assessment.label', 'Assessment')} placeholder={t('common.selectAssessment', 'Select Assessment')} items={filteredAssessments.map(a => ({ key: a.id, label: a.name }))} selectedKey={selectedAssessment?.id || null} onSelect={(key) => { const a = filteredAssessments.find(ax => ax.id === key); if (a) { setSelectedSubject(normS(a.subjectname)); setSelectedAssessment(a); } }} C={C} s={s} disabled={!selectedSubjectKey} />
          </View>
        </View>
        <TextInput style={[s.searchInput, { margin: 0, marginBottom: 16 }]} placeholder={t('common.searchStudents')} placeholderTextColor={C.muted} value={search} onChangeText={setSearch} />
      </View>

      <FlatList 
        ref={flatListRef} 
        data={paginate(filteredStudents, page)} 
        keyExtractor={item => item.id} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />} 
        extraData={[selectedAssessment?.id, marks]} 
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }} 
        keyboardShouldPersistTaps="handled" 
        keyboardDismissMode="on-drag" 
        ListHeaderComponent={selectedAssessment ? (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
               <View>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>{selectedAssessment.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>{t('teacher.maxScoreLabel')}: {selectedAssessment.maxscore}</Text>
               </View>
               <View style={{ backgroundColor: C.accent + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: C.accent, fontSize: 11, fontWeight: '800' }}>{t('common.active').toUpperCase()}</Text>
               </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={handlePredictMarks} style={s.actionBtn}>
                <TrendingUp size={18} color={C.accent} />
                <Text style={s.actionBtnText}>{t('teacher.predict')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleFillConstantMark} style={s.actionBtn}>
                <Edit size={18} color={C.accent} />
                <Text style={s.actionBtnText}>{t('teacher.constant')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearMarks} style={[s.actionBtn, { backgroundColor: C.red + '11' }]}>
                <Trash2 size={18} color={C.red} />
                <Text style={[s.actionBtnText, { color: C.red }]}>{t('teacher.clearAll')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null} 
        renderItem={renderItem} 
        onEndReached={() => setPage(p => p + 1)} 
        onEndReachedThreshold={0.5} 
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />

      <Modal visible={bulkVisible} transparent animationType="fade" onRequestClose={() => { setBulkVisible(false); setBulkScore(''); }}>
        <TouchableWithoutFeedback onPress={() => { setBulkVisible(false); setBulkScore(''); }}>
          <View style={s.modalOverlay}>
            <BlurView intensity={40} style={StyleSheet.absoluteFill} tint={C.isDark ? 'dark' : 'light'} />
            <TouchableWithoutFeedback>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{t('teacher.fillConstant')}</Text>
                <Text style={s.modalSub}>{t('teacher.fillConstantDesc')} (Max: {selectedAssessment?.maxscore})</Text>

                {modalError && (
                  <View style={{ backgroundColor: C.red + '15', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: C.red + '30' }}>
                    <Text style={{ color: C.red, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{modalError}</Text>
                  </View>
                )}

                <TextInput style={[s.loginInput, { width: '100%', textAlign: 'center', marginBottom: 20, fontSize: 20, fontWeight: '800' }]} keyboardType="numeric" placeholder={`0 - ${selectedAssessment?.maxscore || 10}`} placeholderTextColor={C.muted} value={bulkScore} onChangeText={(val) => { setBulkScore(val); setModalError(null); }} autoFocus />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => { setBulkVisible(false); setBulkScore(''); }} style={[s.modalBtn, { backgroundColor: C.card }]}><Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={applyBulkFill} style={s.modalBtn}><Text style={s.modalBtnText}>{t('common.apply')}</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={predictVisible} transparent animationType="fade" onRequestClose={() => setPredictVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setPredictVisible(false)}>
          <View style={s.modalOverlay}>
            <BlurView intensity={40} style={StyleSheet.absoluteFill} tint={C.isDark ? 'dark' : 'light'} />
            <TouchableWithoutFeedback>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{t('teacher.predictMarks')}</Text>
                <Text style={[s.modalSub, { marginBottom: 20 }]}>{t('teacher.predictDesc', { count: predictDetails.count, subject: predictDetails.subject })}</Text>

                {modalError && (
                  <View style={{ backgroundColor: C.red + '15', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: C.red + '30' }}>
                    <Text style={{ color: C.red, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{modalError}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setPredictVisible(false)} style={[s.modalBtn, { backgroundColor: C.card }]}><Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={applyPrediction} style={[s.modalBtn, { backgroundColor: C.accent }]}><Text style={[s.modalBtnText, { color: '#fff' }]}>{t('teacher.predict')}</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={clearAllVisible} transparent animationType="fade" onRequestClose={() => setClearAllVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setClearAllVisible(false)}>
          <View style={s.modalOverlay}>
            <BlurView intensity={40} style={StyleSheet.absoluteFill} tint={C.isDark ? 'dark' : 'light'} />
            <TouchableWithoutFeedback>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{t('teacher.clearAllMarks')}</Text>
                <Text style={[s.modalSub, { marginBottom: 20 }]}>{t('teacher.confirmClearAll')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setClearAllVisible(false)} style={[s.modalBtn, { backgroundColor: C.bg }]}><Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={applyClearAllMarks} style={[s.modalBtn, { backgroundColor: C.red + '15' }]}><Text style={[s.modalBtnText, { color: C.red, fontWeight: '800' }]}>{t('common.yes')}</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {selectedAssessment && (
        <BlurView intensity={80} tint={C.isDark ? 'dark' : 'light'} style={[s.glassFooter, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity 
            style={s.glassBtn} 
            onPress={saveMarks} 
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>{t('teacher.saveMarks')}</Text>}
          </TouchableOpacity>
        </BlurView>
      )}
    </KeyboardAvoidingView>
  );
});
