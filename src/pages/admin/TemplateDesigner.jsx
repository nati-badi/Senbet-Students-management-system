import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    Typography, Card, Button, Space, Upload, message, 
    Slider, Divider, Row, Col, Checkbox, Input, Badge,
    Table, Modal, Tag, Tooltip
} from 'antd';
import { 
    UploadOutlined, 
    EyeOutlined, 
    SaveOutlined, 
    DeleteOutlined,
    DragOutlined,
    EditOutlined,
    IdcardOutlined,
    FileTextOutlined
} from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useTranslation } from 'react-i18next';
import Draggable from 'react-draggable';
import { QRCodeSVG } from 'qrcode.react';

// Draggable wrapper with nodeRef for React 19 compatibility
const DraggableElement = ({ children, field, el, onDragStop, onSelect }) => {
    const nodeRef = React.useRef(null);
    return (
        <Draggable 
            nodeRef={nodeRef}
            position={{ x: el.x, y: el.y }}
            onStop={(e, data) => onDragStop(field, { x: data.x, y: data.y })}
            bounds="parent"
        >
            <div 
                ref={nodeRef} 
                className="absolute z-10 cursor-move"
                style={{ position: 'absolute' }}
                onMouseDown={onSelect}
            >
                {children}
            </div>
        </Draggable>
    );
};

const { Title, Text, Paragraph } = Typography;

