import React, { useMemo } from 'react';
import { Modal, Descriptions, Card, Table, Tag, Space, Typography, Row, Col, Statistic, Empty, Tabs, Alert, Tooltip, Divider } from 'antd';
import {
    UserOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    MinusCircleOutlined,
    BookOutlined,
    PhoneOutlined,
    WarningOutlined,
    FileProtectOutlined,
    CalendarOutlined,
    PieChartOutlined
} from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EthiopianCross = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
        <rect x="42" y="42" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"/>
        <circle cx="50" cy="50" r="4" fill="currentColor"/>
        
        <path d="M42 42 L42 20 L30 15 L50 0 L70 15 L58 20 L58 42" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="50" cy="8" r="2.5" fill="currentColor"/>
        <circle cx="35" cy="18" r="2" fill="currentColor"/>
        <circle cx="65" cy="18" r="2" fill="currentColor"/>

        <path d="M42 58 L42 80 L30 85 L50 100 L70 85 L58 80 L58 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="50" cy="92" r="2.5" fill="currentColor"/>
        <circle cx="35" cy="82" r="2" fill="currentColor"/>
        <circle cx="65" cy="82" r="2" fill="currentColor"/>

        <path d="M42 42 L20 42 L15 30 L0 50 L15 70 L20 58 L42 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="8" cy="50" r="2.5" fill="currentColor"/>
        <circle cx="18" cy="35" r="2" fill="currentColor"/>
        <circle cx="18" cy="65" r="2" fill="currentColor"/>

        <path d="M58 42 L80 42 L85 30 L100 50 L85 70 L80 58 L58 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="92" cy="50" r="2.5" fill="currentColor"/>
        <circle cx="82" cy="35" r="2" fill="currentColor"/>
        <circle cx="82" cy="65" r="2" fill="currentColor"/>
    </svg>
);

