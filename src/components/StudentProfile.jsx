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
    const studentGradeNorm = useMemo(() => normalizeGrade(student?.grade), [student]);
    const gradeAssessments = useMemo(() => {
        if (!allAssessments || !studentGradeNorm) return [];
        return allAssessments.filter(a => {
            if (normalizeGrade(a.grade) !== studentGradeNorm) return false;
            return !isConductAssessment(a);
        });
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

    const subjectRows = useMemo(() => {
        return calculateSubjectRows(student, allAssessments, allMarks, allSubjects, activeSemester);
    }, [student, allAssessments, allMarks, allSubjects, activeSemester]);

    const rankingInfo = useMemo(() => {
        return calculateSingleStudentRank(student, allStudents, allAssessments, allMarks, activeSemester, allSubjects);
    }, [student, allStudents, allAssessments, allMarks, activeSemester, allSubjects]);

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
            </Card>

            <Descriptions bordered size="small" column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 1, xs: 1 }}>
                <Descriptions.Item label={t('admin.gender')}>{student?.gender === 'Male' ? t('admin.male') : t('admin.female')}</Descriptions.Item>
                <Descriptions.Item label={t('admin.baptismalName')}>{student?.baptismalName || student?.baptismalname || '—'}</Descriptions.Item>
                <Descriptions.Item label={t('admin.parentContact')}>
                    <Space><PhoneOutlined /> {student?.parentContact || student?.parentcontact || '—'}</Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('teacher.totalAssessments')}>{gradeAssessments.length}</Descriptions.Item>
                <Descriptions.Item label={t('teacher.missingMarks')}>
                    {missingAssessments.length > 0 ? <Text type="danger" strong>{missingAssessments.length}</Text> : <Text type="success">0 ({t('teacher.fullyGraded')})</Text>}
                </Descriptions.Item>
            </Descriptions>
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
                    Feature currently in development
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
        const { classRank, overallRank, totalInClass, totalInGrade } = rankingInfo;

        return (
            <div className="mt-4 flex flex-col items-center bg-slate-100 dark:bg-slate-900 p-8 rounded-lg overflow-auto">
                {/* Certificate Card — matching mobile design with generous spacing */}
                <div className="w-full bg-[#fdfbf7] rounded-2xl shadow-xl border border-[#e8dfce] overflow-hidden font-serif text-[#2c1810]">
                    
                    {/* Header */}
                    <div className="flex flex-col items-center pt-12 pb-6 px-12 text-center">
                        <h2 className="text-2xl font-bold text-[#2c1810] mb-2 tracking-wide" style={{ fontFamily: 'serif' }}>
                            በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት
                        </h2>
                        <p className="text-sm text-[#5c4033] font-semibold tracking-widest uppercase mb-5">
                            የተማሪዎች ውጤት መግለጫ
                        </p>
                        <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mb-5" />
                        <p className="text-base font-extrabold text-[#1a3a6b] tracking-[0.25em] uppercase">
                            ACADEMIC TRANSCRIPT
                        </p>
                    </div>

                    {/* Student Info */}
                    <div className="px-12 pb-10">
                        <div className="flex justify-between items-end border-b border-[#e8dfce] pb-6 mb-10">
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] text-[#8c7361] font-bold uppercase tracking-widest">ሙሉ ስም / NAME</span>
                                <span className="text-2xl font-bold text-[#2c1810] mt-1">{student?.name}</span>
                                {!!(student?.baptismalName || student?.baptismalname) && (
                                    <span className="text-sm italic text-[#5c4033] mt-1">
                                        የክርስትና ስም: {student.baptismalName || student.baptismalname}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-16 text-right">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] text-[#8c7361] font-bold uppercase tracking-widest">ክፍል / GRADE</span>
                                    <span className="text-2xl font-bold text-[#2c1810] mt-1">{student?.grade}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] text-[#8c7361] font-bold uppercase tracking-widest">ዓ.ም / YEAR</span>
                                    <span className="text-2xl font-bold text-[#2c1810] mt-1">
                                        {getEthiopianYear(student?.academicYear || dayjs().toISOString())}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Subjects Table */}
                        <table className="w-full border-collapse text-[15px] mb-8">
                            <thead>
                                <tr className="border-b-2 border-[#d4af37]/30">
                                    <th className="py-3.5 px-4 text-left font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        የትምህርት አይነት / SUBJECT
                                    </th>
                                    <th className="py-3.5 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        ፩ኛ መንፈቅ ዓመት /<br/>SEM I
                                    </th>
                                    <th className="py-3.5 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        ፪ኛ መንፈቅ ዓመት /<br/>SEM II
                                    </th>
                                    <th className="py-3.5 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[11px]">
                                        አማካይ / AVG
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 italic text-[#8c7361] text-base">
                                            No assessments defined
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
                                    አጠቃላይ ድምር / GRAND TOTAL
                                </span>
                                <span className="text-3xl font-black text-[#8b0000]">{averagePercentage}%</span>
                            </div>

                            {totalInClass > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-bold text-[#5c4033] uppercase tracking-widest">
                                        ክፍል ደረጃ / CLASS RANK
                                    </span>
                                    <span className="text-lg font-bold text-[#2c1810]">{classRank} / {totalInClass}</span>
                                </div>
                            )}

                            {totalInGrade > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[12px] font-bold text-[#8c7361] uppercase tracking-widest">
                                        አጠቃላይ ደረጃ / GRADE RANK
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
