import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import dayjs from 'dayjs';
import { supabase } from './supabase';

// ── Grade helpers ──────────────────────────────────────────────
const GRADE_LABELS: Record<string, string> = {
  '1': '1ኛ ክፍል', '2': '2ኛ ክፍል', '3': '3ኛ ክፍል', '4': '4ኛ ክፍል',
  '5': '5ኛ ክፍል', '6': '6ኛ ክፍል', '7': '7ኛ ክፍል', '8': '8ኛ ክፍል',
  '9': '9ኛ ክፍል', '10': '10ኛ ክፍል', '11': '11ኛ ክፍል', '12': '12ኛ ክፍል',
};
const fmtGrade = (g: string | number) => GRADE_LABELS[String(g)] ?? `${g}ኛ ክፍል`;

// ── Types (matching Supabase lowercase column names as seen in screenshot) ──────────
interface Student {
  id: string;
  name: string;
  grade: string;
  baptismalname?: string;
  parentcontact?: string;
  academicyear?: string;
}
interface Assessment {
  id: string;
  name: string;
  subjectname: string;
  grade: string;
  maxscore: number;
  date: string;
}

// ── Colour palette ─────────────────────────────────────────────
const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  accent: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
  text: '#f8fafc',
  muted: '#94a3b8',
  input: '#0f172a',
};

