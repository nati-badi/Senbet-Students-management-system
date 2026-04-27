import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Descriptions, Card, Table, Tag, Space, Typography, Row, Col, Statistic, Empty, Tabs, Alert, Tooltip, Divider, Select, Skeleton } from 'antd';
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
import { formatEthiopianDate, getEthiopianYear } from '../utils/dateUtils';
import { normalizeGrade } from '../utils/gradeUtils';
import { calculateSingleStudentRank, calculateSubjectRows, isConductAssessment } from '../utils/analyticsEngine';
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
    const [selectedYear, setSelectedYear] = useState(null);

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

    // Set default year when student loads
    useEffect(() => {
        if (student?.academicYear && !selectedYear) {
            setSelectedYear(student.academicYear);
        }
    }, [student, selectedYear]);

    // Discover all years the student has records for
    const availableYears = useMemo(() => {
        // Collect all raw year strings from student and marks
        const rawYears = new Set();
        if (student?.academicYear) rawYears.add(student.academicYear);
        marks.forEach(m => {
            if (m.academicYear) rawYears.add(m.academicYear);
        });

        // Deduplicate by the RESULT of getEthiopianYear to prevent visual duplicates
        const yearMap = new Map();
        rawYears.forEach(y => {
            const etYear = getEthiopianYear(y);
            // Skip invalid or placeholder years
            if (etYear === '—' || !y || String(y).length < 5) return;
            
            // Keep only one raw value per Ethiopian Year label
            if (!yearMap.has(etYear)) {
                yearMap.set(etYear, y);
            }
        });

        // Convert back to array of raw values, sorted by date descending
        return Array.from(yearMap.values()).sort((a, b) => b.localeCompare(a));
    }, [student, marks]);

    const activeYearToUse = useMemo(() => {
        if (selectedYear) return selectedYear;
        // If student year is valid, use it. Otherwise fallback to global current year.
        if (student?.academicYear && getEthiopianYear(student.academicYear) !== '—') {
            return student.academicYear;
        }
        return new Date().toISOString(); // Fallback to current system time
    }, [selectedYear, student?.academicYear]);

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
    const studentGradeNorm = useMemo(() => normalizeGrade(student?.grade), [student]);
    const gradeAssessments = useMemo(() => {
        if (!allAssessments || !studentGradeNorm || !activeYearToUse) return [];
        const targetYearNum = getEthiopianYear(activeYearToUse);

        return allAssessments.filter(a => {
            if (normalizeGrade(a.grade) !== studentGradeNorm) return false;
            
            // Resolve the year of the assessment
            const assessmentYearNum = a.academicYear ? getEthiopianYear(a.academicYear) : null;
            
            // INTUITIVE MATCHING: 
            // 1. If the assessment matches the target year exactly, show it.
            // 2. If the assessment has NO year, it's a template; show it.
            // 3. If we are in the current year (2018) and the assessment is from the legacy baseline (2017),
            //    show it because it serves as the structure for the new year.
            // 4. If we are in a historical view (e.g. looking back at 2017), only show 2017 data.
            
            if (assessmentYearNum === targetYearNum) return true;
            if (!assessmentYearNum) return true;
            
            // Baseline Fallback: 2017 assessments are visible in 2018 as templates
            if (assessmentYearNum === '2017 ዓ.ም' && targetYearNum === '2018 ዓ.ም') return true;

            return false;
            
            return !isConductAssessment(a);
        });
    }, [allAssessments, studentGradeNorm, activeYearToUse]);

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

    const subjectRows = useMemo(() => {
        if (!student || !activeYearToUse || !gradeAssessments.length) return [];
        
        const targetYearNum = getEthiopianYear(activeYearToUse);
        const yearMarks = allMarks.filter(m => {
            const mYearNum = m.academicYear ? getEthiopianYear(m.academicYear) : null;
            // Match exactly OR legacy fallback
            if (mYearNum === targetYearNum) return true;
            if (!mYearNum) return true;
            if (mYearNum === '2017 ዓ.ም' && targetYearNum === '2018 ዓ.ም') return true;
            return false;
        });
        
        return calculateSubjectRows(student, gradeAssessments, yearMarks, allSubjects, activeSemester);
    }, [student, gradeAssessments, allMarks, allSubjects, activeSemester, activeYearToUse]);

    const rankingInfo = useMemo(() => {
        if (!student || !activeYearToUse || !gradeAssessments.length) {
            return { classRank: '—', overallRank: '—', totalInClass: 0, totalInGrade: 0 };
        }

        const targetYearNum = getEthiopianYear(activeYearToUse);
        const yearMarks = allMarks.filter(m => {
            const mYearNum = m.academicYear ? getEthiopianYear(m.academicYear) : null;
            if (mYearNum === targetYearNum) return true;
            if (!mYearNum) return true;
            if (mYearNum === '2017 ዓ.ም' && targetYearNum === '2018 ዓ.ም') return true;
            return false;
        });
        
        return calculateSingleStudentRank(student, allStudents, gradeAssessments, yearMarks, activeSemester, allSubjects);
    }, [student, allStudents, gradeAssessments, allMarks, activeSemester, allSubjects, activeYearToUse]);

    const academicStats = useMemo(() => {
        const stats = rankingInfo.stats || { totalScore: 0, totalMax: 0, percentage: 0 };
        const avg = stats.percentage.toFixed(1);
        
        return {
            totalEarnedScore: stats.totalScore,
            totalMaxScore: stats.totalMax,
            averagePercentage: avg,
            overallAvg: avg
        };
    }, [rankingInfo.stats]);

    const { 
        totalEarnedScore, 
        totalMaxScore, 
        averagePercentage,
        overallAvg 
    } = academicStats;

    const summary = useMemo(() => {
        const missing = markHistory.filter(m => !m.hasMark);
        const completed = markHistory.filter(m => m.hasMark);
        const sem1 = markHistory.filter(m => m.semester === 'Semester I');
        const sem2 = markHistory.filter(m => m.semester === 'Semester II');
        
        return {
            missingAssessments: missing,
            completedAssessments: completed,
            sem1Marks: sem1,
            sem2Marks: sem2
        };
    }, [markHistory]);

    const { 
        missingAssessments, 
        completedAssessments, 
        sem1Marks, 
        sem2Marks
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
        { title: t('teacher.date'), dataIndex: 'date', key: 'date', render: t => <Text type="secondary" className="text-xs">{formatEthiopianDate(t, true)}</Text> },
    ];

    // --- Sub-components for Tabs ---
    const renderOverview = () => (
        <div className="space-y-6 mt-4">
            <Card className="bg-slate-50 dark:bg-slate-900/50">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Title level={3} style={{ margin: 0 }}>{student?.name}</Title>
                        <Text type="secondary" className="text-lg">{student?.baptismalName || student?.baptismalname || '-'}</Text>
                    </Col>
                    <Col xs={24} sm={12} className="sm:text-right">
                        <Tag color="blue" className="text-lg px-4 py-1.5 mb-2">
                            {formatGrade(student?.grade)}
                        </Tag>
                        <div>
                            <Text type="secondary" className="text-xs uppercase tracking-widest">{t('common.entryDate')}: {formatEthiopianDate(student?.academicYear)}</Text>
                        </div>
                    </Col>
                </Row>
                {availableYears.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
                        <Text strong className="text-xs text-slate-500 uppercase tracking-wider">{t('teacher.viewRecordsForYear')}:</Text>
                        <Select 
                            value={activeYearToUse} 
                            onChange={setSelectedYear} 
                            className="w-44"
                            options={availableYears.map(y => {
                                const etYear = getEthiopianYear(y);
                                return { 
                                    value: y, 
                                    label: `📅 ${etYear} ${t('teacher.yearLabel')}` 
                                };
                            }).filter(o => o.label && !o.label.includes('—'))}
                        />
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                    <Text type="secondary" className="text-[11px] uppercase tracking-wider mb-1">{t('admin.gender')}</Text>
                    <Text className="text-sm font-medium">{student?.gender === 'Male' ? t('admin.male') : t('admin.female')}</Text>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                    <Text type="secondary" className="text-[11px] uppercase tracking-wider mb-1">{t('admin.baptismalName')}</Text>
                    <Text className="text-sm font-medium">{student?.baptismalName || student?.baptismalname || '—'}</Text>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                    <Text type="secondary" className="text-[11px] uppercase tracking-wider mb-1">{t('admin.parentContact')}</Text>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                        <PhoneOutlined className="text-blue-500" /> {student?.parentContact || student?.parentcontact || '—'}
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                    <Text type="secondary" className="text-[11px] uppercase tracking-wider mb-1">{t('teacher.totalAssessments')}</Text>
                    <Text className="text-xl font-bold text-slate-700 dark:text-slate-300">{gradeAssessments.length}</Text>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center md:col-span-4">
                    <Text type="secondary" className="text-[11px] uppercase tracking-wider mb-2">{t('teacher.missingMarks')}</Text>
                    <div>
                        {missingAssessments.length > 0 ? (
                            <Tag color="red" className="text-sm px-3 py-1 rounded-full"><WarningOutlined className="mr-1"/> {missingAssessments.length} {t('teacher.pending')}</Tag>
                        ) : (
                            <Tag color="green" className="text-sm px-3 py-1 rounded-full"><CheckCircleOutlined className="mr-1"/> {t('teacher.fullyGraded')}</Tag>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAttendance = () => (
        <div className="space-y-6 mt-4 coming-soon-blur-container">
            {/* Content to be blurred */}
            <div className="coming-soon-content-blur">
                <Title level={5} className="!mb-4"><Space><CalendarOutlined /> {t('teacher.attendanceStreak')}</Space></Title>

                <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
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
            
            {/* Standardized "Coming Soon" Overlay */}
            <div className="coming-soon-overlay">
                <div className="coming-soon-badge">
                    {t('common.comingSoon', 'Coming Soon')}
                </div>
                <div className="coming-soon-text">
                    {t('teacher.attendanceModuleStatus', 'Attendance tracking will be enabled in a future update.')}
                </div>
                <div className="mt-2 text-slate-500 dark:text-slate-400 text-xs font-medium italic">
                    {t('teacher.devFeatureStatus')}
                </div>
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
                    <Divider orientation="left" plain className="!mt-0">{t('teacher.semesterI')}</Divider>
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
                    <Divider orientation="left" plain className="!mt-2">{t('teacher.semesterII')}</Divider>
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
                <Empty description={t('teacher.noMarksInGrade')} className="my-8" />
            )}
        </div>
    );

    const renderLiveCertificate = () => {
        const { classRank, overallRank, totalInClass, totalInGrade } = rankingInfo;

        return (
            <div className="mt-4 flex flex-col items-center bg-slate-100 dark:bg-slate-900 p-8 rounded-lg overflow-auto">
                {/* Certificate Card — matching mobile design with generous spacing */}
                <div className="w-full bg-[#fdfbf7] rounded-2xl shadow-xl border border-[#e8dfce] overflow-hidden font-serif text-[#2c1810]">
                    
                    {/* Header */}
                    <div className="flex flex-col items-center pt-12 pb-6 px-12 text-center">
                        <h2 className="text-2xl font-bold text-[#2c1810] mb-2 tracking-wide" style={{ fontFamily: 'serif' }}>
                            {t('app.title')}
                        </h2>
                        <p className="text-sm text-[#5c4033] font-semibold tracking-widest uppercase mb-5">
                            {t('teacher.transcriptSubtitle')}
                        </p>
                        <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mb-5" />
                        <p className="text-base font-extrabold text-[#1a3a6b] tracking-[0.25em] uppercase">
                            {t('teacher.academicTranscript')}
                        </p>
                    </div>

                    {/* Student Info */}
                    <div className="px-12 pb-10">
                        <div className="flex justify-between items-end border-b border-[#e8dfce] pb-6 mb-10">
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] text-[#8c7361] font-bold uppercase tracking-widest">{t('teacher.fullNameLabel')} / NAME</span>
                                <span className="text-2xl font-bold text-[#2c1810] mt-1">{student?.name}</span>
                                {!!(student?.baptismalName || student?.baptismalname) && (
                                    <span className="text-sm italic text-[#5c4033] mt-1">
                                        {t('teacher.baptismalNameLabel')}: {student.baptismalName || student.baptismalname}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-16 text-right">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] text-[#8c7361] font-bold uppercase tracking-widest">{t('teacher.gradeLabel')} / GRADE</span>
                                    <span className="text-2xl font-bold text-[#2c1810] mt-1">{student?.grade}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] text-[#8c7361] font-bold uppercase tracking-widest">{t('teacher.yearLabel')} / YEAR</span>
                                    <span className="text-2xl font-bold text-[#2c1810] mt-1">
                                        {getEthiopianYear(activeYearToUse || dayjs().toISOString())}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Subjects Table */}
                        <table className="w-full border-collapse text-[15px] mb-8">
                            <thead>
                                <tr className="border-b-2 border-[#d4af37]/30">
                                    <th className="py-3.5 px-4 text-left font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        {t('teacher.subjectLabel')} / SUBJECT
                                    </th>
                                    <th className="py-3.5 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        {t('teacher.semesterI')} /<br/>SEM I
                                    </th>
                                    <th className="py-3.5 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        {t('teacher.semesterII')} /<br/>SEM II
                                    </th>
                                    <th className="py-3.5 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        {t('teacher.avg')} / AVG
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 italic text-[#8c7361] text-base">
                                            {t('teacher.noAssessmentsDefined')}
                                        </td>
                                    </tr>
                                ) : (
                                    subjectRows.map((row) => (
                                        <tr key={row.subject} className="border-b border-[#e8dfce]/60 hover:bg-[#faf8f3] transition-colors">
                                            <td className="py-3.5 px-4 text-[#2c1810] font-medium">{row.subject}</td>
                                            <td className="py-3.5 px-4 text-center text-[#5c4033]">{row.semI}</td>
                                            <td className="py-3.5 px-4 text-center text-[#5c4033]">{row.semII}</td>
                                            <td className="py-3.5 px-4 text-center font-semibold text-[#2c1810]">{row.avg}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Grand Total & Ranks */}
                        <div className="border-t-2 border-[#d4af37]/30 pt-6 mt-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-[#2c1810] uppercase tracking-widest">
                                    {t('teacher.grandTotal')} / GRAND TOTAL
                                </span>
                                <span className="text-3xl font-black text-[#8b0000]">{averagePercentage}%</span>
                            </div>

                            {totalInClass > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-bold text-[#5c4033] uppercase tracking-widest">
                                        {t('teacher.classRank')} / CLASS RANK
                                    </span>
                                    <span className="text-lg font-bold text-[#2c1810]">{classRank} / {totalInClass}</span>
                                </div>
                            )}

                            {totalInGrade > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-bold text-[#8c7361] uppercase tracking-widest">
                                        {t('teacher.gradeRank')} / GRADE RANK
                                    </span>
                                    <span className="text-base font-bold text-[#5c4033]">{overallRank} / {totalInGrade}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status Banner */}
                    {missingAssessments.length > 0 && (
                        <div className="border-t border-[#8b0000]/20 bg-[#8b0000]/5 text-[#8b0000] py-3 text-center text-xs font-semibold uppercase tracking-widest">
                            <WarningOutlined className="mr-2" />
                            {t('teacher.incompleteTranscript', { count: missingAssessments.length })}
                        </div>
                    )}
                    {missingAssessments.length === 0 && gradeAssessments.length > 0 && (
                        <div className="border-t border-[#d4af37]/30 bg-[#d4af37]/5 text-[#5c4033] py-3 text-center text-xs font-semibold uppercase tracking-widest">
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
                <div className="flex items-center gap-2 opacity-60 filter blur-[0.5px]">
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
                <div className="p-8">
                    <Skeleton active avatar paragraph={{ rows: 4 }} />
                    <Skeleton active className="mt-6" paragraph={{ rows: 2 }} />
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