const StudentProfile = ({ studentId, visible, onClose }) => {
    const { t } = useTranslation();

    const student = useLiveQuery(() =>
        studentId ? db.students.get(studentId) : null
        , [studentId]);

    const attendanceRecords = useLiveQuery(() =>
        studentId ? db.attendance.where('studentId').equals(studentId).toArray() : []
        , [studentId]) || [];

    const marks = useLiveQuery(() =>
        studentId ? db.marks.where('studentId').equals(studentId).toArray() : []
        , [studentId]) || [];

    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const allSubjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const settings = useLiveQuery(() => db.settings.toArray()) || [];
    const isLoading = student === undefined || allAssessments === undefined || allSubjects === undefined || allStudents === undefined || allMarks === undefined || settings === undefined;

    const activeSemester = useMemo(() => settings?.find(s => s.key === 'currentSemester')?.value || 'Semester I', [settings]);


    // --- Formatters ---
    const formatGrade = (grade) => {
        if (!grade) return '';
        if (String(grade).includes('ኛ ክፍል') || String(grade).includes('12+')) return grade;
        return `${grade}ኛ ክፍል`;
    };

    // --- Attendance Data ---
    const totalPresent = attendanceRecords?.filter(r => r.status === 'present').length || 0;
    const totalLate = attendanceRecords?.filter(r => r.status === 'late').length || 0;
    const totalAbsent = attendanceRecords?.filter(r => r.status === 'absent').length || 0;
    const totalNoClass = attendanceRecords?.filter(r => r.status === 'no_class').length || 0;

    // Generate Heatmap Data (Last 90 days)
    const heatmapDays = useMemo(() => {
        if (!attendanceRecords) return [];
        const days = [];
        const today = dayjs();
        const attMap = {};
        attendanceRecords.forEach(r => { attMap[r.date] = r.status });

        for (let i = 89; i >= 0; i--) {
            const dateStr = today.subtract(i, 'day').format('YYYY-MM-DD');
            days.push({
                date: dateStr,
                status: attMap[dateStr] || 'none'
            });
        }
        return days;
    }, [attendanceRecords]);

    // --- Academic Data ---
    // Filter assessments relevant only to this student's grade
    const normalizeGrade = (g) => {
        if (!g) return '';
        const match = String(g).match(/(\d+)/);
        return match ? match[1] : g;
    };

    const studentGradeNorm = useMemo(() => normalizeGrade(student?.grade), [student]);
    const gradeAssessments = useMemo(() => {
        if (!allAssessments || !studentGradeNorm) return [];
        return allAssessments.filter(a => normalizeGrade(a.grade) === studentGradeNorm);
    }, [allAssessments, studentGradeNorm]);

    // Map marks to assessments
    const markHistory = useMemo(() => {
        if (!gradeAssessments.length) return [];
        return gradeAssessments.map(assessment => {
            const existingMark = marks?.find(m => m.assessmentId === assessment.id);
            const subject = allSubjects.find(s => s.name === assessment.subjectName);
            return {
                key: assessment.id,
                assessmentId: assessment.id,
                assessmentName: assessment.name || 'Unknown',
                subject: assessment.subjectName || 'Unknown',
                semester: subject?.semester || 'Semester I',
                score: existingMark ? existingMark.score : null,
                maxScore: assessment.maxScore,
                date: assessment.date || existingMark?.assessmentDate || '-',
                percentage: existingMark && assessment.maxScore > 0 ? ((existingMark.score / assessment.maxScore) * 100).toFixed(1) : null,
                hasMark: !!existingMark
            };
        }).sort((a, b) => {
            if (a.date === '-' || b.date === '-') return 0;
            return new Date(b.date) - new Date(a.date);
        });
    }, [gradeAssessments, marks, allSubjects]);

    // Calculate Summary
    const summary = useMemo(() => {
        const missing = markHistory.filter(m => !m.hasMark);
        const completed = markHistory.filter(m => m.hasMark);
        const sem1 = markHistory.filter(m => m.semester === 'Semester I');
        const sem2 = markHistory.filter(m => m.semester === 'Semester II');
        const totalEarned = completed.reduce((acc, curr) => acc + (curr.score || 0), 0);
        const totalMax = completed.reduce((acc, curr) => acc + (parseFloat(curr.maxScore) || 0), 0);
        const avg = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(1) : '0';
        return {
            missingAssessments: missing,
            completedAssessments: completed,
            sem1Marks: sem1,
            sem2Marks: sem2,
            totalEarnedScore: totalEarned,
            totalMaxScore: totalMax,
            averagePercentage: avg
        };
    }, [markHistory]);

    const { 
        missingAssessments, 
        completedAssessments, 
        sem1Marks, 
        sem2Marks, 
        totalEarnedScore, 
        totalMaxScore, 
        averagePercentage 
    } = summary;
    // --- Columns ---
    const markColumns = [
        { title: t('admin.name'), dataIndex: 'assessmentName', key: 'assessmentName', render: t => <Text strong>{t}</Text> },
        { title: t('admin.subjects'), dataIndex: 'subject', key: 'subject' },
        {
            title: t('teacher.score'),
            key: 'score',
            render: (_, r) => r.hasMark ? <Text strong>{r.score} / {r.maxScore}</Text> : <Tag icon={<WarningOutlined />} color="warning">{t('teacher.pending')}</Tag>
        },
        {
            title: '%',
            dataIndex: 'percentage',
            key: 'percentage',
            render: (p) => p ? <Tag color={p >= 50 ? 'green' : 'red'}>{p}%</Tag> : '-'
        },
        { title: t('teacher.date'), dataIndex: 'date', key: 'date', render: t => <Text type="secondary" className="text-xs">{t}</Text> },
    ];

    // --- Sub-components for Tabs ---
    const renderOverview = () => (
        <div className="space-y-6 mt-4">
            <Card className="bg-slate-50 dark:bg-slate-900/50">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Title level={3} style={{ margin: 0 }}>{student?.name}</Title>
                        <Text type="secondary" className="text-lg">{student?.baptismalName || '-'}</Text>
                    </Col>
                    <Col xs={24} sm={12} className="sm:text-right">
                        <Tag color="blue" className="text-lg px-4 py-1.5 mb-2">
                            {formatGrade(student?.grade)}
                        </Tag>
                        <div>
                            <Text type="secondary" className="text-xs uppercase tracking-widest">{t('common.entryDate')}: {student?.academicYear ? dayjs(student.academicYear).format('MMM YYYY') : '-'}</Text>
                        </div>
                    </Col>
                </Row>
            </Card>

            <Descriptions bordered size="small" column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 1, xs: 1 }}>
                <Descriptions.Item label={t('admin.gender')}>{student?.gender === 'Male' ? t('admin.male') : t('admin.female')}</Descriptions.Item>
                <Descriptions.Item label={t('admin.parentContact')}>
                    <Space><PhoneOutlined /> {student?.parentContact}</Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('teacher.totalAssessments')}>{gradeAssessments.length}</Descriptions.Item>
                <Descriptions.Item label={t('teacher.missingMarks')}>
                    {missingAssessments.length > 0 ? <Text type="danger" strong>{missingAssessments.length}</Text> : <Text type="success">0 ({t('teacher.fullyGraded')})</Text>}
                </Descriptions.Item>
            </Descriptions>
        </div>
    );

    const renderAttendance = () => (
        <div className="space-y-6 mt-4 relative">
            <div className="coming-soon-blur pointer-events-none select-none">
                <Title level={5} className="!mb-4"><Space><CalendarOutlined /> {t('teacher.attendanceStreak')}</Space></Title>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap gap-1.5 justify-start">
                        {heatmapDays.map((day, idx) => {
                            let colorClass = "bg-slate-200 dark:bg-slate-800"; // none
                            if (day.status === 'present') colorClass = "bg-green-500 border-green-600";
                            if (day.status === 'late') colorClass = "bg-amber-500 border-amber-600";
                            if (day.status === 'absent') colorClass = "bg-red-500 border-red-600";
                            if (day.status === 'no_class') colorClass = "bg-slate-400 border-slate-500";

                            return (
                                <Tooltip key={idx} title={`${day.date}: ${day.status.toUpperCase()}`}>
                                    <div className={`w-3.5 h-3.5 rounded-sm border ${colorClass} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`} />
                                </Tooltip>
                            );
                        })}
                    </div>
                    <div className="flex gap-4 mt-4 text-xs text-slate-500 justify-end items-center">
                        <span>{t('teacher.less')}</span>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-800"></div>
                            <div className="w-3 h-3 rounded-sm bg-slate-400"></div>
                            <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                            <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
                            <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                        </div>
                        <span>{t('teacher.more')}</span>
                    </div>
                </div>

                <Row gutter={16}>
                    <Col span={6}>
                        <Statistic title={t('teacher.totalPresent')} value={totalPresent} valueStyle={{ color: '#22c55e' }} prefix={<CheckCircleOutlined />} />
                    </Col>
                    <Col span={6}>
                        <Statistic title={t('teacher.totalLate')} value={totalLate} valueStyle={{ color: '#f59e0b' }} prefix={<ClockCircleOutlined />} />
                    </Col>
                    <Col span={6}>
                        <Statistic title={t('teacher.totalAbsent')} value={totalAbsent} valueStyle={{ color: '#ef4444' }} prefix={<CloseCircleOutlined />} />
                    </Col>
                    <Col span={6}>
                        <Statistic title={t('teacher.totalNoClass')} value={totalNoClass} valueStyle={{ color: '#64748b' }} prefix={<MinusCircleOutlined />} />
                    </Col>
                </Row>
            </div>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <Tag color="orange" className="text-sm px-4 py-1.5 shadow-lg border-orange-200 font-bold uppercase tracking-widest">
                    {t('common.comingSoon', 'Coming Soon')}
                </Tag>
                <Text type="secondary" className="mt-2 bg-white/80 dark:bg-slate-900/80 px-4 py-1 rounded-full backdrop-blur-sm text-xs">
                    {t('teacher.attendanceModuleStatus', 'Attendance tracking will be enabled in a future update.')}
                </Text>
            </div>
        </div>
    );

    const renderMarks = () => (
        <div className="space-y-6 mt-4">
            {missingAssessments.length > 0 && (
                <Alert
                    message={t('teacher.missingAssessments')}
                    description={t('teacher.missingAssessmentsDesc', { count: missingAssessments.length })}
                    type="warning"
                    showIcon
                    action={<Tag color="red">{missingAssessments.length} {t('teacher.pending')}</Tag>}
                />
            )}

            <div className="flex justify-between items-end mb-2">
                <Title level={5} className="!mb-0"><Space><PieChartOutlined /> {t('teacher.academicRecord')}</Space></Title>
                <Tag color="purple" className="text-sm px-2 py-1">{t('teacher.overallAvg')}: {averagePercentage}%</Tag>
            </div>

            {sem1Marks.length > 0 && (
                <>
                    <Divider orientation="left" plain className="!mt-0">Semester I</Divider>
                    <Table
                        dataSource={sem1Marks}
                        columns={markColumns}
                        size="small"
                        pagination={false}
                        bordered
                        className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden mb-6"
                    />
                </>
            )}

            {sem2Marks.length > 0 && (
                <>
                    <Divider orientation="left" plain className="!mt-2">Semester II</Divider>
                    <Table
                        dataSource={sem2Marks}
                        columns={markColumns}
                        size="small"
                        pagination={false}
                        bordered
                        className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                    />
                </>
            )}

            {sem1Marks.length === 0 && sem2Marks.length === 0 && (
                <Empty description="No assessments found in this grade." className="my-8" />
            )}
        </div>
    );

    const renderLiveCertificate = () => {
        const subjectsList = [...new Set(gradeAssessments.map(a => a.subjectName))].sort();
        const subjectRows = subjectsList.map(subject => {
            const semIAssessments = gradeAssessments.filter(a => {
                const subjObj = allSubjects.find(s => s.name === a.subjectName);
                return a.subjectName === subject && (subjObj?.semester || 'Semester I') === 'Semester I';
            });
            const semIIAssessments = gradeAssessments.filter(a => {
                const subjObj = allSubjects.find(s => s.name === a.subjectName);
                return a.subjectName === subject && subjObj?.semester === 'Semester II';
            });
            
            const semIEarned = semIAssessments.reduce((acc, a) => {
                const m = marks?.find(mark => mark.assessmentId === a.id);
                return acc + (m ? m.score : 0);
            }, 0);
            const semIMax = semIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
            const semIHasData = semIAssessments.some(a => marks?.find(m => m.assessmentId === a.id));

            const semIIEarned = semIIAssessments.reduce((acc, a) => {
                const m = marks?.find(mark => mark.assessmentId === a.id);
                return acc + (m ? m.score : 0);
            }, 0);
            const semIIMax = semIIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
            const semIIHasData = semIIAssessments.some(a => marks?.find(m => m.assessmentId === a.id));

            let totalMax = 0;
            let totalEarned = 0;

            if (activeSemester === 'Semester I') {
                totalMax = semIMax;
                totalEarned = semIEarned;
            } else {
                 // For Semester II, average the whole year
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

        // Compute real grand total based on visible row max/earned
        let liveTotalMax = 0;
        let liveTotalEarned = 0;
        subjectRows.forEach(row => {
            liveTotalMax += row.rowMax;
            liveTotalEarned += row.rowEarned;
        });

        const overallAvg = liveTotalMax > 0 ? ((liveTotalEarned / liveTotalMax) * 100).toFixed(1) : 0;

        // Rank Calculations
        const calculateRanks = () => {
            if (!student || !allStudents || !allMarks || !allAssessments || !allSubjects) return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };

            // Find all assessments for the student's normalized grade
            const gradeAssesses = allAssessments.filter(a => normalizeGrade(a.grade) === studentGradeNorm);
            if (gradeAssesses.length === 0) return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };
            
            const assessIds = gradeAssesses.map(a => a.id);
            const pertinentMarks = allMarks.filter(m => assessIds.includes(m.assessmentId));

            // Calculate percentage for all students in the same normalized grade
            const studentsInGrade = allStudents.filter(s => normalizeGrade(s.grade) === studentGradeNorm);
            
            const rankings = studentsInGrade.map(s => {
                let sTotalScore = 0;
                let sTotalMax = 0;
                
                gradeAssesses.forEach(a => {
                    const subjObj = allSubjects.find(subj => subj.name === a.subjectName);
                    const isSem1 = (subjObj?.semester || 'Semester I') === 'Semester I';
                    
                    if (activeSemester === 'Semester I') {
                        if (!isSem1) return; // Skip Sem 2 marks from rank calc if we are in Sem I
                    }

                    const mark = pertinentMarks.find(m => m.studentId === s.id && m.assessmentId === a.id);
                    if (mark) sTotalScore += mark.score;
                    sTotalMax += a.maxScore;
                });
                
                const sPercentage = sTotalMax > 0 ? (sTotalScore / sTotalMax) * 100 : 0;
                return { id: s.id, grade: s.grade, percentage: sPercentage, hasData: sTotalMax > 0 };
            }).filter(s => s.hasData); // Only rank students with data

            // Sort by percentage descending
            rankings.sort((a, b) => b.percentage - a.percentage);

            // Overall Grade Rank
            const overallRankIndex = rankings.findIndex(r => r.id === student?.id);
            const overallRank = overallRankIndex !== -1 ? overallRankIndex + 1 : 'N/A';
            const totalInGrade = rankings.length;

            // Class Rank (exact grade match)
            const classRankings = rankings.filter(r => r.grade === student?.grade);
            const classRankIndex = classRankings.findIndex(r => r.id === student?.id);
            const classRank = classRankIndex !== -1 ? classRankIndex + 1 : 'N/A';
            const totalInClass = classRankings.length;

            return { classRank, overallRank, totalInClass, totalInGrade };
        };

        const { classRank, overallRank, totalInClass, totalInGrade } = calculateRanks();

        return (
            <div className="mt-4 flex flex-col items-center bg-slate-100 dark:bg-slate-900 p-8 rounded-lg overflow-auto">
                {/* Minimalist Ethiopian Orthodox Premium Theme */}
                <div className="w-[190mm] min-h-[250mm] bg-[#fdfbf7] p-12 flex flex-col shadow-2xl relative font-serif text-[#2c1810] shrink-0 transform origin-top border border-[#e8dfce]" style={{ transform: 'scale(0.8)', marginBottom: '-10%' }}>
                    
                    {/* Minimalist Corner Accents */}
                    <div className="absolute top-6 left-6 w-8 h-8 border-t border-l border-[#d4af37]" />
                    <div className="absolute top-6 right-6 w-8 h-8 border-t border-r border-[#d4af37]" />
                    <div className="absolute bottom-6 left-6 w-8 h-8 border-b border-l border-[#d4af37]" />
                    <div className="absolute bottom-6 right-6 w-8 h-8 border-b border-r border-[#d4af37]" />

                    {/* Faint Background Emblem */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                        <EthiopianCross className="w-96 h-96 text-[#2c1810]" />
                    </div>

                    {/* Header */}
                    <div className="flex flex-col items-center mb-10 text-center relative z-10">
                        <EthiopianCross className="w-12 h-12 text-[#d4af37] mb-4" />
                        <Title level={3} className="!mb-1 !text-[#2c1810] !font-serif tracking-wide">በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Title>
                        <Text className="text-sm uppercase tracking-[0.2em] text-[#5c4033] font-medium">የተማሪዎች ውጤት መግለጫ</Text>
                        <div className="w-12 h-px bg-[#d4af37] my-5" />
                        <Text className="text-base uppercase tracking-widest text-[#8b0000] font-semibold">{t('teacher.academicTranscript')}</Text>
                    </div>

                    {/* Student Info (Minimalist Grid) */}
                    <div className="w-full flex justify-between items-end border-b border-[#e8dfce] pb-4 mb-10 z-10">
                        <div className="flex flex-col gap-1">
                            <Text className="uppercase text-[10px] tracking-widest text-[#8c7361] font-semibold">ሙሉ ስም / {t('admin.name')}</Text>
                            <Text className="text-xl font-medium text-[#2c1810]">{student?.name}</Text>
                            <Text className="text-sm italic text-[#5c4033]">{student?.baptismalName || 'N/A'}</Text>
                        </div>
                        <div className="flex gap-12 text-right">
                            <div className="flex flex-col gap-1">
                                <Text className="uppercase text-[10px] tracking-widest text-[#8c7361] font-semibold">ክፍል / {t('admin.grade')}</Text>
                                <Text className="text-lg text-[#2c1810]">{studentGradeNorm}</Text>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Text className="uppercase text-[10px] tracking-widest text-[#8c7361] font-semibold">ዓ.ም / Year</Text>
                                <Text className="text-lg text-[#2c1810]">{student?.academicYear ? dayjs(student.academicYear).format('YYYY') : '-'}</Text>
                            </div>
                        </div>
                    </div>

                    {/* Minimalist Data Table */}
                    <div className="w-full mb-12 z-10">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="p-3 text-left font-medium text-[#8c7361] uppercase tracking-wider text-xs border-b border-[#d4af37]/30">የትምህርት አይነት</th>
                                    <th className="p-3 text-center font-medium text-[#8c7361] uppercase tracking-wider text-xs border-b border-[#d4af37]/30">፩ኛ መንፈቀ ዓመት (1st Sem)</th>
                                    <th className="p-3 text-center font-medium text-[#8c7361] uppercase tracking-wider text-xs border-b border-[#d4af37]/30">፪ኛ መንፈቀ ዓመት (2nd Sem)</th>
                                    <th className="p-3 text-center font-medium text-[#8c7361] uppercase tracking-wider text-xs border-b border-[#d4af37]/30">አማካይ ውጤት (Avg)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectRows.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center p-8 italic text-[#8c7361]">No assessments defined</td></tr>
                                ) : (
                                    subjectRows.map((row) => (
                                        <tr key={row.subject} className="group hover:bg-[#faf8f5] transition-colors border-b border-[#e8dfce]/50">
                                            <td className="p-3 text-[#2c1810]">{row.subject}</td>
                                            <td className="p-3 text-center text-[#5c4033]">{row.semI}</td>
                                            <td className="p-3 text-center text-[#5c4033]">{row.semII}</td>
                                            <td className="p-3 text-center font-medium text-[#2c1810]">{row.avg}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td className="p-4 pt-6 text-[#2c1810] uppercase tracking-widest font-semibold text-xs">አጠቃላይ ድምር (Grand Total)</td>
                                    <td colSpan={2}></td>
                                    <td className="p-4 pt-6 text-center text-[#8b0000] font-semibold text-lg">{overallAvg}%</td>
                                </tr>
                                {totalInClass > 0 && (
                                    <tr>
                                        <td className="p-4 pt-2 pb-1 text-[#2c1810] uppercase tracking-widest font-semibold text-xs">ክፍል ደረጃ ({t('teacher.classRank')})</td>
                                        <td colSpan={2}></td>
                                        <td className="p-4 pt-2 pb-1 text-center font-medium text-lg text-[#2c1810]">{classRank} / {totalInClass}</td>
                                    </tr>
                                )}
                                {totalInGrade > 0 && (
                                    <tr>
                                        <td className="p-4 pt-1 text-[#2c1810] uppercase tracking-widest font-semibold text-xs text-opacity-80">ለጠቅላላው ክፍል የተሰጠ ደረጃ ({t('teacher.overallGradeRank')})</td>
                                        <td colSpan={2}></td>
                                        <td className="p-4 pt-1 text-center font-medium text-md text-[#5c4033]">{overallRank} / {totalInGrade}</td>
                                    </tr>
                                )}
                            </tfoot>
                        </table>
                    </div>

                    {/* Status Banners */}
                    {missingAssessments.length > 0 && (
                        <div className="mt-auto border border-[#8b0000]/20 bg-[#8b0000]/5 text-[#8b0000] p-3 text-center text-xs font-semibold uppercase tracking-widest z-10">
                            <WarningOutlined className="mr-2" />
                            {t('teacher.incompleteTranscript', { count: missingAssessments.length })}
                        </div>
                    )}
                    {missingAssessments.length === 0 && gradeAssessments.length > 0 && (
                        <div className="mt-auto border border-[#d4af37]/30 bg-[#d4af37]/5 text-[#5c4033] p-3 text-center text-xs font-semibold uppercase tracking-widest z-10">
                            <FileProtectOutlined className="mr-2 text-[#d4af37]" />
                            {t('teacher.readyForFinal')}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const items = [
        { key: '1', label: <span><UserOutlined /> {t('teacher.overview', 'Overview')}</span>, children: renderOverview() },
        { 
            key: '2', 
            label: (
                <div className="flex items-center gap-2">
                    <span><CalendarOutlined /> {t('teacher.attendance')}</span>
                    <Tag color="orange" className="text-[10px] px-1 py-0 h-fit leading-none m-0">{t('common.comingSoon', 'Soon')}</Tag>
                </div>
            ), 
            children: renderAttendance() 
        },
        { key: '3', label: <span><BookOutlined /> {t('teacher.marksHistory', 'Marks & Tracker')}</span>, children: renderMarks() },
        { key: '4', label: <span><FileProtectOutlined /> {t('teacher.liveCertificate', 'Live Certificate')}</span>, children: renderLiveCertificate() },
    ];

    return (
        <Modal
            title={<Title level={4} style={{ margin: 0 }}>{t('teacher.studentProfile', 'Student Profile')}</Title>}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={850}
            styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
            className="student-profile-modal"
            destroyOnHidden
        >
            <style>{`
                .coming-soon-blur {
                    filter: blur(4px);
                    opacity: 0.5;
                }
            `}</style>
            {(isLoading) ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                    <span>Loading...</span>
                </div>
            ) : !student ? (
                <Empty description={t('teacher.studentNotFound', 'Student not found.')} />
            ) : (
                <Tabs defaultActiveKey="1" items={items} />
            )}
        </Modal>
    );
};

export default StudentProfile;
