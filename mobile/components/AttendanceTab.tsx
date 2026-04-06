import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, Clock } from 'lucide-react-native';
import dayjs from 'dayjs';
import { useCameraPermissions } from 'expo-camera';
import { formatEthiopianDate } from '../dateUtils';
import { supabase } from '../supabase';
import { Student, Teacher, normG, fmtGrade, generateUUID } from '../utils';

export const AttendanceTab = React.memo(({ route, navigation, teacher, students: allStudents, attendanceData, setAttendanceData, onRefresh, C, s, showToast, settings }: {
  route: any, navigation: any, teacher: Teacher, students: Student[], attendanceData: any[], setAttendanceData: (data: any[]) => void, onRefresh: () => void, C: any, s: any, showToast?: (msg: string, type: 'success'|'error'|'info') => void, settings: any
}) => {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  
  const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
  const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
  const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];
  
  const students = useMemo(() => 
    allStudents.filter(st => !hasTeacherAssignedGrades || myGrades.includes(normG(st.grade)) || myGrades.includes(st.grade)),
    [allStudents, hasTeacherAssignedGrades, myGrades]
  );

  const [selectedGrade, setSelectedGrade] = useState('');
  const [date] = useState(dayjs().format('YYYY-MM-DD'));
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [attendanceIds, setAttendanceIds] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const etDate = formatEthiopianDate(new Date());

  const grades = useMemo(() => {
    return [...new Set(students.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
  }, [students]);

  useEffect(() => {
    if (!selectedGrade && grades.length > 0) setSelectedGrade(grades[0]);
  }, [grades, selectedGrade]);

  useEffect(() => {
    if (!selectedGrade) return;
    (async () => {
      try {
        const { data } = await supabase.from('attendance').select('*').eq('date', date);
        const map: Record<string, string> = {};
        const idMap: Record<string, string> = {};
        data?.forEach((r: any) => { 
          map[r.studentid] = r.status;
          idMap[r.studentid] = r.id;
        });
        setAttendance(map);
        setAttendanceIds(idMap);
      } catch (e) {
        console.error('Attendance fetch error', e);
      }
    })();
  }, [selectedGrade, date]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={{ flex: 1, opacity: 0.5 }}>
        <View style={{ padding: 16, paddingBottom: 0, opacity: 0.6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={[s.sectionTitle, { marginBottom: 4 }]}>{t('teacher.attendance')}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{etDate}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {grades.map(g => (
              <View key={g} style={[s.gradeChip]}><Text style={[s.gradeChipText]}>{fmtGrade(g)}</Text></View>
            ))}
          </ScrollView>

          <View style={[s.searchInput, { margin: 0, marginBottom: 16, opacity: 0.5 }]}>
            <Text style={{ color: C.muted }}>{t('common.searchStudents')}</Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
           <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: C.accent + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
              <CalendarCheck size={48} color={C.accent} />
           </View>
           <Text style={{ color: C.text, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>{t('common.comingSoon')}</Text>
           <Text style={{ color: C.muted, textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 22 }}>
             {t('common.underDevelopment')}
           </Text>
           <View style={{ marginTop: 32, backgroundColor: C.amber + '20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
             <Text style={{ color: C.amber, fontWeight: '900', fontSize: 12 }}>{t('common.underMaintenance')}</Text>
           </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
});
