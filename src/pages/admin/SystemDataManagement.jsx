import React from 'react';
import { Typography, Card, Popconfirm, Button, notification } from 'antd';
import { WarningOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/database';
import { supabase } from '../../utils/supabaseClient';

const { Title, Text: AntText } = Typography;

export default function SystemDataManagement() {
    const { t } = useTranslation();

    const handleWipeDatabase = async () => {
        try {
            // 1. Wipe cloud (Supabase) first — marks depend on students/assessments, so delete them first
            const tables = ['marks', 'attendance', 'assessments', 'students', 'subjects'];
            for (const table of tables) {
                // neq('id', '') matches ALL rows (every id is not empty)
                const { error } = await supabase.from(table).delete().neq('id', '');
                if (error) {
                    console.error(`Failed to wipe Supabase table "${table}":`, error);
                    throw error;
                }
            }

            // 2. Wipe local Dexie
            await db.students.clear();
            await db.attendance.clear();
            await db.marks.clear();
            await db.subjects.clear();
            await db.assessments.clear();

            // 3. Clear the deleted_records queue so old deletions don't re-fire
            if (db.deleted_records) {
                await db.deleted_records.clear();
            }

            notification.success({
                message: 'Database Erased',
                description: 'All data has been erased from both this device and the cloud server. Mobile devices will be cleared on next sync.',
                placement: 'topRight',
                duration: 5,
            });
        } catch (error) {
            console.error('Wipe error:', error);
            notification.error({
                message: 'Wipe Failed',
                description: 'Failed to completely wipe the database. ' + (error?.message || ''),
                placement: 'topRight',
            });
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
            <div>
                <Title level={2}>{t('admin.systemData', 'System Data')}</Title>
                <AntText type="secondary">Manage the underlying database system.</AntText>
            </div>

            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <div className="flex flex-col gap-4 w-full">
                    <div>
                        <AntText strong className="text-red-700 dark:text-red-500 text-lg flex items-center gap-2 mb-2">
                            <WarningOutlined /> Danger Zone
                        </AntText>
                        <AntText className="text-red-600 dark:text-red-400 block mb-4">
                            Wiping the database is an irreversible action. This will permanently delete <strong>ALL</strong> students, attendance records, and marks from both this device and the central server.
                        </AntText>

                        <Popconfirm
                            title="Are you absolutely sure?"
                            description="This cannot be undone. All data will be destroyed."
                            onConfirm={handleWipeDatabase}
                            okText="Yes, Wipe Everything"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                        >
                            <Button
                                danger
                                type="primary"
                                icon={<DeleteOutlined />}
                                size="large"
                                className="cursor-pointer"
                            >
                                Wipe Entire Database
                            </Button>
                        </Popconfirm>
                    </div>
                </div>
            </Card>
        </div>
    );
}
