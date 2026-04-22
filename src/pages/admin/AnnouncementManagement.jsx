import React, { useState } from 'react';
import { Typography, Form, Input, Button, Space, Table, Popconfirm, Select, Tag, Modal, Row, Col, Switch, DatePicker, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { syncData } from '../../utils/sync';
import { formatEthiopianDate } from '../../utils/dateUtils';
import { PlusOutlined, EditOutlined, DeleteOutlined, NotificationOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AnnouncementManagement() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);

    const announcements = useLiveQuery(() => db.announcements.reverse().toArray()) || [];

    const handleSave = async (values) => {
        try {
            const announcementData = {
                title_am: values.title_am,
                content_am: values.content_am,
                date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                priority: values.priority || 'medium',
                active: values.active ? 1 : 0,
                synced: 0,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                await db.announcements.update(editingId, announcementData);
                message.success(t('common.save'));
            } else {
                await db.announcements.add({
                    id: crypto.randomUUID(),
                    ...announcementData,
                    title_en: values.title_am, 
                    content_en: values.content_am
                });
                message.success(t('admin.announcementAdded', 'Announcement added successfully'));
            }
            closeModal();
            await syncData().catch(console.error);
        } catch (err) {
            message.error(t('common.saveError', 'Failed to save announcement'));
        }
    };

    const handleEdit = (record) => {
        setEditingId(record.id);
        form.setFieldsValue({
            ...record,
            date: record.date ? dayjs(record.date) : dayjs(),
            active: record.active === 1
        });
        setIsFormModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await db.announcements.delete(id);
            await db.deleted_records.add({ id: crypto.randomUUID(), tableName: 'announcements', recordId: id });
            message.success(t('admin.announcementDeleted', 'Announcement deleted successfully'));
            await syncData().catch(console.error);
        } catch (err) {
            message.error(t('common.deleteError', 'Failed to delete'));
        }
    };

    const columns = [
        {
            title: t('admin.date', 'Date'),
            dataIndex: 'date',
            key: 'date',
            width: 120,
            render: (date) => <Text className="font-medium">{formatEthiopianDate(date)}</Text>
        },
        {
            title: t('admin.title', 'Title'),
            dataIndex: 'title_am',
            key: 'title_am',
            render: (title) => <Text strong>{title}</Text>
        },
        {
            title: t('admin.priority', 'Priority'),
            dataIndex: 'priority',
            key: 'priority',
            width: 130,
            render: (p) => {
                const colors = { high: 'red', medium: 'orange', low: 'blue' };
                const label = t(`common.priority_${p}`);
                return <Tag color={colors[p] || 'blue'} className="rounded-full px-3">{label.toUpperCase()}</Tag>;
            }
        },
        {
            title: t('admin.status', 'Status'),
            dataIndex: 'active',
            key: 'active',
            width: 120,
            render: (active) => (
                <Tag color={active ? 'green' : 'default'} className="rounded-full px-3">
                    {active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                </Tag>
            )
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} type="text" className="hover:bg-blue-50 text-blue-600" />
                    <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} danger type="text" className="hover:bg-red-50" />
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
                    <Title level={2} style={{ margin: 0 }}>{t('admin.announcements', 'Announcements')}</Title>
                    <Text type="secondary">{t('admin.manageAnnouncements', 'Create and manage school notifications')}</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    size="large" 
                    onClick={() => setIsFormModalOpen(true)}
                    className="rounded-xl shadow-md h-12 px-6 flex items-center gap-2 font-bold"
                >
                    {t('admin.addAnnouncement', 'Add Announcement')}
                </Button>
            </div>

            <Modal
                title={
                    <Space>
                        <NotificationOutlined className="text-secondary" />
                        <Title level={3} className="m-0">
                            {editingId ? t('admin.edit') : t('admin.addAnnouncement')}
                        </Title>
                    </Space>
                }
                open={isFormModalOpen}
                onCancel={closeModal}
                footer={null}
                width={600}
                destroyOnClose
                centered
            >
                <div className="pt-4">
                    <Form 
                        form={form} 
                        onFinish={handleSave} 
                        layout="vertical" 
                        initialValues={{ priority: 'medium', active: true, date: dayjs() }}
                    >
                        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 mb-6">
                            <Form.Item name="title_am" label={t('admin.amharicTitle')} rules={[{ required: true }]}>
                                <Input placeholder={t('admin.amharicTitle') + "..."} className="rounded-lg h-12 text-lg" />
                            </Form.Item>
                            <Form.Item name="content_am" label={t('admin.amharicContent')} rules={[{ required: true }]}>
                                <TextArea rows={6} placeholder={t('admin.amharicContent') + "..."} className="rounded-lg text-base" />
                            </Form.Item>
                        </div>
                        
                        <div className="p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <Row gutter={24}>
                                <Col xs={24} md={12}>
                                    <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.date !== currentValues.date}>
                                        {({ getFieldValue }) => (
                                            <Form.Item 
                                                name="date" 
                                                label={t('admin.date')} 
                                                rules={[{ required: true }]}
                                                extra={getFieldValue('date') ? formatEthiopianDate(getFieldValue('date').toDate()) : null}
                                                className="mb-0"
                                            >
                                                <DatePicker 
                                                    className="w-full rounded-lg h-10" 
                                                    format="YYYY-MM-DD" 
                                                    placeholder={t('admin.date')}
                                                    disabled
                                                />
                                            </Form.Item>
                                        )}
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item name="priority" label={t('admin.priority')}>
                                        <Select className="h-10" options={[
                                            { label: t('common.priority_low'), value: 'low' },
                                            { label: t('common.priority_medium'), value: 'medium' },
                                            { label: t('common.priority_high'), value: 'high' },
                                        ]} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                                        <Text strong>{t('admin.active')}</Text>
                                        <Form.Item name="active" valuePropName="checked" noStyle>
                                            <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
                                        </Form.Item>
                                    </div>
                                </Col>
                            </Row>
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                            <Button onClick={closeModal} size="large" className="rounded-xl px-6 h-12">
                                {t('common.cancel')}
                            </Button>
                            <Button type="primary" htmlType="submit" size="large" className="rounded-xl px-12 font-bold h-12">
                                {editingId ? t('common.save') : t('admin.addAnnouncement')}
                            </Button>
                        </div>
                    </Form>
                </div>
            </Modal>

            <Table
                columns={columns}
                dataSource={announcements}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                className="shadow-sm rounded-xl overflow-hidden"
            />
        </div>
    );
}