// ═══════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState<'students' | 'attendance' | 'marks'>('students');

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>📚  Senbet Teacher</Text>
        <Text style={s.headerSub}>Unified Student Management</Text>
      </View>

      {/* Content */}
      {tab === 'students' && <StudentsTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'marks' && <MarksTab />}

      {/* Bottom tabs */}
      <View style={s.tabBar}>
        {(['students', 'attendance', 'marks'] as const).map((t) => {
          const active = tab === t;
          const icons = { students: '👥', attendance: '✅', marks: '📝' };
          const labels = { students: 'Students', attendance: 'Attendance', marks: 'Marks' };
          return (
            <TouchableOpacity key={t} style={s.tabItem} onPress={() => setTab(t)}>
              <Text style={[s.tabIcon, active && s.tabIconActive]}>{icons[t]}</Text>
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{labels[t]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STUDENTS TAB
// ═══════════════════════════════════════════════════════════════
function StudentsTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchStudents = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase.from('students').select('*').order('name');
    if (err) {
      setError(err.message);
      Alert.alert('Supabase Error', err.message + '\n\nMake sure your tables exist. Run the SQL schema in the Supabase SQL Editor.');
    } else {
      setStudents(data ?? []);
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await fetchStudents(); setLoading(false); })();
  }, [fetchStudents]);

  const onRefresh = async () => { setRefreshing(true); await fetchStudents(); setRefreshing(false); };

  const filtered = students.filter((st) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return st.name?.toLowerCase().includes(q) || st.id?.toLowerCase().includes(q);
  });

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={s.searchInput}
        placeholder="Search students…"
        placeholderTextColor={C.muted}
        value={search}
        onChangeText={setSearch}
      />

      {error ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: C.red, textAlign: 'center' }}>⚠️ {error}</Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        ListEmptyComponent={
          <Text style={s.empty}>
            {error ? 'Could not connect to Supabase.' : 'No students found. Add students from the Admin Portal, then pull to refresh.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={s.studentCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.studentName}>{item.name}</Text>
              {item.baptismalname ? <Text style={s.studentSub}>{item.baptismalname}</Text> : null}
            </View>
            <View style={s.badge}>
              <Text style={s.badgeText}>{fmtGrade(item.grade)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE TAB  (uses lowercase: studentid)
// ═══════════════════════════════════════════════════════════════
function AttendanceTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [date] = useState(dayjs().format('YYYY-MM-DD'));
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('students').select('*').order('name');
      const list = data ?? [];
      setStudents(list);
      const uniqueGrades = [...new Set(list.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
      setGrades(uniqueGrades);
      if (uniqueGrades.length > 0) setSelectedGrade(uniqueGrades[0]);
      setLoading(false);
    })();
  }, []);

  // Load existing attendance for the selected date
  useEffect(() => {
    if (!selectedGrade) return;
    (async () => {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', date);
      const map: Record<string, string> = {};
      // Column name is "studentid" (lowercase) in Supabase Postgres
      data?.forEach((r: any) => { map[r.studentid] = r.status; });
      setAttendance(map);
    })();
  }, [selectedGrade, date]);

  const gradeStudents = students.filter((st) => String(st.grade) === selectedGrade);

  const toggleStatus = (studentId: string) => {
    const cycle = ['present', 'late', 'absent'];
    const current = attendance[studentId] || 'present';
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    setAttendance((prev) => ({ ...prev, [studentId]: next }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      for (const student of gradeStudents) {
        const status = attendance[student.id] || 'present';

        // Column name is "studentid" (lowercase) 
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('studentid', student.id)
          .eq('date', date)
          .maybeSingle();

        if (existing) {
          await supabase.from('attendance').update({ status }).eq('id', existing.id);
        } else {
          await supabase.from('attendance').insert({
            "studentid": student.id,
            date,
            status,
          });
        }
      }
      Alert.alert('✅ Saved', 'Attendance has been saved to the cloud!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  const statusColor: Record<string, string> = {
    present: C.green,
    late: C.amber,
    absent: C.red,
  };
  const statusEmoji: Record<string, string> = {
    present: '✅',
    late: '⏰',
    absent: '❌',
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <Text style={s.sectionTitle}>📅  {date}</Text>

      {/* Grade selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {grades.map((g) => (
          <TouchableOpacity
            key={g}
            style={[s.gradeChip, selectedGrade === g && s.gradeChipActive]}
            onPress={() => setSelectedGrade(g)}
          >
            <Text style={[s.gradeChipText, selectedGrade === g && s.gradeChipTextActive]}>
              {fmtGrade(g)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Students */}
      {gradeStudents.length === 0 ? (
        <Text style={s.empty}>No students in this grade.</Text>
      ) : (
        gradeStudents.map((student) => {
          const status = attendance[student.id] || 'present';
          return (
            <TouchableOpacity key={student.id} style={s.attendanceRow} onPress={() => toggleStatus(student.id)}>
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>{student.name}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: statusColor[status] + '22', borderColor: statusColor[status] }]}>
                <Text style={{ fontSize: 16 }}>{statusEmoji[status]}</Text>
                <Text style={[s.statusText, { color: statusColor[status] }]}>{status.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {gradeStudents.length > 0 && (
        <TouchableOpacity style={s.saveBtn} onPress={saveAttendance} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>💾  Save Attendance to Cloud</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MARKS TAB  (uses lowercase: studentid, assessmentid, etc.)
// ═══════════════════════════════════════════════════════════════
function MarksTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [studRes, assRes] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        supabase.from('assessments').select('*').order('name'),
      ]);
      const sList = studRes.data ?? [];
      const aList = assRes.data ?? [];
      setStudents(sList);
      setAssessments(aList);
      const uniqueGrades = [...new Set(sList.map((st) => String(st.grade)))].sort((a, b) => Number(a) - Number(b));
      setGrades(uniqueGrades);
      if (uniqueGrades.length > 0) setSelectedGrade(uniqueGrades[0]);
      setLoading(false);
    })();
  }, []);

  const gradeAssessments = assessments.filter((a) => String(a.grade) === selectedGrade);
  const gradeStudents = students.filter((st) => String(st.grade) === selectedGrade);

  // Load existing marks when assessment is selected
  useEffect(() => {
    if (!selectedAssessment) return;
    (async () => {
      const { data } = await supabase
        .from('marks')
        .select('*')
        .eq('assessmentid', selectedAssessment.id);
      const map: Record<string, string> = {};
      data?.forEach((m: any) => { map[m.studentid] = String(m.score); });
      setMarks(map);
    })();
  }, [selectedAssessment]);

  const saveMarks = async () => {
    if (!selectedAssessment) return;
    setSaving(true);
    try {
      for (const student of gradeStudents) {
        const scoreStr = marks[student.id];
        if (!scoreStr || scoreStr === '') continue;
        const score = parseFloat(scoreStr);
        if (isNaN(score)) continue;

        const { data: existing } = await supabase
          .from('marks')
          .select('id')
          .eq('studentid', student.id)
          .eq('assessmentid', selectedAssessment.id)
          .maybeSingle();

        if (existing) {
          await supabase.from('marks').update({ score }).eq('id', existing.id);
        } else {
          await supabase.from('marks').insert({
            "studentid": student.id,
            "assessmentid": selectedAssessment.id,
            score,
            "assessmentdate": selectedAssessment.date,
          });
        }
      }
      Alert.alert('✅ Saved', 'Marks have been saved to the cloud!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      <Text style={s.sectionTitle}>📝  Enter Marks</Text>

      {/* Grade selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {grades.map((g) => (
          <TouchableOpacity
            key={g}
            style={[s.gradeChip, selectedGrade === g && s.gradeChipActive]}
            onPress={() => { setSelectedGrade(g); setSelectedAssessment(null); setMarks({}); }}
          >
            <Text style={[s.gradeChipText, selectedGrade === g && s.gradeChipTextActive]}>
              {fmtGrade(g)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Assessment selector */}
      <Text style={[s.sectionTitle, { fontSize: 14, marginBottom: 8 }]}>Select Assessment:</Text>
      {gradeAssessments.length === 0 ? (
        <Text style={s.empty}>No assessments for this grade yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {gradeAssessments.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[s.gradeChip, selectedAssessment?.id === a.id && s.gradeChipActive]}
              onPress={() => setSelectedAssessment(a)}
            >
              <Text style={[s.gradeChipText, selectedAssessment?.id === a.id && s.gradeChipTextActive]}>
                {a.name} ({a.subjectname})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Mark entry */}
      {selectedAssessment && (
        <>
          <View style={s.maxScoreBar}>
            <Text style={{ color: C.accent, fontWeight: '700' }}>
              Max Score: {selectedAssessment.maxscore}
            </Text>
          </View>

          {gradeStudents.map((student) => (
            <View key={student.id} style={s.markRow}>
              <Text style={[s.studentName, { flex: 1 }]}>{student.name}</Text>
              <TextInput
                style={s.markInput}
                keyboardType="numeric"
                placeholder={`0-${selectedAssessment.maxscore}`}
                placeholderTextColor={C.slate}
                value={marks[student.id] || ''}
                onChangeText={(val) => setMarks((prev) => ({ ...prev, [student.id]: val }))}
              />
            </View>
          ))}

          <TouchableOpacity style={s.saveBtn} onPress={saveMarks} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>💾  Save Marks to Cloud</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 36 : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: C.muted, fontSize: 13, marginTop: 2 },

  tabBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card,
    paddingVertical: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  tabItem: { alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 22, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: C.muted, fontWeight: '600' },
  tabLabelActive: { color: C.accent },

  searchInput: {
    margin: 16, marginBottom: 0, backgroundColor: C.card, color: C.text,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: C.border,
  },

  studentCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  studentName: { color: C.text, fontSize: 16, fontWeight: '600' },
  studentSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: C.accent + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: C.accent, fontSize: 12, fontWeight: '700' },

  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },

  gradeChip: {
    backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: C.border,
  },
  gradeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  gradeChipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  gradeChipTextActive: { color: '#fff' },

  attendanceRow: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  markRow: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  markInput: {
    backgroundColor: C.input, color: C.text, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, width: 100, textAlign: 'right',
    fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: C.border,
  },
  maxScoreBar: {
    backgroundColor: C.accent + '15', borderRadius: 8, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: C.accent + '44',
  },

  saveBtn: {
    backgroundColor: C.accent, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
