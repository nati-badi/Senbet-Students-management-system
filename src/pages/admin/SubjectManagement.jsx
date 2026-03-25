import React, { useState } from 'react';
import { Typography, Card, Form, Input, Button, Space, Table, Popconfirm, message, Select, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';

const { Title, Text } = Typography;

export default function SubjectManagement() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];

    const handleSave = async (values) => {
        try {
            if (editingId) {
                await db.subjects.update(editingId, {
                    name: values.name,
                    semester: values.semester,
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                message.success(t('common.save'));
            } else {
                await db.subjects.add({
                    id: crypto.randomUUID(),
                    name: values.name,
                    semester: values.semester,
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                message.success(t('admin.subjectAdded'));
            }
            form.resetFields();
            setEditingId(null);
        } catch (err) {
            message.error("Error saving subject");
        }
    };

    const handleEdit = (subject) => {
        setEditingId(subject.id);
        form.setFieldsValue({ 
            name: subject.name,
            semester: subject.semester || 'Semester I'
        });
    };

    const handleDelete = async (id) => {
        try {
            await db.subjects.delete(id);
            await db.deleted_records.add({ tableName: 'subjects', recordId: id });
            message.success(t('admin.subjectDeleted'));
        } catch (err) {
            message.error("Failed to delete subject");
        }
    };

    const columns = [
        { title: t('admin.subjectName'), dataIndex: 'name', key: 'name' },
        { 
            title: t('admin.semester', 'Semester'), 
            dataIndex: 'semester', 
            key: 'semester',
            render: (sem) => <Tag color="blue">{sem || 'Semester I'}</Tag>
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

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Title level={2}>{t('admin.subjects')}</Title>
                <Text type="secondary">{t('admin.manageSubjects')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form form={form} onFinish={handleSave} layout="vertical">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <Form.Item
                            name="name"
                            label={t('admin.subjectName')}
                            rules={[{ required: true, message: t('admin.subjectName') }]}
                            className="md:col-span-1"
                        >
                            <Input placeholder={t('admin.subjectNamePlaceholder')} />
                        </Form.Item>
                        <Form.Item
                            name="semester"
                            label={t('admin.semester', 'Semester')}
                            rules={[{ required: true }]}
                            initialValue="Semester I"
                            className="md:col-span-1"
                        >
                            <Select>
                                <Select.Option value="Semester I">{t('admin.semester1', 'Semester I')}</Select.Option>
                                <Select.Option value="Semester II">{t('admin.semester2', 'Semester II')}</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item className="mb-0">
                            <Space wrap>
                                <Button type="primary" htmlType="submit">
                                    {editingId ? t('common.save') : t('admin.addSubject')}
                                </Button>
                                {editingId && (
                                    <Button onClick={() => {
                                        setEditingId(null);
                                        form.resetFields();
                                    }}>
                                        {t('admin.cancel')}
                                    </Button>
                                )}
                            </Space>
                        </Form.Item>
                    </div>
                </Form>
            </Card>

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
