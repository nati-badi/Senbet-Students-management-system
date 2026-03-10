import React, { useState } from 'react';
import { Typography, Card, Form, Input, Button, Space, Table, Popconfirm, message, Row, Col, Select, DatePicker } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import { db } from '../../db/database';
import { GRADE_OPTIONS, formatGrade } from '../../utils/gradeUtils';

const { Title, Text } = Typography;

export default function AssessmentManagement() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];

    const handleSave = async (values) => {
        try {
            const data = {
                name: values.name,
                subjectName: values.subjectName,
                grade: values.grade,
                maxScore: parseFloat(values.maxScore),
                date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                synced: 0
            };

            if (editingId) {
                await db.assessments.update(editingId, data);
                message.success(t('common.save'));
            } else {
                await db.assessments.add({
                    id: crypto.randomUUID(),
                    ...data
                });
                message.success(t('admin.assessmentAdded'));
            }
            form.resetFields();
            setEditingId(null);
        } catch (err) {
            message.error("Error saving assessment");
        }
    };

    const handleEdit = (assessment) => {
        setEditingId(assessment.id);
        form.setFieldsValue({
            ...assessment,
            date: assessment.date ? dayjs(assessment.date) : null
        });
    };

    const handleDelete = async (id) => {
        await db.assessments.delete(id);
        message.success(t('admin.assessmentDeleted'));
    };

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name' },
        { title: t('admin.subjects'), dataIndex: 'subjectName', key: 'subjectName' },
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (text) => formatGrade(text) },
        { title: t('admin.maxScore'), dataIndex: 'maxScore', key: 'maxScore' },
        { title: t('teacher.date'), dataIndex: 'date', key: 'date' },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        type="text"
                    />
                    <Popconfirm
                        title={t('admin.deleteAssessmentConfirm')}
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            danger
                            type="text"
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Title level={2}>{t('admin.assessments')}</Title>
                <Text type="secondary">{t('admin.manageAssessments')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form form={form} onFinish={handleSave} layout="vertical">
                    <Row gutter={16}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="name"
                                label={t('admin.assessmentName')}
                                rules={[{ required: true }]}
                            >
                                <Input placeholder={t('admin.assessmentNamePlaceholder')} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="subjectName"
                                label={t('admin.subjects')}
                                rules={[{ required: true }]}
                            >
                                <Select showSearch>
                                    {subjects.map(s => (
                                        <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="grade"
                                label={t('admin.grade')}
                                rules={[{ required: true }]}
                            >
                                <Select options={GRADE_OPTIONS} showSearch />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="maxScore"
                                label={t('admin.maxScore')}
                                rules={[{ required: true }]}
                            >
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="date"
                                label={t('teacher.date')}
                            >
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={24} className="flex justify-end">
                            <Space>
                                {editingId && (
                                    <Button onClick={() => {
                                        setEditingId(null);
                                        form.resetFields();
                                    }}>
                                        {t('admin.cancel')}
                                    </Button>
                                )}
                                <Button type="primary" htmlType="submit">
                                    {editingId ? t('common.save') : t('admin.addAssessment')}
                                </Button>
                            </Space>
                        </Col>
                    </Row>
                </Form>
            </Card>

            <Table
                columns={columns}
                dataSource={assessments}
                rowKey="id"
                pagination={false}
                className="shadow-sm rounded-xl overflow-hidden"
            />
        </div>
    );
}
