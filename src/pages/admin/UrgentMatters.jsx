import React, { useState, useMemo } from 'react';
import { Typography, Card, List, Avatar, Tag, Empty, Badge, Alert, Row, Col, Statistic, Button, Space, Tooltip, message, Modal, Input } from 'antd';
import { WarningOutlined, UserOutlined, ClockCircleOutlined, FormOutlined, AlertOutlined, KeyOutlined, CopyOutlined, PhoneOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import StudentProfile from '../../components/StudentProfile';
import { supabase } from '../../utils/supabaseClient';

const { Title, Text, Paragraph } = Typography;

export default function UrgentMatters() {
    const [profileStudentId, setProfileStudentId] = useState(null);
    const navigate = useNavigate();

    const students = useLiveQuery(() => db.students.toArray(), []) || [];
    const marks = useLiveQuery(() => db.marks.toArray(), []) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray(), []) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray(), []) || [];

    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    const currentSemester = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    // Grades that have at least one assessment configured (any semester)
    const activeGrades = useMemo(() => {
        const set = new Set();
        assessments.forEach(a => {
            if (a.grade) {
                set.add(String(a.grade).trim());
                set.add(normalizeGrade(a.grade));
            }
        });
        return set;
    }, [assessments]);

    // Students missing critical info - Scoped to active grades
    const missingInfoStudents = useMemo(() => students.filter(s => {
        if (!s.grade) return false; 
        const isGradeActive = activeGrades.has(String(s.grade).trim()) || activeGrades.has(normalizeGrade(s.grade));
        if (!isGradeActive) return false;
        return !s.name || (!s.baptismalName && !s.baptismalname) || (!s.parentContact && !s.parentcontact) || (!s.portalCode && !s.portalcode);
    }), [students, activeGrades]);

    const isConduct = (a) => {
        const sName = (a.subjectName || '').toLowerCase();
        const aName = (a.name || '').toLowerCase();
        return sName.includes('conduct') || sName.includes('attitude') || aName.includes('conduct') || aName.includes('attitude');
    };

    // Students with INCOMPLETE marks in ACTIVE SEMESTER assessments
    const incompleteMarksStudents = useMemo(() => {
        const activeAssessments = assessments.filter(a => {
            if (isConduct(a)) return false;
            const subject = subjects.find(sp => sp.name === a.subjectName);
            return (subject?.semester || 'Semester I') === currentSemester;
        });
        if (activeAssessments.length === 0) return [];

        const activeAssessmentIds = new Set(activeAssessments.map(a => a.id));

        // Count assessments per grade (normalized)
        const gradeAssessmentCount = {};
        activeAssessments.forEach(a => {
            const g = normalizeGrade(a.grade);
            gradeAssessmentCount[g] = (gradeAssessmentCount[g] || 0) + 1;
        });

        // Count marks per student in those active assessments
        const studentMarkCount = {};
        marks.forEach(m => {
            if (activeAssessmentIds.has(m.assessmentId)) {
                studentMarkCount[m.studentId] = (studentMarkCount[m.studentId] || 0) + 1;
            }
        });
        
        return students.filter(s => {
            if (!s.grade) return false;
            const gn = normalizeGrade(s.grade);
            const isGradeActive = activeGrades.has(String(s.grade).trim()) || activeGrades.has(gn);
            if (!isGradeActive) return false;

            const expectedCount = gradeAssessmentCount[gn] || 0;
            if (expectedCount === 0) return false;

            const actualCount = studentMarkCount[s.id] || 0;
            return actualCount < expectedCount;
        });
    }, [students, marks, assessments, subjects, currentSemester, activeGrades]);

    // Students missing portal codes - Show ALL students missing codes regardless of grade activity
    const missingPortalCode = useMemo(() => students.filter(s => {
        const code = s.portalCode || s.portalcode;
        return !code || String(code).trim() === '';
    }), [students]);

    const totalIssues = missingInfoStudents.length + missingPortalCode.length + incompleteMarksStudents.length;

    const usedPortalCodes = useMemo(() => {
        const set = new Set();
        for (const s of students) {
            const code = s.portalCode || s.portalcode;
            if (code) set.add(String(code).trim());
        }
        return set;
    }, [students]);

    const generateUniquePortalCode = (used) => {
        for (let i = 0; i < 50; i++) {
            const code = String(Math.floor(100000 + Math.random() * 900000));
            if (!used.has(code)) return code;
        }
        return String(Date.now()).slice(-6);
    };

    const avatarStyle = (bg, fg, border) => ({
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${border}`,
        boxShadow: '0 6px 18px rgba(2, 6, 23, 0.08)',
    });

    const copyToClipboard = async (text, successMsg) => {
        const val = String(text || '').trim();
        if (!val || val === 'null' || val === 'undefined') {
            message.warning('No valid data to copy');
            return;
        }
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(val);
                message.success(successMsg);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = val;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                message.success(successMsg);
            }
        } catch (e) {
            message.error('Copy failed');
        }
    };

    const generatePortalCode = async (studentId) => {
        const code = generateUniquePortalCode(usedPortalCodes);
        await db.students.update(studentId, { 
            portalCode: code, 
            synced: 0,
            updated_at: new Date().toISOString()
        });
        return code;
    };

    const generateAllPortalCodes = async () => {
        if (missingPortalCode.length === 0) return;
        try {
            const used = new Set(usedPortalCodes);
            let updated = 0;
            for (const s of missingPortalCode) {
                const code = generateUniquePortalCode(used);
                used.add(code);
                await db.students.update(s.id, { 
                    portalCode: code, 
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                updated++;
            }
            message.success(`Generated ${updated} portal code${updated !== 1 ? 's' : ''}`);
        } catch (e) {
            message.error('Failed to generate portal codes');
        }
    };


    const goToRegisterAndSearch = (name) => {
        navigate('/admin/register');
        try {
            sessionStorage.setItem('admin_students_search', String(name || ''));
        } catch {
            // ignore
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                    <WarningOutlined className="text-2xl text-red-500" />
                </div>
                <div>
                    <Title level={2} style={{ margin: 0 }}>Urgent Matters</Title>
                    <Text type="secondary">Items that need your immediate attention</Text>
                </div>
            </div>

            {totalIssues === 0 ? (
                <Alert
                    message="Everything looks great!"
                    description="No urgent matters found. All students have complete data and portal access codes."
                    type="success"
                    showIcon
                    className="rounded-2xl border-none shadow-sm"
                />
            ) : (
                <Alert
                    message={`${totalIssues} issue${totalIssues !== 1 ? 's' : ''} require your attention`}
                    type="error"
                    showIcon
                    icon={<AlertOutlined />}
                    className="rounded-xl border-none shadow-sm"
                />
            )}

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <Card className="rounded-2xl border-none shadow-sm bg-red-50 dark:bg-red-900/20 text-center">
                        <Statistic
                            title={<span className="text-red-600 font-bold">Missing Student Info</span>}
                            value={missingInfoStudents.length}
                            valueStyle={{ color: '#dc2626', fontWeight: 'bold', fontSize: '2.5rem' }}
                            prefix={<FormOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card className="rounded-2xl border-none shadow-sm bg-orange-50 dark:bg-orange-900/20 text-center">
                        <Statistic
                            title={<span className="text-orange-600 font-bold">No Portal Code</span>}
                            value={missingPortalCode.length}
                            valueStyle={{ color: '#ea580c', fontWeight: 'bold', fontSize: '2.5rem' }}
                            prefix={<UserOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card className="rounded-2xl border-none shadow-sm bg-yellow-50 dark:bg-yellow-900/20 text-center cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => navigate('/assessments')}>
                        <Statistic
                            title={<span className="text-yellow-700 font-bold">Incomplete Marks</span>}
                            value={incompleteMarksStudents.length}
                            valueStyle={{ color: '#ca8a04', fontWeight: 'bold', fontSize: '2.5rem' }}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {missingInfoStudents.length > 0 && (
                <Card
                    title={
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                                <FormOutlined className="text-red-500" />
                            </div>
                            <span className="font-bold">Students with Missing Information</span>
                            <Badge count={missingInfoStudents.length} color="red" />
                        </div>
                    }
                    className="rounded-2xl border-l-4 border-l-red-500 shadow-sm"
                >
                    <List
                        dataSource={missingInfoStudents}
                        rowKey="id"
                        renderItem={student => {
                            const missing = [];
                            if (!student.name) missing.push('Name');
                            if (!student.baptismalName && !student.baptismalname) missing.push('Baptismal Name');
                            if (!student.grade) missing.push('Grade');
                            if (!student.parentContact && !student.parentcontact) missing.push('Contact');
                            if (!student.portalCode && !student.portalcode) missing.push('Portal Code');
                            return (
                                <List.Item 
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-4 rounded-lg"
                                    actions={[
                                        !student.portalCode && (
                                            <Tooltip key="gen" title="Generate portal code">
                                                <Button
                                                    size="small"
                                                    icon={<KeyOutlined />}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const code = await generatePortalCode(student.id);
                                                        message.success(`Portal code created: ${code}`);
                                                    }}
                                                >
                                                    Generate code
                                                </Button>
                                            </Tooltip>
                                        ),
                                        (student.parentContact || student.parentcontact) && (
                                            <Tooltip key="call" title="Call parent">
                                                <Button
                                                    size="small"
                                                    icon={<PhoneOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const contact = student.parentContact || student.parentcontact;
                                                        if (contact) window.open(`tel:${contact}`, '_self');
                                                    }}
                                                >
                                                    Call
                                                </Button>
                                            </Tooltip>
                                        ),
                                        (student.parentContact || student.parentcontact) && (
                                            <Tooltip key="copy" title="Copy parent contact">
                                                <Button
                                                    size="small"
                                                    icon={<CopyOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const contact = student.parentContact || student.parentcontact;
                                                        if (contact) void copyToClipboard(contact, 'Contact copied');
                                                    }}
                                                />
                                            </Tooltip>
                                        ),
                                        <Button
                                            key="fix"
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                goToRegisterAndSearch(student.name);
                                            }}
                                        >
                                            Fix now
                                        </Button>,
                                        <Button
                                            key="view"
                                            type="link"
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setProfileStudentId(student.id);
                                            }}
                                        >
                                            View
                                        </Button>
                                    ].filter(Boolean)}
                                    onClick={() => setProfileStudentId(student.id)}
                                >
                                    <List.Item.Meta
                                        avatar={
                                            <Avatar
                                                size={44}
                                                icon={<FormOutlined />}
                                                style={avatarStyle('#fef2f2', '#b91c1c', '#fca5a5')}
                                            />
                                        }
                                        title={<span className="font-bold">{student.name || <Text type="danger">No Name</Text>}</span>}
                                        description={
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {missing.map(field => (
                                                    <Tag key={field} color="error" className="text-xs">Missing: {field}</Tag>
                                                ))}
                                                {student.grade && <Tag color="green">{formatGrade(student.grade)}</Tag>}
                                            </div>
                                        }
                                    />
                                </List.Item>
                            );
                        }}
                        pagination={{ pageSize: 5 }}
                    />
                </Card>
            )}

            {missingPortalCode.length > 0 && (
                <Card
                    title={
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                                <UserOutlined className="text-orange-500" />
                            </div>
                            <span className="font-bold">Students Without Portal Access Code</span>
                            <Badge count={missingPortalCode.length} color="orange" />
                        </div>
                    }
                    className="rounded-2xl border-l-4 border-l-orange-500 shadow-sm"
                    extra={
                        <Space wrap>
                            <Button size="small" icon={<KeyOutlined />} onClick={generateAllPortalCodes}>
                                Generate all
                            </Button>
                            <Text type="secondary" className="text-sm">
                                Bulk-generate missing codes
                            </Text>
                        </Space>
                    }
                >
                    <Paragraph type="secondary" className="mb-4">
                        These students' parents cannot log in to the Parent Portal. Assign portal access codes from the Student Registration page.
                    </Paragraph>
                    <List
                        dataSource={missingPortalCode}
                        rowKey="id"
                        renderItem={student => (
                            <List.Item
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-4 rounded-lg"
                                actions={[
                                    <Tooltip key="gen" title="Generate access code">
                                        <Button
                                            size="small"
                                            icon={<KeyOutlined />}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const code = await generatePortalCode(student.id);
                                                message.success(`Portal code created: ${code}`);
                                            }}
                                        >
                                            Generate
                                        </Button>
                                    </Tooltip>,
                                    (student.parentContact || student.parentcontact) && (
                                        <Tooltip key="call" title="Call parent">
                                            <Button
                                                size="small"
                                                icon={<PhoneOutlined />}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const contact = student.parentContact || student.parentcontact;
                                                    if (contact) window.open(`tel:${contact}`, '_self');
                                                }}
                                            >
                                                Call
                                            </Button>
                                        </Tooltip>
                                    ),
                                    (student.parentContact || student.parentcontact) && (
                                        <Tooltip key="copy" title="Copy parent contact">
                                            <Button
                                                size="small"
                                                icon={<CopyOutlined />}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const contact = student.parentContact || student.parentcontact;
                                                    if (contact) void copyToClipboard(contact, 'Contact copied');
                                                }}
                                            />
                                        </Tooltip>
                                    ),
                                    <Button
                                        key="view"
                                        type="link"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProfileStudentId(student.id);
                                        }}
                                    >
                                        View
                                    </Button>
                                ]}
                                onClick={() => setProfileStudentId(student.id)}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            size={44}
                                            icon={<UserOutlined />}
                                            style={avatarStyle('#fff7ed', '#c2410c', '#fdba74')}
                                        />
                                    }
                                    title={<span className="font-bold">{student.name}</span>}
                                    description={<div><Tag color="green">{formatGrade(student.grade)}</Tag> <Text type="secondary">{student.parentContact || student.parentcontact}</Text></div>}
                                />
                            </List.Item>
                        )}
                        pagination={{ pageSize: 5 }}
                    />
                </Card>
            )}

            {incompleteMarksStudents.length > 0 && (
                <Card
                    title={
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-yellow-100 rounded-xl flex items-center justify-center">
                                <ClockCircleOutlined className="text-yellow-600" />
                            </div>
                            <span className="font-bold">Students with Incomplete Marks</span>
                            <Badge count={incompleteMarksStudents.length} color="gold" />
                        </div>
                    }
                    className="rounded-2xl border-l-4 border-l-yellow-500 shadow-sm"
                >
                    <Paragraph type="secondary" className="mb-4">
                        These students have missing assessment marks for <Text strong>{currentSemester}</Text>. Use the Teacher Portal or Mark Entry to record their scores.
                    </Paragraph>
                    <List
                        dataSource={incompleteMarksStudents}
                        rowKey="id"
                        renderItem={student => (
                            <List.Item 
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-4 rounded-lg"
                                actions={[
                                    <Button
                                        key="open"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/teacher');
                                        }}
                                    >
                                        Open mark entry
                                    </Button>,
                                    <Button
                                        key="view"
                                        type="link"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setProfileStudentId(student.id);
                                        }}
                                    >
                                        View
                                    </Button>
                                ]}
                                onClick={() => setProfileStudentId(student.id)}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            size={44}
                                            icon={<ClockCircleOutlined />}
                                            style={avatarStyle('#fefce8', '#a16207', '#fde68a')}
                                        />
                                    }
                                    title={<span className="font-bold">{student.name}</span>}
                                    description={<Tag color="green">{formatGrade(student.grade)}</Tag>}
                                />
                            </List.Item>
                        )}
                        pagination={{ pageSize: 5 }}
                    />
                </Card>
            )}

            {totalIssues === 0 && (
                <Card className="rounded-2xl border-none shadow-sm">
                    <Empty description="No urgent matters found. All records are in order." />
                </Card>
            )}


            <StudentProfile 
                studentId={profileStudentId} 
                visible={!!profileStudentId} 
                onClose={() => setProfileStudentId(null)} 
            />
        </div>
    );
}