export default function TemplateDesigner() {
    const { t } = useTranslation();
    const [templateType, setTemplateType] = useState('ID_CARD'); // ID_CARD or CERTIFICATE
    const [templateName, setTemplateName] = useState('New Template');
    const [currentTemplateId, setCurrentTemplateId] = useState(null);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [canvasWidth, setCanvasWidth] = useState(350); // Default ID width
    const [canvasHeight, setCanvasHeight] = useState(220); // Default ID height
    
    // Config stores positions and visibility of elements
    const [config, setConfig] = useState({
        elements: {
            photo: { visible: true, x: 20, y: 50, size: 80, rounded: false },
            name: { visible: true, x: 120, y: 60, fontSize: 16, color: '#000', bold: true },
            baptismalName: { visible: true, x: 120, y: 85, fontSize: 14, color: '#444', bold: false },
            grade: { visible: true, x: 120, y: 110, fontSize: 14, color: '#444', bold: false },
            studentId: { visible: true, x: 120, y: 135, fontSize: 14, color: '#444', bold: false },
            qrCode: { visible: true, x: 260, y: 130, size: 70 },
        }
    });

    const [editingField, setEditingField] = useState(null);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    
    // Load existing templates
    const templates = useLiveQuery(() => db.templates.toArray()) || [];
    const students = useLiveQuery(() => db.students.limit(1).toArray()) || [];
    const sampleStudent = students[0] || { 
        name: "Abebe Bikila", 
        baptismalName: "Haile Gabriel", 
        grade: "7", 
        id: "STU-123456",
        portalCode: "123456"
    };

    const canvasRef = useRef(null);

    useEffect(() => {
        if (templateType === 'CERTIFICATE') {
            setCanvasWidth(800);
            setCanvasHeight(560);
        } else {
            setCanvasWidth(350);
            setCanvasHeight(220);
        }
    }, [templateType]);

    const handleFileUpload = (info) => {
        const file = info.file;
        const reader = new FileReader();
        reader.onload = (e) => {
            setBackgroundImage(e.target.result);
        };
        reader.readAsDataURL(file);
        return false; // Prevent upload
    };

    const updateElement = (field, updates) => {
        setConfig(prev => ({
            ...prev,
            elements: {
                ...prev.elements,
                [field]: { ...prev.elements[field], ...updates }
            }
        }));
    };

    const handleSetDefault = async (id) => {
        try {
            await db.transaction('rw', db.templates, async () => {
                const template = await db.templates.get(id);
                if (!template) return;
                
                // Unset all other defaults for this type
                await db.templates.where('type').equals(template.type).modify({ isDefault: false, synced: 0 });
                // Set this one as default
                await db.templates.update(id, { isDefault: true, synced: 0 });
            });
            message.success(t('common.saveSuccess', 'Template set as default!'));
        } catch (err) {
            console.error(err);
            message.error(t('common.saveError', 'Failed to set default template'));
        }
    };

    const handleSaveTemplate = async () => {
        try {
            const id = currentTemplateId || crypto.randomUUID();
            const templateData = {
                id,
                type: templateType,
                name: templateName,
                config: {
                    ...config,
                    backgroundImage,
                    canvasWidth,
                    canvasHeight
                },
                isDefault: templates.length === 0,
                synced: 0
            };

            if (currentTemplateId) {
                await db.templates.update(id, templateData);
                message.success(t('common.saveSuccess', 'Template updated successfully!'));
            } else {
                await db.templates.add(templateData);
                message.success(t('common.saveSuccess', 'Template saved successfully!'));
                setCurrentTemplateId(id);
            }
        } catch (err) {
            console.error(err);
            message.error(t('common.saveError', 'Failed to save template'));
        }
    };

    const renderElement = (field, key) => {
        const el = config.elements[field];
        if (!el.visible) return null;

        let content;
        switch (field) {
            case 'photo':
                content = (
                    <div 
                        style={{ 
                            width: el.size, 
                            height: el.size, 
                            backgroundColor: '#e2e8f0', 
                            borderRadius: el.rounded ? '50%' : '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #cbd5e1'
                        }}
                    >
                        <IdcardOutlined style={{ fontSize: el.size / 2, color: '#94a3b8' }} />
                    </div>
                );
                break;
            case 'qrCode':
                content = (
                    <div style={{ padding: '4px', background: '#fff' }}>
                        <QRCodeSVG value={sampleStudent.portalCode || sampleStudent.id} size={el.size} />
                    </div>
                );
                break;
            case 'name':
                content = <span style={{ fontSize: el.fontSize, color: el.color, fontWeight: el.bold ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{sampleStudent.name}</span>;
                break;
            case 'baptismalName':
                content = <span style={{ fontSize: el.fontSize, color: el.color, fontWeight: el.bold ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{sampleStudent.baptismalName}</span>;
                break;
            case 'grade':
                content = <span style={{ fontSize: el.fontSize, color: el.color, fontWeight: el.bold ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>Grade: {sampleStudent.grade}</span>;
                break;
            case 'studentId':
                content = <span style={{ fontSize: el.fontSize, color: el.color, fontWeight: el.bold ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>ID: {sampleStudent.id}</span>;
                break;
            default:
                content = null;
        }

        return (
            <DraggableElement
                key={key}
                field={field}
                el={el}
                onDragStop={(e, data) => updateElement(field, { x: data.x, y: data.y })}
                onSelect={() => setEditingField(field)}
            >
                {content}
            </DraggableElement>
        );
    };

    return (
        <div className="flex flex-col gap-6 p-2">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <Space orientation="vertical">
                    <Title level={3} style={{ margin: 0 }}>{t('admin.templateDesigner', 'Template Designer')}</Title>
                    <Text type="secondary">{t('admin.templateDesignerDesc', 'Design custom ID cards and certificates for your school')}</Text>
                </Space>
                <Space>
                    <Button icon={<EyeOutlined />} onClick={() => setIsPreviewModalVisible(true)}>{t('admin.preview', 'Preview')}</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveTemplate}>{t('admin.saveTemplate', 'Save Template')}</Button>
                </Space>
            </div>

            <Row gutter={24}>
                <Col xs={24} lg={16}>
                    <Card className="rounded-2xl shadow-sm border-none overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-8 min-h-[500px]">
                        <div 
                            ref={canvasRef}
                            style={{ 
                                width: canvasWidth, 
                                height: canvasHeight, 
                                backgroundImage: `url(${backgroundImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundColor: '#fff',
                                position: 'relative',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                border: '1px dashed #cbd5e1'
                            }}
                        >
                            {Object.keys(config.elements).map(key => renderElement(key, key))}
                            {!backgroundImage && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                                    <UploadOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                                    <Text type="secondary">{t('admin.uploadBg', 'Upload Background Image')}</Text>
                                </div>
                            )}
                        </div>
                    </Card>
                    
                    <Card className="mt-4 rounded-2xl border-none shadow-sm" title={t('admin.templateList', 'Template List')}>
                        <Table 
                            dataSource={templates} 
                            rowKey="id"
                            columns={[
                                { title: t('admin.name', 'Name'), dataIndex: 'name', key: 'name' },
                                { title: t('admin.type', 'Type'), dataIndex: 'type', key: 'type', render: typeVal => <Tag color={typeVal === 'ID_CARD' ? 'blue' : 'green'}>{typeVal}</Tag> },
                                { 
                                    title: t('admin.status', 'Status'), 
                                    key: 'status', 
                                    render: (record) => (
                                        record.isDefault ? <Tag color="gold">{t('admin.default', 'Default')}</Tag> : <Button type="link" size="small" onClick={() => handleSetDefault(record.id)}>{t('admin.setDefault', 'Set Default')}</Button>
                                    ) 
                                },
                                {
                                    title: 'Actions',
                                    key: 'actions',
                                    render: (_, record) => (
                                        <Space>
                                            <Button size="small" icon={<EditOutlined />} onClick={() => {
                                                setCurrentTemplateId(record.id);
                                                setTemplateType(record.type);
                                                setTemplateName(record.name);
                                                setConfig(record.config);
                                                setBackgroundImage(record.config.backgroundImage);
                                                setCanvasWidth(record.config.canvasWidth || (record.type === 'ID_CARD' ? 350 : 800));
                                                setCanvasHeight(record.config.canvasHeight || (record.type === 'ID_CARD' ? 220 : 560));
                                            }} />
                                            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => db.templates.delete(record.id)} />
                                        </Space>
                                    )
                                }
                            ]}
                        />
                    </Card>
                </Col>

                <Col xs={24} lg={8}>
                    <div className="flex flex-col gap-4">
                        <Card title={t('admin.generalSettings', 'General Settings')} className="rounded-2xl border-none shadow-sm">
                            <Space orientation="vertical" className="w-full">
                                <Text strong>{t('admin.templateName', 'Template Name')}</Text>
                                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Standard ID Card 2026" />
                                
                                <Divider style={{ margin: '12px 0' }} />
                                
                                <Text strong>{t('admin.templateType', 'Template Type')}</Text>
                                <div className="flex gap-2">
                                    <Button 
                                        type={templateType === 'ID_CARD' ? 'primary' : 'default'} 
                                        block 
                                        icon={<IdcardOutlined />}
                                        onClick={() => setTemplateType('ID_CARD')}
                                    >
                                        {t('admin.idCard', 'ID Card')}
                                    </Button>
                                    <Button 
                                        type={templateType === 'CERTIFICATE' ? 'primary' : 'default'} 
                                        block 
                                        icon={<FileTextOutlined />}
                                        onClick={() => setTemplateType('CERTIFICATE')}
                                    >
                                        {t('admin.certificate', 'Certificate')}
                                    </Button>
                                </div>

                                <Divider style={{ margin: '12px 0' }} />

                                <Text strong>{t('admin.backgroundImage', 'Background Image')}</Text>
                                <Upload beforeUpload={handleFileUpload} showUploadList={false}>
                                    <Button icon={<UploadOutlined />} block>{t('admin.changeImage', 'Change Image')}</Button>
                                </Upload>
                                
                                {templateType === 'ID_CARD' ? (
                                    <Paragraph type="secondary" className="mt-2 text-xs">
                                        Tip: Use 1011x638 pixels for best ISO ID-1 print quality (85.6 x 53.98 mm).
                                    </Paragraph>
                                ) : (
                                    <Paragraph type="secondary" className="mt-2 text-xs">
                                        Tip: Use 3508x2480 pixels for A4 landscape print quality.
                                    </Paragraph>
                                )}
                            </Space>
                        </Card>

                        <Card title={t('admin.fieldCustomization', 'Field Customization')} className="rounded-2xl border-none shadow-sm">
                            <div className="max-h-[600px] overflow-y-auto pr-2">
                                {Object.keys(config.elements).map(key => {
                                    const field = config.elements[key];
                                    return (
                                        <div key={key} className={`p-3 mb-2 rounded-xl border transition-all ${editingField === key ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <Checkbox 
                                                    checked={field.visible} 
                                                    onChange={e => updateElement(key, { visible: e.target.checked })}
                                                >
                                                    <Text strong>{t(`admin.field.${key}`, key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'))}</Text>
                                                </Checkbox>
                                                <Tooltip title={t('admin.dragTooltip', 'Drag element on canvas to position')}>
                                                    <DragOutlined className="text-slate-400" />
                                                </Tooltip>
                                            </div>
                                            
                                            {field.visible && (
                                                <div className="mt-2 space-y-3 pl-6">
                                                    {(key === 'photo' || key === 'qrCode') ? (
                                                        <div>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>Size</Text>
                                                            <Slider 
                                                                min={20} 
                                                                max={key === 'photo' ? 200 : 150} 
                                                                value={field.size} 
                                                                onChange={val => updateElement(key, { size: val })} 
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div>
                                                                <Text type="secondary" style={{ fontSize: 12 }}>Font Size</Text>
                                                                <Slider 
                                                                    min={8} 
                                                                    max={48} 
                                                                    value={field.fontSize} 
                                                                    onChange={val => updateElement(key, { fontSize: val })} 
                                                                />
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <Checkbox 
                                                                    checked={field.bold} 
                                                                    onChange={e => updateElement(key, { bold: e.target.checked })}
                                                                >
                                                                    Bold
                                                                </Checkbox>
                                                                <input 
                                                                    type="color" 
                                                                    value={field.color} 
                                                                    onChange={e => updateElement(key, { color: e.target.value })}
                                                                    className="w-8 h-8 rounded border-none cursor-pointer"
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                    
                                                    {key === 'photo' && (
                                                        <Checkbox 
                                                            checked={field.rounded} 
                                                            onChange={e => updateElement(key, { rounded: e.target.checked })}
                                                        >
                                                            Rounded Circle
                                                        </Checkbox>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>
                </Col>
            </Row>

            <Modal
                title="Template Preview"
                open={isPreviewModalVisible}
                onCancel={() => setIsPreviewModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setIsPreviewModalVisible(false)}>Close</Button>,
                    <Button key="print" type="primary" onClick={() => window.print()}>Print Test</Button>
                ]}
                width={canvasWidth + 60}
            >
                <div className="bg-slate-50 p-4 flex justify-center">
                    <div 
                        style={{ 
                            width: canvasWidth, 
                            height: canvasHeight, 
                            backgroundImage: `url(${backgroundImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundColor: '#fff',
                            position: 'relative',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        {Object.keys(config.elements).map(key => {
                            const el = config.elements[key];
                            if (!el.visible) return null;
                            
                            let content;
                            if (key === 'photo') {
                                content = (
                                    <div style={{ 
                                        width: el.size, 
                                        height: el.size, 
                                        backgroundColor: '#e2e8f0', 
                                        borderRadius: el.rounded ? '50%' : '4px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '1px solid #cbd5e1'
                                    }}>
                                        <IdcardOutlined style={{ fontSize: el.size / 2, color: '#94a3b8' }} />
                                    </div>
                                );
                            } else if (key === 'qrCode') {
                                content = (
                                    <div style={{ padding: '4px', background: '#fff' }}>
                                        <QRCodeSVG value={sampleStudent.portalCode || sampleStudent.id} size={el.size} />
                                    </div>
                                );
                            } else {
                                const textMap = {
                                    name: sampleStudent.name,
                                    baptismalName: sampleStudent.baptismalName,
                                    grade: `Grade: ${sampleStudent.grade}`,
                                    studentId: `ID: ${sampleStudent.id}`
                                };
                                content = <span style={{ fontSize: el.fontSize, color: el.color, fontWeight: el.bold ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{textMap[key]}</span>;
                            }

                            return (
                                <div key={key} style={{ position: 'absolute', left: el.x, top: el.y }}>
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
