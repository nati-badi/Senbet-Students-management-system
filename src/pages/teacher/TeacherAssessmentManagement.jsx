import React, { useState } from 'react';
import { Typography, Card, Form, Input, Button, Space, Table, Popconfirm, message, Row, Col, Select, DatePicker, Tag, InputNumber, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import { db } from '../../db/database';
import { formatGrade, normalizeGrade } from '../../utils/gradeUtils';

const { Title, Text } = Typography;

const normalizeSubject = (str) => String(str || '').toLowerCase().trim();

export default function TeacherAssessmentManagement({ teacher }) {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const selectedGrade = Form.useWatch('grade', form);
    const selectedSubject = Form.useWatch('subjectName', form);

    const myGrades = teacher.assignedGrades || [];
    const mySubjects = teacher.assignedSubjects || [];

    const availableGradeOptions = myGrades.map(g => ({
        value: String(g), label: formatGrade(g)
    }));

    const allSubjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const subjects = (allSubjects || [])
        .filter(s => {
            if (!selectedGrade) return false;
            const sGrade = normalizeGrade(s.grade);
            const selGrade = normalizeGrade(selectedGrade);
            const matchesGrade = (sGrade && selGrade && sGrade === selGrade) ||
                                String(s.grade).trim() === String(selectedGrade).trim();
            const isMySubject = mySubjects.some(ms => normalizeSubject(ms) === normalizeSubject(s.name));
            return isMySubject && matchesGrade;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', i18n.language === 'am' ? 'am' : 'en'));

    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const assessments = allAssessments.filter(a => 
        myGrades.some(g => normalizeGrade(g) === normalizeGrade(a.grade)) &&
        mySubjects.some(ms => normalizeSubject(ms) === normalizeSubject(a.subjectName))
    );

    const handleSave = async (values) => {
        try {
            // Extra security check: ensure the teacher is actually assigned to this grade/subject
            if (!myGrades.some(g => normalizeGrade(g) === normalizeGrade(values.grade))) {
                message.error("You are not authorized to create assessments for this grade.");
                return;
            }
            if (!mySubjects.some(ms => normalizeSubject(ms) === normalizeSubject(values.subjectName))) {
                message.error("You are not authorized to create assessments for this subject.");
                return;
            }

            const subject = allSubjects.find(s => s.name === values.subjectName);
            const semester = subject?.semester || 'Semester I';

            const data = {
                name: values.name,
                subjectName: values.subjectName,
                grade: values.grade,
                maxScore: parseFloat(values.maxScore),
                date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                semester: semester,
                synced: 0
            };

            if (editingId) {
                await db.assessments.update(editingId, {
                    ...data,
                    updated_at: new Date().toISOString()
                });
                message.success(t('common.save'));
            } else {
                await db.assessments.add({
                    id: crypto.randomUUID(),
                    ...data,
                    updated_at: new Date().toISOString()
                });
                message.success(t('admin.assessmentAdded'));
            }
            form.resetFields();
            setEditingId(null);
            setIsFormModalOpen(false);
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
        setIsFormModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await db.assessments.delete(id);
            await db.deleted_records.add({ id: crypto.randomUUID(), tableName: 'assessments', recordId: id });
            message.success(t('admin.assessmentDeleted'));
        } catch (err) {
            message.error("Failed to delete assessment");
        }
    };

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name' },
        { title: t('admin.subjects'), dataIndex: 'subjectName', key: 'subjectName' },
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (text) => formatGrade(text) },
        { title: t('admin.maxScore'), dataIndex: 'maxScore', key: 'maxScore' },
        { 
            title: t('admin.semester', 'Semester'), 
            key: 'semester', 
            render: (_, record) => {
                const subject = allSubjects.find(s => s.name === record.subjectName && normalizeGrade(s.grade) === normalizeGrade(record.grade));
                const sem = subject?.semester || 'Semester I';
                return <Tag color="gold">{t(`admin.${sem === 'Semester II' ? 'semester2' : 'semester1'}`, sem)}</Tag>;
            }
        },
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

    const closeModal = () => {
        setIsFormModalOpen(false);
        setEditingId(null);
        form.resetFields();
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div>
                    <Title level={2} style={{ margin: 0 }}>{t('teacher.myAssessments', 'My Assessments')}</Title>
                    <Text type="secondary">{t('teacher.manageClasses', 'Create and manage your class assessments')}</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    size="large" 
                    onClick={() => setIsFormModalOpen(true)}
                    className="rounded-xl shadow-md h-12 px-6 flex items-center gap-2 font-bold"
                >
                    {t('admin.addAssessment')}
                </Button>
            </div>

            <Modal
                title={<Title level={3} className="m-0">{editingId ? t('admin.editAssessment') : t('admin.addAssessment')}</Title>}
                open={isFormModalOpen}
                onCancel={closeModal}
                footer={null}
                width={800}
                className="top-10"
                destroyOnClose
                forceRender
            >
                <div className="pt-4">
                    <Form form={form} onFinish={handleSave} layout="vertical">
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="grade"
                                    label={t('admin.grade')}
                                    rules={[{ required: true }]}
                                >
                                    <Select 
                                        options={availableGradeOptions} 
                                        showSearch 
                                        placeholder={t('admin.selectGrade', 'Select Grade')}
                                        onChange={() => {
                                            form.setFieldsValue({ subjectName: undefined });
                                        }}
                                        className="h-10"
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="subjectName"
                                    label={t('admin.subjects')}
                                    rules={[{ required: true }]}
                                >
                                    <Select 
                                        showSearch
                                        disabled={!selectedGrade}
                                        placeholder={!selectedGrade ? t('admin.selectGradeFirst') : t('admin.selectSubjectFirst')}
                                        className="h-10"
                                    >
                                        {subjects.map(s => (
                                            <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="name"
                                    label={t('admin.assessmentName')}
                                    rules={[{ required: true }]}
                                >
                                    <Input 
                                        placeholder={!selectedSubject ? t('admin.selectSubjectFirst') : t('admin.assessmentNamePlaceholder')} 
                                        disabled={!selectedSubject} 
                                        className="h-10"
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="maxScore"
                                    label={t('admin.maxScore')}
                                    rules={[{ required: true }]}
                                >
                                    <Input type="number" disabled={!selectedSubject} min={0} className="h-10" />
                                </Form.Item>
                            </Col>
                            <Col xs={24}>
                                <Form.Item
                                    name="date"
                                    label={t('teacher.date')}
                                >
                                    <DatePicker style={{ width: '100%' }} disabled={!selectedSubject} className="h-10" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-4">
                            <Button onClick={closeModal} size="large" className="rounded-xl px-6">
                                {t('admin.cancel')}
                            </Button>
                            <Button type="primary" htmlType="submit" size="large" className="rounded-xl px-10 font-bold">
                                {editingId ? t('common.save') : t('admin.addAssessment')}
                            </Button>
                        </div>
                    </Form>
                </div>
            </Modal>

            <Table
                columns={columns}
                dataSource={assessments}
                rowKey="id"
                scroll={{ x: 'max-content' }}
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    showQuickJumper: true,
                    position: ['bottomRight'],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                }}
                className="shadow-sm rounded-xl overflow-hidden"
            />
        </div>
    );
}
