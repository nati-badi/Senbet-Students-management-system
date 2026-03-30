import React, { useState } from 'react';
import { Card, Button, Typography, Statistic, Row, Col, List, Badge, notification, Empty, Space } from 'antd';
import { CloudSyncOutlined, CloudUploadOutlined, CloudDownloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { syncData } from '../../utils/sync';

const { Title, Text, Paragraph } = Typography;

export default function SyncCenter() {
    const { t } = useTranslation();
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
                        title: 'Sync Partial Success',
                        description: `Synced successfully but failed for tables: ${failedTables.join(', ')}. Check Supabase schema.`
                    });
                } else {
                    notification.success({
                        title: 'Sync Successful',
                        description: `Pushed ${result.pushed} records and pulled ${result.pulled} records.`
                    });
                }
            } else {
                notification.error({
                    title: 'Sync Failed',
                    description: result.error
                });
            }
        } catch (error) {
            notification.error({
                title: 'Sync Error',
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
                    <Title level={2}>{t('admin.syncCenter') || 'Cloud Sync Center'}</Title>
                    <Text type="secondary">Keep your Local Desktop and Teacher Mobile data in sync via Supabase Cloud.</Text>
                </div>
                <Space>
                    <Button
                        type="default"
                        icon={<SyncOutlined />}
                        loading={isSyncing}
                        onClick={() => handleSync({ force: true })}
                    >
                        {isSyncing ? 'Processing...' : 'Force Full Re-sync'}
                    </Button>
                    <Button
                        type="primary"
                        size="large"
                        icon={<CloudSyncOutlined />}
                        loading={isSyncing}
                        onClick={() => handleSync()}
                    >
                        {isSyncing ? 'Syncing...' : 'Start Sync Now'}
                    </Button>
                </Space>
            </div>

            <Row gutter={16}>
                <Col span={8}>
                    <Card shadow="sm">
                        <Statistic
                            title="Records Pushed"
                            value={syncStats?.pushed ?? 0}
                            prefix={<CloudUploadOutlined className="text-blue-500" />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card shadow="sm">
                        <Statistic
                            title="Records Pulled"
                            value={syncStats?.pulled ?? 0}
                            prefix={<CloudDownloadOutlined className="text-green-500" />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card shadow="sm">
                        <Statistic
                            title="Last Successful Sync"
                            value={lastSync ?? 'Never'}
                            valueStyle={{ fontSize: '16px' }}
                            prefix={<CheckCircleOutlined className={lastSync ? "text-green-500" : "text-slate-300"} />}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="Database Status" className="mt-4">
                <Space orientation="vertical" className="w-full">
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <Space>
                            <Badge status="processing" />
                            <Text strong>Local Storage (Dexie.js)</Text>
                        </Space>
                        <Tag color="blue">Active</Tag>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <Space>
                            <Badge status={syncStats ? "success" : "default"} />
                            <Text strong>Cloud Backend (Supabase)</Text>
                        </Space>
                        <Tag color={syncStats ? "green" : "orange"}>{syncStats ? "Connected" : "Standby"}</Tag>
                    </div>
                </Space>
            </Card>

            {syncStats?.tableStatus && (
                <Card title="Table Details" className="mt-4">
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
                                    description={status.error ? <Text type="danger" size="small">Error: {status.error}</Text> : `Last synced: ${lastSync}`}
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            )}

            <Card title="How to Sync" className="mt-4">
                <Paragraph>
                    1. Ensure you have an active internet connection.<br />
                    2. Click <b>"Start Sync Now"</b> to upload any changes made on this desktop.<br />
                    3. This will also download any attendance or marks entered by teachers on their mobile devices.<br />
                    4. Once finished, navigate to the relevant pages to see the updated data.
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
