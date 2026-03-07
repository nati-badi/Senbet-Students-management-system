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
        , [studentId]);

    const marks = useLiveQuery(() =>
        studentId ? db.marks.where('studentId').equals(studentId).toArray() : []
        , [studentId]);

    const allAssessments = useLiveQuery(() => db.assessments.toArray());

    if (!student && visible) {
        return (
            <Modal title={t('teacher.studentProfile')} open={visible} onCancel={onClose} footer={null}>
                <Empty description={t('teacher.studentNotFound')} />
            </Modal>
        );
    }

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

    const studentGradeNorm = normalizeGrade(student?.grade);
    const gradeAssessments = allAssessments?.filter(a => normalizeGrade(a.grade) === studentGradeNorm) || [];

    // Map marks to assessments
    const markHistory = gradeAssessments.map(assessment => {
        const existingMark = marks?.find(m => m.assessmentId === assessment.id);
        return {
            key: assessment.id,
            assessmentId: assessment.id,
            assessmentName: assessment.name || 'Unknown',
            subject: assessment.subjectName || 'Unknown',
            score: existingMark ? existingMark.score : null,
            maxScore: assessment.maxScore,
            date: assessment.date || existingMark?.assessmentDate || '-',
            percentage: existingMark ? ((existingMark.score / assessment.maxScore) * 100).toFixed(1) : null,
            hasMark: !!existingMark
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Summary
    const missingAssessments = markHistory.filter(m => !m.hasMark);
    const completedAssessments = markHistory.filter(m => m.hasMark);
    const totalEarnedScore = completedAssessments.reduce((acc, curr) => acc + curr.score, 0);
    const totalMaxScore = completedAssessments.reduce((acc, curr) => acc + parseFloat(curr.maxScore || 0), 0);
    const averagePercentage = totalMaxScore > 0 ? ((totalEarnedScore / totalMaxScore) * 100).toFixed(1) : 0;

    // --- Columns ---
    const markColumns = [
        { title: t('admin.name'), dataIndex: 'assessmentName', key: 'assessmentName', render: t => <Text strong>{t}</Text> },
        { title: t('admin.subjects'), dataIndex: 'subject', key: 'subject' },
        {
            title: t('teacher.score'),
            key: 'score',
            render: (_, r) => r.hasMark ? <Text strong>{r.score} / {r.maxScore}</Text> : <Tag icon={<WarningOutlined />} color="warning">Pending</Tag>
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
                            <Text type="secondary" className="text-xs uppercase tracking-widest">Entry Date: {student?.dateOfEntry ? dayjs(student.dateOfEntry).format('MMM YYYY') : '-'}</Text>
                        </div>
                    </Col>
                </Row>
            </Card>

            <Descriptions bordered size="small" column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 1, xs: 1 }}>
                <Descriptions.Item label={t('admin.gender')}>{student?.gender === 'Male' ? t('admin.male') : t('admin.female')}</Descriptions.Item>
                <Descriptions.Item label={t('admin.parentContact')}>
                    <Space><PhoneOutlined /> {student?.parentContact}</Space>
                </Descriptions.Item>
                <Descriptions.Item label="Total Assessments">{gradeAssessments.length}</Descriptions.Item>
                <Descriptions.Item label="Missing Marks">
                    {missingAssessments.length > 0 ? <Text type="danger" strong>{missingAssessments.length}</Text> : <Text type="success">0 (Fully Graded)</Text>}
                </Descriptions.Item>
            </Descriptions>
        </div>
    );

    const renderAttendance = () => (
        <div className="space-y-6 mt-4">
            <Title level={5} className="!mb-4"><Space><CalendarOutlined /> 90-Day Attendance Streak</Space></Title>

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
                    <span>Less</span>
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-800"></div>
                        <div className="w-3 h-3 rounded-sm bg-slate-400"></div>
                        <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                        <div className="w-3 h-3 rounded-sm bg-amber-500"></div>
                        <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                    </div>
                    <span>More</span>
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
                    message="Missing Assessments Detected"
                    description={`This student is missing marks for ${missingAssessments.length} assessment(s).`}
                    type="warning"
                    showIcon
                    action={<Tag color="red">{missingAssessments.length} Pending</Tag>}
                />
            )}

            <div className="flex justify-between items-end mb-2">
                <Title level={5} className="!mb-0"><Space><PieChartOutlined /> Academic Record</Space></Title>
                <Tag color="purple" className="text-sm px-2 py-1">Overall Avg: {averagePercentage}%</Tag>
            </div>

            <Table
                dataSource={markHistory}
                columns={markColumns}
                size="small"
                pagination={false}
                bordered
                className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
            />
        </div>
    );

    const renderLiveCertificate = () => (
        <div className="mt-4 flex flex-col items-center bg-slate-100 dark:bg-slate-900 p-8 rounded-lg overflow-auto">
            <div className="w-[190mm] min-h-[250mm] bg-white border-[12px] border-double border-slate-900 p-12 flex flex-col shadow-2xl relative font-serif text-slate-900 shrink-0 transform origin-top" style={{ transform: 'scale(0.8)', marginBottom: '-15%' }}>
                {/* Corner Decorations */}
                <div className="absolute top-4 left-4 border-t-4 border-l-4 border-slate-900 w-12 h-12" />
                <div className="absolute top-4 right-4 border-t-4 border-r-4 border-slate-900 w-12 h-12" />
                <div className="absolute bottom-4 left-4 border-b-4 border-l-4 border-slate-900 w-12 h-12" />
                <div className="absolute bottom-4 right-4 border-b-4 border-r-4 border-slate-900 w-12 h-12" />

                <div className="flex flex-col items-center mb-8 text-center">
                    <Title level={3} className="!mb-0 !text-slate-900 italic font-serif">የተማሪ ውጤት መግለጫ (Preview)</Title>
                    <Text className="text-lg uppercase tracking-widest font-bold">Academic Transcript</Text>
                    <div className="w-32 h-1 bg-slate-900 my-4" />
                </div>

                <div className="border-b-2 border-slate-900 w-full text-center pb-2 mb-8">
                    <Title level={2} className="!mb-0 text-slate-900">{student?.name}</Title>
                    <Text className="text-md uppercase font-bold text-slate-500">{student?.baptismalName || 'N/A'} • {formatGrade(student?.grade)}</Text>
                </div>

                {/* Score Breakdown Table internally */}
                <div className="w-full mb-8">
                    <div className="grid grid-cols-4 border-b-2 border-slate-900 pb-2 mb-4 font-bold text-sm uppercase tracking-wider">
                        <div className="col-span-2">Subject / Assessment</div>
                        <div className="text-right">Max</div>
                        <div className="text-right">Score</div>
                    </div>

                    {gradeAssessments.length === 0 ? (
                        <div className="text-center italic text-slate-400 py-8 border border-dashed border-slate-300">
                            No assessments defined for this grade.
                        </div>
                    ) : (
                        markHistory.map(m => (
                            <div key={m.assessmentId} className="grid grid-cols-4 py-2 border-b border-slate-200 text-sm">
                                <div className="col-span-2 flex flex-col">
                                    <span className="font-bold">{m.subject}</span>
                                    <span className="text-xs text-slate-500 leading-tight">{m.assessmentName}</span>
                                </div>
                                <div className="text-right font-mono self-center text-slate-500">{m.maxScore}</div>
                                <div className="text-right self-center">
                                    {m.hasMark ? (
                                        <span className="font-bold font-mono text-lg">{m.score}</span>
                                    ) : (
                                        <span className="text-red-500 italic bg-red-50 px-2 py-0.5 rounded border border-red-200 text-xs">Pending Score</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    <div className="grid grid-cols-4 pt-4 mt-4 border-t-2 border-slate-900 font-bold">
                        <div className="col-span-2 uppercase">Total / Average</div>
                        <div className="text-right font-mono text-slate-500">{totalMaxScore}</div>
                        <div className="text-right text-lg">{averagePercentage}%</div>
                    </div>
                </div>

                {missingAssessments.length > 0 && (
                    <div className="mt-auto bg-red-50 border border-red-600 text-red-700 p-4 rounded text-center text-sm font-bold uppercase tracking-widest relative z-10">
                        <WarningOutlined className="mr-2" />
                        Incomplete Transcript - Missing {missingAssessments.length} Assessment(s)
                    </div>
                )}
                {missingAssessments.length === 0 && gradeAssessments.length > 0 && (
                    <div className="mt-auto bg-green-50 border border-green-600 text-green-700 p-4 rounded text-center text-sm font-bold uppercase tracking-widest relative z-10">
                        <FileProtectOutlined className="mr-2" />
                        Complete - Ready for Final Generation
                    </div>
                )}

                {/* Seal Placeholder */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-32 h-32 border-4 border-double border-slate-200 rounded-full flex items-center justify-center opacity-30 rotate-12 pointer-events-none">
                    <div className="text-[8px] font-bold text-center text-slate-300 uppercase leading-none">Official<br />Preview</div>
                </div>
            </div>
        </div>
    );

    const items = [
        { key: '1', label: <span><UserOutlined /> Overview</span>, children: renderOverview() },
        { key: '2', label: <span><CalendarOutlined /> Attendance</span>, children: renderAttendance() },
        { key: '3', label: <span><BookOutlined /> Marks & Tracker</span>, children: renderMarks() },
        { key: '4', label: <span><FileProtectOutlined /> Live Certificate</span>, children: renderLiveCertificate() },
    ];

    return (
        <Modal
            title={<Title level={4} style={{ margin: 0 }}>Student Profile</Title>}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={850}
            className="student-profile-modal"
            destroyOnClose
        >
            <Tabs defaultActiveKey="1" items={items} />
        </Modal>
    );
};

export default StudentProfile;
