import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, TouchableWithoutFeedback, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, FileText, Edit, Trash2 } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '../supabase';
import { Student, Assessment, Teacher, normG, normS, generateUUID, fmtGrade } from '../utils';
import { PremiumDropdown } from './PremiumDropdown';
import { useToast } from './ToastContext';

export const AssessmentManagementTab = React.memo(({ teacher, assessments: allAssessments, subjects, settings, C, s, onRefresh }: {
  teacher: Teacher, assessments: Assessment[], subjects: any[], settings: any, C: any, s: any, onRefresh?: () => Promise<void> | void
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const myGrades = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades ?? [];
  const mySubjects = (teacher as any)?.assignedsubjects ?? (teacher as any)?.assignedSubjects ?? [];

  const myAssessments = useMemo(() => allAssessments.filter(a =>
    myGrades.some((g: string) => normG(g) === normG(a.grade)) &&
    mySubjects.some((sub: string) => normS(sub) === normS(a.subjectname))
  ), [allAssessments, myGrades, mySubjects]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [name, setName] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = async () => { setRefreshing(true); if (onRefresh) await onRefresh(); setRefreshing(false); };

  useEffect(() => {
    if (myGrades.length === 1 && !selectedGrade) setSelectedGrade(myGrades[0]);
    if (mySubjects.length === 1 && !selectedSubject) setSelectedSubject(mySubjects[0]);
  }, [myGrades, mySubjects]);

  const filteredAssessments = useMemo(() => myAssessments.filter(a => {
    if (selectedGrade && normG(a.grade) !== normG(selectedGrade)) return false;
    if (selectedSubject && normS(a.subjectname) !== normS(selectedSubject)) return false;
    return true;
  }), [myAssessments, selectedGrade, selectedSubject]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setMaxScore('');
    setModalError(null);
    setModalVisible(true);
  };

  const handleEdit = (a: Assessment) => {
    setSelectedGrade(a.grade);
    setSelectedSubject(a.subjectname);
    setName(a.name);
    setMaxScore(String(a.maxscore));
    setEditingId(a.id);
    setModalError(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    setModalError(null);
    if (!selectedGrade) { setModalError('❌ Please select a grade'); return; }
    if (!selectedSubject) { setModalError('❌ Please select a subject'); return; }
    if (!name.trim()) { setModalError('❌ Please enter an assessment name'); return; }
    if (!maxScore) { setModalError('❌ Please enter a max score'); return; }

    const ms = parseFloat(maxScore);
    if (isNaN(ms) || ms <= 0) {
      setModalError('❌ Max score must be a positive number');
      return;
    }

    setSaving(true);
    try {
      const record = {
        id: editingId || generateUUID(),
        name: name.trim(),
        subjectname: selectedSubject,
        grade: selectedGrade,
        maxscore: ms,
        date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('assessments').upsert(record, { onConflict: 'id' });
      if (error) throw error;

      showToast(editingId ? 'Assessment updated' : 'Assessment created', 'success');
      setModalVisible(false);
      setName(''); setMaxScore(''); setEditingId(null); setModalError(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setModalError('❌ ' + (err.message || 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('assessments').delete().eq('id', id);
      if (error) throw error;
      showToast(`${t('assessment.deletedSuccess')}`, 'success');
      setDeleteConfirmId(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast(`${err.message || t('common.error')}`, 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={[s.sectionTitle, { marginBottom: 0 }]}>{t('assessment.manageTitle')}</Text>
          <TouchableOpacity 
            onPress={handleOpenCreate}
            style={{ backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Plus size={18} color="#fff" strokeWidth={3} />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{t('common.add')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 16 }}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              style={[s.gradeChip, !selectedGrade && s.gradeChipActive]}
              onPress={() => setSelectedGrade('')}
            >
              <Text style={[s.gradeChipText, !selectedGrade && s.gradeChipTextActive]}>{t('common.all')}</Text>
            </TouchableOpacity>
            {myGrades.map((g: string) => (
              <TouchableOpacity
                key={g}
                style={[s.gradeChip, normG(selectedGrade) === normG(g) && s.gradeChipActive]}
                onPress={() => setSelectedGrade(g)}
              >
                <Text style={[s.gradeChipText, normG(selectedGrade) === normG(g) && s.gradeChipTextActive]}>{fmtGrade(g)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {filteredAssessments.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60, opacity: 0.5 }}>
            <FileText size={48} color={C.muted} />
            <Text style={[s.empty, { marginTop: 16 }]}>{t('assessment.noAssessments')}</Text>
          </View>
        ) : (
          filteredAssessments.map(a => (
            <View key={a.id} style={[s.dashboardCard, { borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{a.name}</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{a.subjectname} • {fmtGrade(a.grade)} • Max: {a.maxscore}</Text>
              </View>
              <TouchableOpacity onPress={() => handleEdit(a)} style={{ padding: 10, marginRight: 4, backgroundColor: C.accent + '10', borderRadius: 10 }}>
                <Edit size={18} color={C.accent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDeleteConfirmId(a.id)} style={{ padding: 10, backgroundColor: C.red + '10', borderRadius: 10 }}>
                <Trash2 size={18} color={C.red} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* CREATE / EDIT MODAL */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={s.modalOverlay}>
            <BlurView intensity={40} style={StyleSheet.absoluteFill} tint={C.isDark ? 'dark' : 'light'} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center' }}>
              <TouchableWithoutFeedback>
                <View style={[s.modalCard, { padding: 24 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Text style={[s.modalTitle, { marginBottom: 0 }]}>
                      {editingId ? t('assessment.editTitle', 'Edit Assessment') : t('assessment.newTitle', 'New Assessment')}
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                      <Text style={{ color: C.muted, fontSize: 24 }}>×</Text>
                    </TouchableOpacity>
                  </View>

                  {modalError && (
                    <View style={{ backgroundColor: C.red + '15', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: C.red + '30' }}>
                      <Text style={{ color: C.red, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{modalError}</Text>
                    </View>
                  )}

                  <PremiumDropdown 
                    label={t('profile.grade')} 
                    placeholder={t('common.selectGrade')} 
                    items={myGrades.map((g: string) => ({ key: g, label: fmtGrade(g) }))} 
                    selectedKey={selectedGrade} 
                    onSelect={setSelectedGrade} 
                    C={C} s={s} 
                  />

                  <PremiumDropdown 
                    label={t('assessment.subject')} 
                    placeholder={t('common.selectSubject')} 
                    items={mySubjects.map((sub: string) => ({ key: sub, label: sub }))} 
                    selectedKey={selectedSubject} 
                    onSelect={setSelectedSubject} 
                    C={C} s={s} 
                    disabled={!selectedGrade}
                  />

                  <Text style={s.inputLabel}>{t('assessment.assessmentName')}</Text>
                  <TextInput
                    style={[s.loginInput, { marginBottom: 16 }]}
                    placeholder={t('assessment.nameExample')}
                    placeholderTextColor={C.muted}
                    value={name}
                    onChangeText={setName}
                  />

                  <Text style={s.inputLabel}>{t('assessment.maxScore')}</Text>
                  <TextInput
                    style={[s.loginInput, { marginBottom: 24 }]}
                    placeholder={t('assessment.maxScoreExample')}
                    placeholderTextColor={C.muted}
                    value={maxScore}
                    onChangeText={setMaxScore}
                    keyboardType="numeric"
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      style={[s.modalBtn, { backgroundColor: C.border }]}
                    >
                      <Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={saving}
                      style={[s.modalBtn, { backgroundColor: C.accent, opacity: saving ? 0.6 : 1 }]}
                    >
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnText}>{editingId ? t('common.save') : t('common.create')}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={!!deleteConfirmId} transparent animationType="fade" onRequestClose={() => setDeleteConfirmId(null)}>
        <TouchableWithoutFeedback onPress={() => setDeleteConfirmId(null)}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{t('assessment.confirmDelete')}</Text>
                <Text style={[s.modalSub, { marginBottom: 20 }]}>{t('assessment.deleteWarning')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setDeleteConfirmId(null)} style={[s.modalBtn, { backgroundColor: C.border }]}>
                    <Text style={[s.modalBtnText, { color: C.text }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteConfirmId && handleDelete(deleteConfirmId)} style={[s.modalBtn, { backgroundColor: C.red }]}>
                    <Text style={[s.modalBtnText, { color: '#fff' }]}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
});
