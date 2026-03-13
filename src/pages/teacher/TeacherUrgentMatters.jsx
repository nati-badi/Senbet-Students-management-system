import React, { useState } from 'react';
import { Card, Typography, Table, Button, Space, Tag, Input, Badge } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { normalizeGrade } from '../../utils/gradeUtils';

const { Title, Text } = Typography;

export default function TeacherUrgentMatters({ teacher }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchText, setSearchText] = useState('');

    const allowedGrades = teacher?.assignedGrades || [];
    const allowedSubjects = teacher?.assignedSubjects || [];

    // Query required data
    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const currentSemesterSetting = useLiveQuery(
        () => db.settings.get('currentSemester').then(s => s?.value || 'Semester I')
    );
    const existingMarks = useLiveQuery(() => db.marks.toArray()) || [];

    // Process Missing Marks Data
    const generateMissingMarksData = () => {
        if (!allStudents.length || !allAssessments.length) return [];

        const missingMarksData = [];

        // Only look at assessments that fall within the teacher's domain
        const relevantAssessments = allAssessments.filter(a =>
            (a.semester || 'Semester I') === currentSemesterSetting &&
            (allowedGrades.length === 0 || allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(a.grade))) &&
            (allowedSubjects.length === 0 || allowedSubjects.includes(a.subjectName))
        );

        relevantAssessments.forEach(assessment => {
            // Find students in this assessment's grade
            const targetStudents = allStudents.filter(s =>
                normalizeGrade(s.grade) === normalizeGrade(assessment.grade)
            );

            // Find missing marks
            targetStudents.forEach(student => {
                const markExists = existingMarks.some(m =>
                    m.studentId === student.id &&
                    m.assessmentId === assessment.id
                );

                if (!markExists) {
                    missingMarksData.push({
                        key: `${student.id}-${assessment.id}`,
                        studentId: student.id,
                        studentName: student.name,
                        grade: student.grade,
                        assessmentId: assessment.id,
                        assessmentName: assessment.name,
                        subject: assessment.subjectName,
                        maxScore: assessment.maxScore
                    });
                }
            });
        });

        return missingMarksData;
    };

    const missingMarksList = generateMissingMarksData();

    // Filtering logic
    const filteredMissingMarks = missingMarksList.filter(item => {
        const query = (searchText || "").toLowerCase();
        return (item.studentName || "").toLowerCase().includes(query) ||
               (item.assessmentName || "").toLowerCase().includes(query) ||
               (item.subject || "").toLowerCase().includes(query);
    });

    const missingMarksColumns = [
        {
            title: t('admin.name', 'Student Name'),
            dataIndex: 'studentName',
            key: 'studentName',
            sorter: (a, b) => (a.studentName || '').localeCompare(b.studentName || ''),
        },
        {
            title: t('admin.grade', 'Grade'),
            dataIndex: 'grade',
            key: 'grade',
            filters: Array.from(new Set(missingMarksList.map(item => item.grade))).map(g => ({ text: g, value: g })),
            onFilter: (value, record) => record.grade === value,
        },
        {
            title: t('admin.subjects', 'Subject'),
            dataIndex: 'subject',
            key: 'subject',
        },
        {
            title: t('teacher.assessmentLabel', 'Assessment'),
            dataIndex: 'assessmentName',
            key: 'assessmentName',
        },
        {
            title: t('common.actions', 'Actions'),
            key: 'action',
            render: (_, record) => (
                <Button 
                    type="primary" 
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => {
                        navigate('/teacher/mark-entry', { 
                            state: { 
                                assessmentId: record.assessmentId,
                                grade: record.grade
                            } 
                        }); 
                    }}
                >
                    Create Assessment & Start Entry
                </Button>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Title level={2}>{t('admin.urgentMatters', 'Urgent Matters')}</Title>
                    <Text type="secondary">Actionable shortcut items needing your attention.</Text>
                </div>
            </div>

            <Card className="rounded-xl border-slate-200 dark:border-slate-700 shadow-sm" bodyStyle={{ padding: 0 }}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 rounded-t-xl">
                    <Space>
                        <Badge dot><ClockCircleOutlined className="text-orange-500 text-lg" /></Badge>
                        <Title level={4} style={{ margin: 0 }}>No Marks Recorded</Title>
                        <Tag color="orange" className="ml-2 rounded-full px-3">{filteredMissingMarks.length} missing</Tag>
                    </Space>
                </div>
                
                <div className="p-4">
                    <Input
                        placeholder="Search student or assessment..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="max-w-md mb-4"
                        allowClear
                    />
                    
                    <Table 
                        dataSource={filteredMissingMarks}
                        columns={missingMarksColumns}
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        scroll={{ x: 'max-content' }}
                        size="middle"
                        rowClassName="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    />
                </div>
            </Card>
        </div>
    );
}
