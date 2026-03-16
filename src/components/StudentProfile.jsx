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
    const isLoading = student === undefined || allAssessments === undefined || allSubjects === undefined;


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
        <div className="space-y-6 mt-4">
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
        const subjects = [...new Set(gradeAssessments.map(a => a.subjectName))].sort();
        const subjectRows = subjects.map(subject => {
            const semIEntry = markHistory.find(m => m.subject === subject && m.semester === 'Semester I');
            const semIIEntry = markHistory.find(m => m.subject === subject && m.semester === 'Semester II');
            
            const semIEarned = semIEntry?.hasMark ? semIEntry.score : 0;
            const semIMax = semIEntry ? semIEntry.maxScore : 0;
            const semIHasData = semIEntry?.hasMark;

            const semIIEarned = semIIEntry?.hasMark ? semIIEntry.score : 0;
            const semIIMax = semIIEntry ? semIIEntry.maxScore : 0;
            const semIIHasData = semIIEntry?.hasMark;

            const totalMax = semIMax + semIIMax;
            const totalEarned = semIEarned + semIIEarned;
            const avgPct = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(0) : '-';

            return {
                subject,
                semI: semIHasData ? `${semIEarned} / ${semIMax}` : (semIEntry ? '—' : 'N/A'),
                semII: semIIHasData ? `${semIIEarned} / ${semIIMax}` : (semIIEntry ? '—' : 'N/A'),
                avg: avgPct !== '-' ? `${avgPct}%` : '—',
            };
        });

        const overallAvg = totalMaxScore > 0 ? (totalEarnedScore / totalMaxScore * 100).toFixed(1) : 0;

        return (
            <div className="mt-4 flex flex-col items-center bg-slate-100 dark:bg-slate-900 p-8 rounded-lg overflow-auto">
                <div className="w-[190mm] min-h-[250mm] bg-white border-[12px] border-double border-slate-900 p-12 flex flex-col shadow-2xl relative font-serif text-slate-900 shrink-0 transform origin-top" style={{ transform: 'scale(0.8)', marginBottom: '-10%' }}>
                    {/* Corner Decorations */}
                    <div className="absolute top-4 left-4 border-t-4 border-l-4 border-slate-900 w-12 h-12" />
                    <div className="absolute top-4 right-4 border-t-4 border-r-4 border-slate-900 w-12 h-12" />
                    <div className="absolute bottom-4 left-4 border-b-4 border-l-4 border-slate-900 w-12 h-12" />
                    <div className="absolute bottom-4 right-4 border-b-4 border-r-4 border-slate-900 w-12 h-12" />

                    <div className="flex flex-col items-center mb-8 text-center">
                        <Title level={3} className="!mb-0 !text-slate-900 italic font-serif">{t('teacher.academicTranscript')}</Title>
                        <Text className="text-lg uppercase tracking-widest font-bold">{t('teacher.academicTranscript')}</Text>
                        <div className="w-32 h-1 bg-slate-900 my-4" />
                    </div>

                    <div className="border-b-2 border-slate-900 w-full text-center pb-2 mb-8">
                        <Title level={2} className="!mb-0 text-slate-900">{student?.name}</Title>
                        <Text className="text-md uppercase font-bold text-slate-500">{student?.baptismalName || 'N/A'} • {formatGrade(student?.grade)}</Text>
                    </div>

                    {/* Score Breakdown Table internally */}
                    <div className="w-full mb-8">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-slate-900 text-white">
                                    <th className="p-2 text-left border border-slate-900">{t('admin.subjects')}</th>
                                    <th className="p-2 text-center border border-slate-900">{t('common.semester')} I</th>
                                    <th className="p-2 text-center border border-slate-900">{t('common.semester')} II</th>
                                    <th className="p-2 text-center border border-slate-900">Average</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectRows.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center p-8 italic text-slate-400 border border-slate-200">No assessments defined</td></tr>
                                ) : (
                                    subjectRows.map((row, i) => (
                                        <tr key={row.subject} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                            <td className="p-2 font-bold border border-slate-200">{row.subject}</td>
                                            <td className="p-2 text-center border border-slate-200">{row.semI}</td>
                                            <td className="p-2 text-center border border-slate-200">{row.semII}</td>
                                            <td className="p-2 text-center font-bold border border-slate-200">{row.avg}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-900 text-white font-bold">
                                    <td className="p-2 border border-slate-900">{t('teacher.overallAvg')}</td>
                                    <td colSpan={2} className="border border-slate-900"></td>
                                    <td className="p-2 text-center border border-slate-900 text-lg">{averagePercentage}%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {missingAssessments.length > 0 && (
                        <div className="mt-auto bg-red-50 border border-red-600 text-red-700 p-4 rounded text-center text-sm font-bold uppercase tracking-widest relative z-10">
                            <WarningOutlined className="mr-2" />
                            {t('teacher.incompleteTranscript', { count: missingAssessments.length })}
                        </div>
                    )}
                    {missingAssessments.length === 0 && gradeAssessments.length > 0 && (
                        <div className="mt-auto bg-green-50 border border-green-600 text-green-700 p-4 rounded text-center text-sm font-bold uppercase tracking-widest relative z-10">
                            <FileProtectOutlined className="mr-2" />
                            {t('teacher.readyForFinal')}
                        </div>
                    )}

                    {/* Seal Placeholder */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-32 h-32 border-4 border-double border-slate-200 rounded-full flex items-center justify-center opacity-30 rotate-12 pointer-events-none">
                        <div className="text-[8px] font-bold text-center text-slate-300 uppercase leading-none">{t('teacher.officialPreview')}</div>
                    </div>
                </div>
            </div>
        );
    };

    const items = [
        { key: '1', label: <span><UserOutlined /> Overview</span>, children: renderOverview() },
        { key: '2', label: <span><CalendarOutlined /> Attendance</span>, children: renderAttendance() },
        { key: '3', label: <span><BookOutlined /> Marks & Tracker</span>, children: renderMarks() },
        { key: '4', label: <span><FileProtectOutlined /> Live Certificate</span>, children: renderLiveCertificate() },
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
