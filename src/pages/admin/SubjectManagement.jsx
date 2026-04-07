import React, { useState } from 'react';
import { Typography, Card, Form, Input, Button, Space, Table, Popconfirm, message, Select, Tag, Modal, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { GRADE_OPTIONS, formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import { syncData } from '../../utils/sync';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function SubjectManagement() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);

    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];

    const handleSave = async (values) => {
        try {
            if (editingId) {
                await db.subjects.update(editingId, {
                    name: values.name,
                    semester: values.semester,
                    grade: values.grade,
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                message.success(t('common.save'));
            } else {
                await db.subjects.add({
                    id: crypto.randomUUID(),
                    name: values.name,
                    semester: values.semester,
                    grade: values.grade,
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                message.success(t('admin.subjectAdded'));
            }
            form.resetFields();
            setEditingId(null);
            setIsFormModalOpen(false);
            await syncData().catch(console.error);
        } catch (err) {
            message.error("Error saving subject");
        }
    };

    const handleEdit = (subject) => {
        setEditingId(subject.id);
        form.setFieldsValue({ 
            name: subject.name,
            semester: subject.semester || 'Semester I',
            grade: subject.grade
        });
        setIsFormModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await db.subjects.delete(id);
            await db.deleted_records.add({ id: crypto.randomUUID(), tableName: 'subjects', recordId: id });
            message.success(t('admin.subjectDeleted'));
            await syncData().catch(console.error);
        } catch (err) {
            message.error("Failed to delete subject");
        }
    };

    const columns = [
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (g) => <Tag color="orange">{formatGrade(g)}</Tag> },
        { title: t('admin.subjectName'), dataIndex: 'name', key: 'name' },
        { 
            title: t('admin.semester', 'Semester'), 
            dataIndex: 'semester', 
            key: 'semester',
            render: (sem) => <Tag color="gold">{t(`admin.${sem === 'Semester II' ? 'semester2' : 'semester1'}`, sem || 'Semester I')}</Tag>
        },
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
                        title={t('admin.deleteSubjectConfirm')}
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
                    <Title level={2} style={{ margin: 0 }}>{t('admin.subjects')}</Title>
                    <Text type="secondary">{t('admin.manageSubjects')}</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    size="large" 
                    onClick={() => setIsFormModalOpen(true)}
                    className="rounded-xl shadow-md h-12 px-6 flex items-center gap-2 font-bold"
                >
                    {t('admin.addSubject')}
                </Button>
            </div>

            <Modal
                title={<Title level={3} className="m-0">{editingId ? t('admin.edit') : t('admin.addSubject')}</Title>}
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
                                    <Select options={GRADE_OPTIONS} showSearch placeholder={t('admin.selectGrade')} className="h-10" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="name"
                                    label={t('admin.subjectName')}
                                    rules={[{ required: true, message: t('admin.subjectName') }]}
                                >
                                    <Input placeholder={t('admin.subjectNamePlaceholder')} className="h-10" />
                                </Form.Item>
                            </Col>
                            <Col xs={24}>
                                <Form.Item
                                    name="semester"
                                    label={t('admin.semester', 'Semester')}
                                    rules={[{ required: true }]}
                                    initialValue="Semester I"
                                >
                                    <Select className="h-10">
                                        <Select.Option value="Semester I">{t('admin.semester1', 'Semester I')}</Select.Option>
                                        <Select.Option value="Semester II">{t('admin.semester2', 'Semester II')}</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-4">
                            <Button onClick={closeModal} size="large" className="rounded-xl px-6">
                                {t('admin.cancel')}
                            </Button>
                            <Button type="primary" htmlType="submit" size="large" className="rounded-xl px-10 font-bold">
                                {editingId ? t('common.save') : t('admin.addSubject')}
                            </Button>
                        </div>
                    </Form>
                </div>
            </Modal>

            <Table
                columns={columns}
                dataSource={subjects}
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
