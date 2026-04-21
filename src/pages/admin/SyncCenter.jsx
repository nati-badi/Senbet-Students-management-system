import React, { useState } from 'react';
import { Card, Button, Typography, Statistic, Row, Col, List, Badge, Empty, Space, App } from 'antd';
import { CloudSyncOutlined, CloudUploadOutlined, CloudDownloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { syncData } from '../../utils/sync';

const { Title, Text, Paragraph } = Typography;

export default function SyncCenter() {
    const { t } = useTranslation();
    const { notification } = App.useApp();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [syncStats, setSyncStats] = useState(null);

    const handleSync = async (options = {}) => {
        setIsSyncing(true);
        try {
            const result = await syncData(options);
            if (result.success) {
                setSyncStats({
                    pushed: result.pushed,
                    pulled: result.pulled,
                    tableStatus: result.tableStatus
                });
                setLastSync(new Date().toLocaleTimeString());
                
                const failedTables = Object.entries(result.tableStatus || {})
                    .filter(([_, status]) => status.push === 'error' || status.pull === 'error')
                    .map(([name]) => name);

                if (failedTables.length > 0) {
                    notification.warning({
                        message: t('admin.syncPartialSuccess', 'Sync Partial Success'),
                        description: t('admin.syncPartialDesc', { tables: failedTables.join(', '), defaultValue: `Synced successfully but failed for tables: ${failedTables.join(', ')}. Check Supabase schema.` })
                    });
                } else {
                    notification.success({
                        message: t('admin.syncSuccessful', 'Sync Successful'),
                        description: t('admin.syncPushedPulled', { pushed: result.pushed, pulled: result.pulled, defaultValue: `Pushed ${result.pushed} records and pulled ${result.pulled} records.` })
                    });
                }
            } else {
                notification.error({
                    message: t('admin.syncFailed', 'Sync Failed'),
                    description: result.error
                });
            }
        } catch (error) {
            notification.error({
                message: t('admin.syncError', 'Sync Error'),
                description: error.message
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <Title level={2}>{t('admin.syncCenter')}</Title>
                    <Text type="secondary">{t('admin.syncCenterSubtitle')}</Text>
                </div>
                <Space>
                    <Button
                        type="default"
                        icon={<SyncOutlined />}
                        loading={isSyncing}
                        onClick={() => handleSync({ force: true })}
                    >
                        {isSyncing ? t('common.done') : t('admin.forceSync')}
                    </Button>
                    <Button
                        type="primary"
                        size="large"
                        icon={<CloudSyncOutlined />}
                        loading={isSyncing}
                        onClick={() => handleSync()}
                    >
                        {isSyncing ? t('common.syncing') : t('admin.syncNow')}
                    </Button>
                </Space>
            </div>

            <Row gutter={16}>
                <Col span={8}>
                    <Card shadow="sm">
                        <Statistic
                            title={t('admin.recordsPushed')}
                            value={syncStats?.pushed ?? 0}
                            prefix={<CloudUploadOutlined className="text-blue-500" />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card shadow="sm">
                        <Statistic
                            title={t('admin.recordsPulled')}
                            value={syncStats?.pulled ?? 0}
                            prefix={<CloudDownloadOutlined className="text-green-500" />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card shadow="sm">
                        <Statistic
                            title={t('admin.lastSync')}
                            value={lastSync ?? t('common.pending', 'Never')}
                            valueStyle={{ fontSize: '16px' }}
                            prefix={<CheckCircleOutlined className={lastSync ? "text-green-500" : "text-slate-300"} />}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title={t('admin.dbStatus')} className="mt-4">
                <Space orientation="vertical" className="w-full">
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <Space>
                            <Badge status="processing" />
                            <Text strong>Local Storage (Dexie.js)</Text>
                        </Space>
                        <Tag color="blue">{t('common.active', 'Active')}</Tag>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <Space>
                            <Badge status={syncStats ? "success" : "default"} />
                            <Text strong>Cloud Backend (Supabase)</Text>
                        </Space>
                        <Tag color={syncStats ? "green" : "orange"}>{syncStats ? t('common.connected', 'Connected') : t('common.ready')}</Tag>
                    </div>
                </Space>
            </Card>

            {syncStats?.tableStatus && (
                <Card title={t('admin.tableDetails')} className="mt-4">
                    <List
                        itemLayout="horizontal"
                        dataSource={Object.entries(syncStats.tableStatus)}
                        renderItem={([name, status]) => (
                            <List.Item
                                extra={
                                    <Space>
                                        <Badge status={status.push === 'error' ? 'error' : (status.push === 'ok' ? 'success' : 'default')} text={`Push: ${status.push}`} />
                                        <Badge status={status.pull === 'error' ? 'error' : (status.pull === 'ok' ? 'success' : 'default')} text={`Pull: ${status.pull}`} />
                                    </Space>
                                }
                            >
                                <List.Item.Meta
                                    title={<Text strong className="capitalize">{name}</Text>}
                                    description={status.error ? <Text type="danger" size="small">Error: {status.error}</Text> : `${t('admin.lastSync')}: ${lastSync}`}
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            )}

            <Card title={t('admin.howToSync')} className="mt-4">
                <Paragraph>
                    1. {t('common.onlineCheck', 'Ensure you have an active internet connection.')}<br />
                    2. {t('common.syncInstruction1', 'Click "Start Sync Now" to upload any changes made on this desktop.')}<br />
                    3. {t('common.syncInstruction2', 'This will also download any attendance or marks entered by teachers.')}<br />
                    4. {t('common.syncInstruction3', 'Once finished, navigate to the relevant pages to see the updated data.')}
                </Paragraph>
            </Card>
        </div>
    );
}

const Tag = ({ color, children }) => (
    <span style={{
        backgroundColor: color === 'blue' ? '#e6f7ff' : (color === 'green' ? '#f6ffed' : '#fff7e6'),
        color: color === 'blue' ? '#1890ff' : (color === 'green' ? '#52c41a' : '#fa8c16'),
        border: `1px solid ${color === 'blue' ? '#91d5ff' : (color === 'green' ? '#b7eb8f' : '#ffd591')}`,
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px'
    }}>
        {children}
    </span>
);
