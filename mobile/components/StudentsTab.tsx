import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react-native';
import { Student, Teacher, normG, fmtGrade, paginate } from '../utils';

export const StudentsTab = React.memo(({ teacher, students: allStudents, onRefresh, C, s, onStudentPress }: {
  teacher: Teacher, students: Student[], onRefresh: () => Promise<void>, C: any, s: any, onStudentPress: (s: Student) => void
}) => {
  const { t } = useTranslation();
  
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];
  
  const students = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');

  const grades = useMemo(() => {
    return [...new Set(students.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
  }, [students]);

  useEffect(() => {
    if (!selectedGrade && grades.length > 0) setSelectedGrade(grades[0]);
  }, [grades, selectedGrade]);

  const [page, setPage] = useState(0);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    await onRefresh();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const gradeFiltered = students.filter(st => !selectedGrade || normG(st.grade) === normG(selectedGrade));
    return gradeFiltered.filter((st) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return st.name?.toLowerCase().includes(q) || st.id?.toLowerCase().includes(q);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [students, selectedGrade, search]);

  const renderItem = ({ item }: { item: Student }) => (
    <TouchableOpacity style={[s.studentCard, { padding: 12, borderRadius: 16 }]} onPress={() => onStudentPress(item)}>
      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
        <Text style={{ fontSize: 20 }}>👤</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.studentName, { fontSize: 15 }]}>{item.name}</Text>
        {item.baptismalname ? <Text style={[s.studentSub, { fontSize: 12 }]}>{item.baptismalname}</Text> : null}
      </View>
      <View style={[s.badge, { borderRadius: 10 }]}>
        <Text style={[s.badgeText, { fontSize: 11 }]}>{fmtGrade(item.grade)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {grades.map((g) => (
            <TouchableOpacity
              key={g}
              style={[s.gradeChip, selectedGrade === g && s.gradeChipActive]}
              onPress={() => setSelectedGrade(g)}
            >
              <Text style={[s.gradeChipText, selectedGrade === g && s.gradeChipTextActive]}>{fmtGrade(g)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={[s.searchInput, { margin: 0 }]}
          placeholder={t('common.searchStudents')}
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={paginate(filtered, page)}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Users size={48} color={C.border} />
            <Text style={[s.empty, { marginTop: 12 }]}>{t('common.noStudentsFound')}</Text>
          </View>
        }
        renderItem={renderItem}
        onEndReached={() => setPage(p => p + 1)}
        onEndReachedThreshold={0.5}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
});
