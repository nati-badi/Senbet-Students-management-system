import React, { useState } from 'react';
import { Typography, Row, Col, Card, Input, Empty, Descriptions, Tag, Space, Table, Alert, Divider } from 'antd';
import {
    SearchOutlined,
    UserOutlined,
    CalendarOutlined,
    BookOutlined,
    WarningOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import StudentProfile from '../../components/StudentProfile';

const { Title, Text } = Typography;

export default function ParentPortal() {
    const { t } = useTranslation();
    const [searchId, setSearchId] = useState('');
    const [viewingStudentId, setViewingStudentId] = useState(null);

    // Search for student by ID
    const student = useLiveQuery(async () => {
        if (!searchId) return null;
        return await db.students.get(searchId);
    }, [searchId]);

    const handleSearch = (val) => {
        setSearchId(val.trim());
    };

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full py-8">
            <div className="text-center space-y-4">
                <Title level={1}>{t('parent.title', 'Parent & Student Portal')}</Title>
                <Text type="secondary" className="text-lg">
                    {t('parent.description', 'View academic progress, attendance history, and missing assessments by entering the Student ID.')}
                </Text>
            </div>

            <Card className="shadow-lg border-slate-200 dark:border-slate-800">
                <div className="max-w-md mx-auto py-4">
                    <Input.Search
                        placeholder={t('parent.searchPlaceholder', 'Enter Student ID (e.g. uuid-...)')}
                        allowClear
                        enterButton={t('common.search', 'Search')}
                        size="large"
                        onSearch={handleSearch}
                        prefix={<SearchOutlined />}
                    />
                </div>
            </Card>

            {searchId && !student && (
                <Empty
                    description={t('parent.studentNotFound', 'No student found with this ID. Please contact the administrator.')}
                    className="py-12 bg-white dark:bg-slate-900 rounded-xl"
                />
            )}

            {student && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Alert
                        message={t('parent.portalNote', 'Access Restricted')}
                        description={t('parent.portalNoteDesc', 'This is a read-only view for parents and students. To update records, please use the Teacher Portal.')}
                        type="info"
                        showIcon
                    />

                    <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800">
                        <Row gutter={[24, 24]} align="middle">
                            <Col xs={24} md={16}>
                                <Space direction="vertical">
                                    <Tag color="blue" className="px-3 py-1 font-bold text-sm uppercase tracking-wider">
                                        {student.grade}ኛ ክፍል
                                    </Tag>
                                    <Title level={2} style={{ margin: 0 }}>{student.name}</Title>
                                    <Text type="secondary" className="text-lg">{student.baptismalName}</Text>
                                </Space>
                            </Col>
                            <Col xs={24} md={8} className="md:text-right">
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<UserOutlined />}
                                    onClick={() => setViewingStudentId(student.id)}
                                    className="h-12 px-8 rounded-full shadow-lg"
                                >
                                    {t('parent.viewFullProfile', 'View Detailed Progress')}
                                </Button>
                            </Col>
                        </Row>

                        <Divider />

                        <Row gutter={[32, 32]}>
                            <Col xs={24} sm={12} md={8}>
                                <Card size="small" className="bg-slate-50 dark:bg-slate-800/50 border-none">
                                    <Descriptions column={1} title={<span><CalendarOutlined /> Quick Info</span>}>
                                        <Descriptions.Item label="Academic Year">{student.academicYear}</Descriptions.Item>
                                        <Descriptions.Item label="Contact">{student.parentContact}</Descriptions.Item>
                                    </Descriptions>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={16} className="flex items-center justify-center">
                                <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl w-full">
                                    <Text type="secondary" italic>
                                        Click the button above to view the full GitHub-style attendance streak and live certificate preview.
                                    </Text>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </div>
            )}

            {viewingStudentId && (
                <StudentProfile
                    studentId={viewingStudentId}
                    visible={!!viewingStudentId}
                    onClose={() => setViewingStudentId(null)}
                />
            )}
        </div>
    );
}
