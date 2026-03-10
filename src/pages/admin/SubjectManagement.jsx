import React, { useState } from 'react';
import { Typography, Card, Form, Input, Button, Space, Table, Popconfirm, message } from 'antd';
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
                    synced: 0
                });
                message.success(t('common.save'));
            } else {
                await db.subjects.add({
                    id: crypto.randomUUID(),
                    name: values.name,
                    synced: 0
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
        form.setFieldsValue({ name: subject.name });
    };

    const handleDelete = async (id) => {
        await db.subjects.delete(id);
        message.success(t('admin.subjectDeleted'));
    };

    const columns = [
        { title: t('admin.subjectName'), dataIndex: 'name', key: 'name' },
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
                <Form form={form} onFinish={handleSave} layout="inline">
                    <Form.Item
                        name="name"
                        rules={[{ required: true, message: t('admin.subjectName') }]}
                        style={{ minWidth: '300px' }}
                    >
                        <Input placeholder={t('admin.subjectNamePlaceholder')} />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            {editingId ? t('common.save') : t('admin.addSubject')}
                        </Button>
                        {editingId && (
                            <Button className="ml-2" onClick={() => {
                                setEditingId(null);
                                form.resetFields();
                            }}>
                                {t('admin.cancel')}
                            </Button>
                        )}
                    </Form.Item>
                </Form>
            </Card>

            <Table
                columns={columns}
                dataSource={subjects}
                rowKey="id"
                pagination={false}
                className="shadow-sm rounded-xl overflow-hidden"
            />
        </div>
    );
}
