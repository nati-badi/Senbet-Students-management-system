import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import { TrendingUp, BarChart3, Filter } from "lucide-react-native";
import {
  Student,
  Assessment,
  Teacher,
  normG,
  normS,
  isConduct,
  fmtGrade,
} from "../utils";
import { computeEthiopianYear } from "../dateUtils";
import { calculateRankings, calculateGroupAverage } from "../analyticsEngine";
import { PremiumDropdown } from "./PremiumDropdown";

export const AnalyticsTab = React.memo(
  ({
    teacher,
    students: allStudents,
    assessments: allAssessments,
    marks,
    C,
    s,
    onRefresh,
    settings,
    subjects,
  }: {
    teacher: Teacher;
    students: Student[];
    assessments: Assessment[];
    marks: any[];
    C: any;
    s: any;
    onRefresh?: () => Promise<void> | void;
    settings: any;
    subjects: any[];
  }) => {
    const { t } = useTranslation();
    const assignedGradesRaw = (teacher as any)?.assignedgrades ?? (teacher as any)?.assignedGrades;
    const hasTeacherAssignedGrades = Array.isArray(assignedGradesRaw) && assignedGradesRaw.length > 0;
    const myGrades = hasTeacherAssignedGrades ? assignedGradesRaw : [];

    const etYear = computeEthiopianYear();
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters
    const [selectedGrade, setSelectedGrade] = useState<string>(() => {
      return hasTeacherAssignedGrades ? String(myGrades[0]) : 'All';
    });
    const [selectedSemester, setSelectedSemester] = useState<string>(settings.currentSemester || "Semester I");
    const [selectedSubject, setSelectedSubject] = useState<string>("All");

    const handleRefresh = async () => {
      setRefreshing(true);
      if (onRefresh) await onRefresh();
      setRefreshing(false);
    };

    const students = useMemo(
      () =>
        allStudents.filter(
          (st) => {
            const isMatchGrade = selectedGrade === 'All' || normG(st.grade) === normG(selectedGrade);
            return isMatchGrade && (!hasTeacherAssignedGrades || myGrades.some(mg => normG(mg) === normG(st.grade)));
          }
        ),
      [allStudents, hasTeacherAssignedGrades, myGrades, selectedGrade],
    );

    const semesterAssessments = useMemo(
      () =>
        allAssessments.filter((a) => {
          const assessmentSubjectName = a.subjectname || (a as any).subjectName;
          const assessmentGradeNorm = normG(a.grade);
          
          const isGradeMatch = selectedGrade === 'All' || assessmentGradeNorm === normG(selectedGrade);
          const isTeacherMatch = !hasTeacherAssignedGrades || myGrades.some(mg => normG(mg) === assessmentGradeNorm);

          if (!isGradeMatch || !isTeacherMatch || isConduct(a)) return false;

          const isSubjectMatch = selectedSubject === 'All' || normS(assessmentSubjectName) === normS(selectedSubject);
          if (!isSubjectMatch) return false;

          const subject = subjects.find(
            (sub) => normS(sub.name) === normS(assessmentSubjectName),
          );
          const subjSem = subject?.semester || "Semester I";

          if (selectedSemester === "Semester I") {
            return subjSem === "Semester I";
          }
          // Semester II is cumulative
          return true;
        }),
      [
        allAssessments,
        myGrades,
        subjects,
        selectedSemester,
        selectedGrade,
        selectedSubject,
        hasTeacherAssignedGrades,
      ],
    );

    // Derived filters
    const gradeOptions = useMemo(() => {
        const base = hasTeacherAssignedGrades ? myGrades : [...new Set(allStudents.map(s => s.grade))];
        return base.map(g => ({ key: String(g), label: fmtGrade(g) }));
    }, [hasTeacherAssignedGrades, myGrades, allStudents]);

    const subjectOptions = useMemo(() => {
        const filteredSubs = subjects.filter(s => s.semester === selectedSemester);
        const uniqueNames = [...new Set(filteredSubs.map(s => s.name))];
        return [
            { key: 'All', label: t('admin.allSubjects', 'All Subjects') },
            ...uniqueNames.map(n => ({ key: n, label: n }))
        ];
    }, [subjects, selectedSemester, t]);

    const semesterOptions = useMemo(() => [
        { key: 'Semester I', label: t('admin.semester1') },
        { key: 'Semester II', label: t('admin.semester2') }
    ], [t]);

    const studentStats = useMemo(() => {
      // Only include students visible to this teacher
      // And use centralized ranking logic
      const rankings = calculateRankings(students, semesterAssessments, marks);

      // Map to the format expected by the existing UI
      return rankings.map((r) => ({
        name: r.name,
        perc: r.percentage,
        totalScore: r.totalScore,
        totalMax: r.totalMax,
        count: r.totalMax, // This wasn't strictly used as count in the UI, mostly for existence
        maxPoss: r.totalMax,
      }));
    }, [students, semesterAssessments, marks]);

    const schoolAverage = useMemo(
      () => calculateGroupAverage(studentStats),
      [studentStats],
    );

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.accent}
          />
        }
      >
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Filter size={14} color={C.accent} style={{ marginRight: 6 }} />
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '800' }}>{t('common.filters')}</Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1.2 }}>
              <PremiumDropdown 
                label={t('admin.grade')} 
                placeholder={t('admin.selectGrade')} 
                items={gradeOptions} 
                selectedKey={selectedGrade} 
                onSelect={setSelectedGrade} 
                C={C} s={s} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <PremiumDropdown 
                label={t('admin.semester')} 
                placeholder={t('admin.selectSemester')} 
                items={semesterOptions} 
                selectedKey={selectedSemester} 
                onSelect={setSelectedSemester} 
                C={C} s={s} 
              />
            </View>
          </View>
          
          <PremiumDropdown 
            label={t('admin.subject')} 
            placeholder={t('admin.allSubjects')} 
            items={subjectOptions} 
            selectedKey={selectedSubject} 
            onSelect={setSelectedSubject} 
            C={C} s={s} 
          />
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: C.accent + '10', padding: 8, borderRadius: 12 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700" }}>
              📅 {etYear} E.C. • {selectedSemester === 'Semester I' ? t('admin.semester1') : t('admin.semester2')} • {selectedGrade === 'All' ? t('admin.overall') : fmtGrade(selectedGrade)}
            </Text>
          </View>
        </View>

        <View style={[s.dashboardCard, { borderRadius: 24, padding: 20 }]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <TrendingUp size={20} color={C.green} stroke={C.green} />
            <Text
              style={{
                color: C.text,
                fontSize: 17,
                fontWeight: "800",
                marginLeft: 8,
              }}
            >
              {t("teacher.topPerformers")}
            </Text>
          </View>
          <Text
            style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}
          >{`${t('admin.average')}: ${studentStats.length ? schoolAverage.toFixed(1) : 0}%`}</Text>
          {studentStats.slice(0, 5).map((st, i) => {
            const rank = 1 + studentStats.filter(s => s.perc > st.perc).length;
            return (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: i < Math.min(4, studentStats.length - 1) ? 1 : 0,
                borderBottomColor: C.border,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: C.accent + "15",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Text
                  style={{ color: C.accent, fontWeight: "900", fontSize: 12 }}
                >
                  {rank}
                </Text>
              </View>
              <Text
                style={{
                  color: C.text,
                  fontSize: 15,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {st.name}
              </Text>
              <Text style={{ color: st.perc >= 75 ? C.green : st.perc >= 50 ? C.amber : C.red, fontWeight: "900", fontSize: 15 }}>
                {st.perc.toFixed(1)}%
              </Text>
            </View>
            );
          })}
          {studentStats.length === 0 && (
            <Text style={[s.empty, { marginTop: 20 }]}>
              {t("teacher.noPerfData")}
            </Text>
          )}
        </View>

        <View
          style={[
            s.dashboardCard,
            { borderRadius: 24, padding: 20, marginTop: 20 },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <BarChart3 size={20} color={C.accent} stroke={C.accent} />
            <Text
              style={{
                color: C.text,
                fontSize: 17,
                fontWeight: "800",
                marginLeft: 8,
              }}
            >
              {t("teacher.classTrend")}
            </Text>
          </View>
          {semesterAssessments.slice(0, 5).map((ass, i) => {
            const aMarks = marks.filter(
              (m) => (m.assessmentid || m.assessmentId) === ass.id,
            );
            const total = aMarks.reduce(
              (acc, m) => acc + (Number(m.score) || 0),
              0,
            );

            const avgPerc =
              aMarks.length > 0 && ass.maxscore > 0
                ? (total / (aMarks.length * ass.maxscore)) * 100
                : 0;
            return (
              <View key={i} style={{ marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{ color: C.text, fontSize: 14, fontWeight: "600" }}
                  >
                    {ass.name}
                  </Text>
                  <Text style={{ color: avgPerc >= 75 ? C.green : avgPerc >= 50 ? C.amber : C.red, fontWeight: "800" }}>
                    {avgPerc.toFixed(1)}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: C.border,
                    borderRadius: 3,
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      backgroundColor: avgPerc >= 75 ? C.green : avgPerc >= 50 ? C.amber : C.red,
                      borderRadius: 3,
                      width: `${Math.max(avgPerc, 2)}%`,
                    }}
                  />
                </View>
              </View>
            );
          })}
          {semesterAssessments.length === 0 && (
            <Text style={[s.empty, { marginTop: 20 }]}>
              {t("teacher.noAssData")}
            </Text>
          )}
        </View>
      </ScrollView>
    );
  },
);
