import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { Student, Assessment, isConduct } from '../utils';
import { calculateSingleStudentRank, calculateSubjectRows } from '../analyticsEngine';

export const LiveCertificate = React.memo(({ 
  student, 
  assessments, 
  marks, 
  allStudents, 
  subjects, 
  settings, 
  C 
}: { 
  student: Student, 
  assessments: Assessment[], 
  marks: any[], 
  allStudents?: Student[], 
  subjects?: any[], 
  settings?: any, 
  C: any 
}) => {
  const { t } = useTranslation();

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

  const getScoreColor = (score: number | string) => {
    const s = parseFloat(String(score));
    if (isNaN(s)) return '#2c1810';
    if (s >= 85) return '#059669'; // Excellent - Dark Green
    if (s >= 70) return '#10b981'; // Good - Bright Green
    if (s >= 50) return '#d97706'; // Satisfactory - Amber
    return '#dc2626';             // Needs Improvement - Red
  };

  const activeSemester = settings?.currentSemester || 'Semester I';

  const rankings = useMemo(() => {
    if (!student || !allStudents || !allStudents.length) return { classRank: '-', overallRank: '-', totalInClass: 0, totalInGrade: 0, stats: { percentage: 0 } };
    return calculateSingleStudentRank(student, allStudents, assessments, marks, activeSemester, subjects || []);
  }, [student?.id, student?.grade, assessments, marks, allStudents, activeSemester, subjects]);

  const { classRank, overallRank, totalInClass, totalInGrade } = rankings;
  const stats = (rankings as any).stats || { percentage: 0 };
  const overallAvg = stats.percentage.toFixed(1);

  const subjectRows = useMemo(() => {
    if (!student) return [];
    return calculateSubjectRows(student, assessments, marks, subjects, activeSemester);
  }, [student?.id, student?.grade, assessments, marks, subjects, activeSemester]);

  if (!student) return null;

  return (
    <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
    >
        <View style={styles.certificateOuter}>
            {/* Border Decorations */}
            <View style={[styles.corner, { top: 12, left: 12, borderTopWidth: 1, borderLeftWidth: 1 }]} />
            <View style={[styles.corner, { top: 12, right: 12, borderTopWidth: 1, borderRightWidth: 1 }]} />
            <View style={[styles.corner, { bottom: 12, left: 12, borderBottomWidth: 1, borderLeftWidth: 1 }]} />
            <View style={[styles.corner, { bottom: 12, right: 12, borderBottomWidth: 1, borderRightWidth: 1 }]} />

            {/* Header */}
            <View style={styles.header}>
                <Image source={require('../assets/logo.png')} style={styles.headerLogo} />
                <View style={styles.headerTextContainer}>
                    <Text style={styles.schoolNameAm}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Text>
                    <Text style={styles.reportSubtitle}>{t('profile.resultDescription', 'Student Academic Progress Report')}</Text>
                </View>
            </View>

            <View style={styles.transcriptBanner}>
                <View style={styles.bannerLine} />
                <Text style={styles.bannerText}>ACADEMIC TRANSCRIPT</Text>
            </View>

            {/* Student Information Section */}
            <View style={styles.studentInfoContainer}>
                <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>ሙሉ ስም / NAME</Text>
                    <Text style={styles.infoName}>{student.name}</Text>
                    {!!(student.baptismalname || (student as any).baptismalName) && (
                        <Text style={styles.infoBaptismal}>የክርስትና ስም: {student.baptismalname || (student as any).baptismalName}</Text>
                    )}
                </View>
                <View style={styles.infoColRight}>
                    <View style={styles.statLine}>
                        <Text style={styles.infoLabel}>ክፍል / GRADE</Text>
                        <Text style={styles.statValue}>{student.grade}</Text>
                    </View>
                    <View style={styles.statLine}>
                        <Text style={styles.infoLabel}>ዓ.ም / YEAR</Text>
                        <Text style={styles.statValue}>{getEthiopianYear(student.academicyear || (student as any).academicYear)}</Text>
                    </View>
                </View>
            </View>

            {/* Table Header */}
            <View style={styles.tableHead}>
                <Text style={[styles.headText, { flex: 2 }]}>የትምህርት አይነት / SUBJECT</Text>
                <Text style={[styles.headText, { flex: 1, textAlign: 'center' }]}>፩ኛ መንፈቀ ዓመት / SEM I</Text>
                <Text style={[styles.headText, { flex: 1, textAlign: 'center' }]}>፪ኛ መንፈቀ ዓመት / SEM II</Text>
                <Text style={[styles.headText, { flex: 1, textAlign: 'center' }]}>አማካይ / AVG</Text>
            </View>

            {/* Table Rows */}
            <View style={styles.tableBody}>
                {subjectRows.length === 0 ? (
                    <Text style={styles.emptyTableText}>No assessments recorded.</Text>
                ) : (
                    subjectRows.map((row, i) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={[styles.rowSubject, { flex: 2 }]} numberOfLines={1}>{row.subject}</Text>
                            <Text style={[styles.rowMark, { flex: 1 }]}>{row.semI}</Text>
                            <Text style={[styles.rowMark, { flex: 1 }]}>{row.semII}</Text>
                            <Text style={[styles.rowAvg, { flex: 1, color: getScoreColor(row.avg) }]}>{row.avg}</Text>
                        </View>
                    ))
                )}
            </View>

            {/* Summary / Totals */}
            <View style={styles.summarySection}>
                <View style={styles.overallRow}>
                    <Text style={styles.overallLabel}>አጠቃላይ ድምር / GRAND TOTAL</Text>
                    <Text style={[styles.overallValue, { color: getScoreColor(overallAvg) }]}>{overallAvg}%</Text>
                </View>

                <View style={styles.rankContainer}>
                    {totalInClass > 0 && (
                        <View style={styles.rankRow}>
                            <Text style={styles.rankLabel}>ክፍል ደረጃ / CLASS RANK</Text>
                            <Text style={styles.rankValue}>{classRank} / {totalInClass}</Text>
                        </View>
                    )}
                    {totalInGrade > 0 && (
                        <View style={styles.rankRow}>
                            <Text style={styles.rankLabel}>አጠቃላይ ደረጃ / GRADE RANK</Text>
                            <Text style={[styles.rankValue, { fontSize: 13 }]}>{overallRank} / {totalInGrade}</Text>
                        </View>
                    )}
                </View>

                {/* Verification Section */}
                <View style={styles.verification}>
                    <QRCode 
                        value={student.id} 
                        size={60} 
                        color="#2c1810" 
                        backgroundColor="#fdfbf7" 
                    />
                    <View style={styles.verifyInfo}>
                        <Text style={styles.verifyTitle}>OFFICIAL RECORD</Text>
                        <Text style={styles.verifySub}>Digitally verified academic transcript. {new Date().toLocaleDateString()}</Text>
                    </View>
                </View>
            </View>
        </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  certificateOuter: {
    width: '100%',
    minHeight: 650,
    backgroundColor: '#fdfbf7',
    padding: 24,
    borderWidth: 1,
    borderColor: '#e8dfce',
    position: 'relative',
    borderRadius: 2,
    ...Platform.select({
      web: {
        maxWidth: 700,
        alignSelf: 'center',
        marginVertical: 20,
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
      },
      default: {
        marginVertical: 10,
      }
    })
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#d4af37',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 14,
  },
  headerLogo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  schoolNameAm: {
    textAlign: 'center',
    color: '#2c1810',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  reportSubtitle: {
    textAlign: 'center',
    color: '#5c4033',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  transcriptBanner: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bannerLine: {
    width: 50,
    height: 1.5,
    backgroundColor: '#d4af37',
    marginBottom: 12,
  },
  bannerText: {
    textAlign: 'center',
    color: '#8b0000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  studentInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#e8dfce',
    paddingBottom: 16,
    marginBottom: 24,
  },
  infoCol: {
    flex: 1,
  },
  infoColRight: {
    alignItems: 'flex-end',
    width: 120,
  },
  infoLabel: {
    fontSize: 9,
    color: '#8c7361',
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoName: {
    fontSize: 18,
    color: '#2c1810',
    fontWeight: '900',
    marginTop: 4,
  },
  infoBaptismal: {
    fontSize: 12,
    color: '#5c4033',
    fontStyle: 'italic',
    marginTop: 4,
    fontWeight: '600',
  },
  statLine: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 16,
    color: '#2c1810',
    fontWeight: '800',
    marginTop: 2,
  },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.4)',
    paddingBottom: 10,
    marginBottom: 10,
  },
  headText: {
    fontSize: 9,
    color: '#8c7361',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tableBody: {
    flex: 1,
    minHeight: 200,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 223, 206, 0.6)',
    alignItems: 'center',
  },
  rowSubject: {
    fontSize: 13,
    color: '#2c1810',
    fontWeight: '700',
  },
  rowMark: {
    textAlign: 'center',
    fontSize: 12,
    color: '#5c4033',
    fontWeight: '600',
  },
  rowAvg: {
    textAlign: 'center',
    fontSize: 13,
    color: '#2c1810',
    fontWeight: '900',
  },
  emptyTableText: {
    textAlign: 'center',
    padding: 32,
    fontStyle: 'italic',
    color: '#8c7361',
    fontSize: 14,
  },
  summarySection: {
    marginTop: 32,
  },
  overallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e8dfce',
    borderBottomWidth: 1,
    borderBottomColor: '#e8dfce',
  },
  overallLabel: {
    fontSize: 11,
    color: '#2c1810',
    fontWeight: '900',
    letterSpacing: 1,
  },
  overallValue: {
    fontSize: 22,
    color: '#8b0000',
    fontWeight: '900',
  },
  rankContainer: {
    marginTop: 12,
    gap: 6,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankLabel: {
    fontSize: 10,
    color: '#5c4033',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rankValue: {
    fontSize: 15,
    color: '#2c1810',
    fontWeight: '900',
  },
  verification: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  verifyInfo: {
    flex: 1,
  },
  verifyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#2c1810',
    letterSpacing: 1.5,
  },
  verifySub: {
    fontSize: 9,
    color: '#8c7361',
    marginTop: 4,
    lineHeight: 14,
    fontWeight: '600',
  },
});
