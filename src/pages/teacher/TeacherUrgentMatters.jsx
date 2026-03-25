import React, { useMemo } from 'react';
import { Typography, Card, List, Avatar, Tag, Empty, Badge, Alert, Row, Col, Statistic, Button, Space, Tooltip } from 'antd';
import { WarningOutlined, ClockCircleOutlined, FormOutlined, AlertOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

export default function TeacherUrgentMatters({ teacher }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const allowedGrades = useMemo(() => teacher?.assignedGrades || [], [teacher]);
    const allowedSubjects = useMemo(() => teacher?.assignedSubjects || [], [teacher]);

    const [syncKey, setSyncKey] = React.useState(0);
    React.useEffect(() => {
        const handleSync = () => setSyncKey(k => k + 1);
        window.addEventListener('syncComplete', handleSync);
        return () => window.removeEventListener('syncComplete', handleSync);
    }, []);

    const allStudents = useLiveQuery(() => db.students.toArray(), [syncKey]) || [];
    const marks = useLiveQuery(() => db.marks.toArray(), [syncKey]) || [];
    const allAssessments = useLiveQuery(() => db.assessments.toArray(), [syncKey]) || [];
    const allSubjects = useLiveQuery(() => db.subjects.toArray(), [syncKey]) || [];
    const settingsRows = useLiveQuery(() => db.settings?.toArray(), [syncKey]) || [];

    const currentSemester = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    // Filter students to only those in the teacher's assigned grades
    const myStudents = useMemo(() => {
        if (allowedGrades.length === 0) return allStudents;
        return allStudents.filter(s =>
            allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(s.grade))
        );
    }, [allStudents, allowedGrades]);

    const isConduct = (a) => {
        const sName = (a.subjectName || '').toLowerCase();
        const aName = (a.name || '').toLowerCase();
        return sName.includes('conduct') || sName.includes('attitude') || aName.includes('conduct') || aName.includes('attitude');
    };

    // Assessments this teacher is responsible for
    const myAssessments = useMemo(() => allAssessments.filter(a => {
        if (isConduct(a)) return false;
        const subject = allSubjects.find(s => s.name === a.subjectName);
        const assessmentSemester = subject?.semester || 'Semester I';
        return assessmentSemester === currentSemester &&
            (allowedGrades.length === 0 || allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(a.grade))) &&
            (allowedSubjects.length === 0 || allowedSubjects.includes(a.subjectName));
    }), [allAssessments, allSubjects, allowedGrades, allowedSubjects, currentSemester]);

    // Students with NO marks in any of teacher's assessments
    const noMarksStudents = useMemo(() => {
        if (!myAssessments.length) return [];
        return myStudents.filter(student => {
            const myAssessmentsForGrade = myAssessments.filter(a =>
                normalizeGrade(a.grade) === normalizeGrade(student.grade)
            );
            if (!myAssessmentsForGrade.length) return false;
            return !marks.some(m =>
                m.studentId === student.id &&
                myAssessmentsForGrade.some(a => a.id === m.assessmentId)
            );
        });
    }, [myStudents, myAssessments, marks]);

    // Per-assessment missing marks (students who haven't been graded in a specific assessment)
    const missingMarksByAssessment = useMemo(() => {
        const result = [];
        myAssessments.forEach(assessment => {
            const studentsForGrade = myStudents.filter(s =>
                normalizeGrade(s.grade) === normalizeGrade(assessment.grade)
            );
            const ungraded = studentsForGrade.filter(s =>
                !marks.some(m => m.studentId === s.id && m.assessmentId === assessment.id)
            );
            if (ungraded.length > 0) {
                result.push({ assessment, count: ungraded.length, students: ungraded });
            }
        });
        return result;
    }, [myAssessments, myStudents, marks]);

    const totalIssues = noMarksStudents.length + missingMarksByAssessment.reduce((s, a) => s + a.count, 0);

    const avatarStyle = (bg, fg, border) => ({
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${border}`,
        boxShadow: '0 6px 18px rgba(2,6,23,0.08)',
    });

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                    <WarningOutlined className="text-2xl text-orange-500" />
                </div>
                <div>
                    <Title level={2} style={{ margin: 0 }}>{t('admin.urgentMatters', 'Urgent Matters')}</Title>
                    <Text type="secondary">
                        Items needing your attention — scoped to your assigned grades &amp; subjects
                        {allowedGrades.length > 0 && (
                            <span> ({allowedGrades.map(g => formatGrade(g)).join(', ')})</span>
                        )}
                    </Text>
                </div>
            </div>

            {totalIssues === 0 ? (
                <Alert
                    message="All caught up!"
                    description={
                        myAssessments.length === 0
                            ? "No assessments found for your assigned grades/subjects this semester."
                            : "All your students have marks recorded. Great job!"
                    }
                    type={myAssessments.length === 0 ? "warning" : "success"}
                    showIcon
                    className="rounded-2xl border-none shadow-sm"
                />
            ) : (
                <Alert
                    message={`${totalIssues} issue${totalIssues !== 1 ? 's' : ''} require your attention`}
                    type="error"
                    showIcon
                    icon={<AlertOutlined />}
                    className="rounded-xl border-none shadow-sm"
                />
            )}

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                    <Card className="rounded-2xl border-none shadow-sm bg-yellow-50 dark:bg-yellow-900/20 text-center">
                        <Statistic
                            title={<span className="text-yellow-700 font-bold">Students With No Marks</span>}
                            value={noMarksStudents.length}
                            valueStyle={{ color: '#ca8a04', fontWeight: 'bold', fontSize: '2.5rem' }}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12}>
                    <Card className="rounded-2xl border-none shadow-sm bg-orange-50 dark:bg-orange-900/20 text-center">
                        <Statistic
                            title={<span className="text-orange-600 font-bold">Assessments With Gaps</span>}
                            value={missingMarksByAssessment.length}
                            valueStyle={{ color: '#ea580c', fontWeight: 'bold', fontSize: '2.5rem' }}
                            prefix={<FormOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {noMarksStudents.length > 0 && (
                <Card
                    title={
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-yellow-100 rounded-xl flex items-center justify-center">
                                <ClockCircleOutlined className="text-yellow-600" />
                            </div>
                            <span className="font-bold">Students With No Marks Recorded</span>
                            <Badge count={noMarksStudents.length} color="gold" />
                        </div>
                    }
                    className="rounded-2xl border-l-4 border-l-yellow-500 shadow-sm"
                >
                    <Paragraph type="secondary" className="mb-4">
                        These students in your classes have not been graded in any of your assessments this semester.
                    </Paragraph>
                    <List
                        dataSource={noMarksStudents}
                        rowKey="id"
                        renderItem={student => (
                            <List.Item
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-4 rounded-lg"
                                actions={[
                                    <Button
                                        key="go"
                                        type="primary"
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={e => {
                                            e.stopPropagation();
                                            navigate('/teacher/mark-entry');
                                        }}
                                    >
                                        Go to Mark Entry
                                    </Button>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            size={44}
                                            icon={<ClockCircleOutlined />}
                                            style={avatarStyle('#fefce8', '#a16207', '#fde68a')}
                                        />
                                    }
                                    title={<span className="font-bold">{student.name}</span>}
                                    description={<Tag color="green">{formatGrade(student.grade)}</Tag>}
                                />
                            </List.Item>
                        )}
                        pagination={{ pageSize: 8 }}
                    />
                </Card>
            )}

            {missingMarksByAssessment.length > 0 && (
                <Card
                    title={
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                                <FormOutlined className="text-orange-500" />
                            </div>
                            <span className="font-bold">Assessments With Missing Student Marks</span>
                            <Badge count={missingMarksByAssessment.reduce((s, a) => s + a.count, 0)} color="orange" />
                        </div>
                    }
                    className="rounded-2xl border-l-4 border-l-orange-500 shadow-sm"
                >
                    <Paragraph type="secondary" className="mb-4">
                        These assessments are missing marks for some students. Click "Fill Marks" to jump straight to that assessment.
                    </Paragraph>
                    <List
                        dataSource={missingMarksByAssessment}
                        rowKey={item => item.assessment.id}
                        renderItem={({ assessment, count, students: ungradedStudents }) => (
                            <List.Item
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-4 rounded-lg"
                                actions={[
                                    <Tooltip key="fill" title={`Jump to mark entry for ${assessment.name}`}>
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={e => {
                                                e.stopPropagation();
                                                navigate('/teacher/mark-entry', {
                                                    state: {
                                                        assessmentId: assessment.id,
                                                        grade: assessment.grade
                                                    }
                                                });
                                            }}
                                        >
                                            Fill Marks
                                        </Button>
                                    </Tooltip>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            size={44}
                                            icon={<FormOutlined />}
                                            style={avatarStyle('#fff7ed', '#c2410c', '#fdba74')}
                                        />
                                    }
                                    title={
                                        <Space wrap>
                                            <span className="font-bold">{assessment.name}</span>
                                            <Tag color="blue">{assessment.subjectName}</Tag>
                                            <Tag color="green">{formatGrade(assessment.grade)}</Tag>
                                            <Tag color="gold">{currentSemester}</Tag>
                                        </Space>
                                    }
                                    description={
                                        <Text type="secondary">
                                            <span className="font-semibold text-orange-500">{count} student{count !== 1 ? 's' : ''}</span> not yet graded
                                            {ungradedStudents.length <= 3 && (
                                                <span className="ml-2 text-slate-400">
                                                    ({ungradedStudents.map(s => s.name).join(', ')})
                                                </span>
                                            )}
                                        </Text>
                                    }
                                />
                            </List.Item>
                        )}
                        pagination={{ pageSize: 8 }}
                    />
                </Card>
            )}

            {totalIssues === 0 && myAssessments.length > 0 && (
                <Card className="rounded-2xl border-none shadow-sm">
                    <Empty description="No urgent matters. All students are graded for this semester!" />
                </Card>
            )}
        </div>
    );
}
