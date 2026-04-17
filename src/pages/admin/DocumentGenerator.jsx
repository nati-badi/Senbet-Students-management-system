import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FilePdfOutlined, IdcardOutlined, UserOutlined, AlertOutlined, EyeOutlined } from '@ant-design/icons';
import { Typography, Card, Select, Button, Space, Modal, List, Tag, Alert, Progress, Divider, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import { QRCodeCanvas } from 'qrcode.react';
import { db } from '../../db/database';
import { formatEthiopianDate, getEthiopianYear } from '../../utils/dateUtils';
import { normalizeGrade } from '../../utils/gradeUtils';
import { calculateRankings, calculateSubjectRows, isConductAssessment } from '../../utils/analyticsEngine';


const { Title, Text } = Typography;

const EthiopianCross = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
        <rect x="42" y="42" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"/>
        <circle cx="50" cy="50" r="4" fill="currentColor"/>
        
        <path d="M42 42 L42 20 L30 15 L50 0 L70 15 L58 20 L58 42" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="50" cy="8" r="2.5" fill="currentColor"/>
        <circle cx="35" cy="18" r="2" fill="currentColor"/>
        <circle cx="65" cy="18" r="2" fill="currentColor"/>

        <path d="M42 58 L42 80 L30 85 L50 100 L70 85 L58 80 L58 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="50" cy="92" r="2.5" fill="currentColor"/>
        <circle cx="35" cy="82" r="2" fill="currentColor"/>
        <circle cx="65" cy="82" r="2" fill="currentColor"/>

        <path d="M42 42 L20 42 L15 30 L0 50 L15 70 L20 58 L42 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="8" cy="50" r="2.5" fill="currentColor"/>
        <circle cx="18" cy="35" r="2" fill="currentColor"/>
        <circle cx="18" cy="65" r="2" fill="currentColor"/>

        <path d="M58 42 L80 42 L85 30 L100 50 L85 70 L80 58 L58 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="92" cy="50" r="2.5" fill="currentColor"/>
        <circle cx="82" cy="35" r="2" fill="currentColor"/>
        <circle cx="82" cy="65" r="2" fill="currentColor"/>
    </svg>
);

export default function DocumentGenerator({ type }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [validationReport, setValidationReport] = useState(null);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState("");
    const [successModal, setSuccessModal] = useState({ open: false, count: 0, fileName: '' });
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const lastGeneratedPath = useRef(null);

    // Path tracking for session (optional, kept for internal logic if needed)
    useEffect(() => {
        // The previous notification click listener was removed as it was incompatible with some Windows configurations.
        // File opening is now handled directly via the "Open File" button in the Success Modal.
    }, []);
    
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const marks = useLiveQuery(() => db.marks.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const settings = useLiveQuery(() => db.settings.toArray()) || [];

    const activeAcademicYear = useMemo(() => settings.find(s => s.key === 'currentAcademicYear')?.value || '-', [settings]);
    const activeSemester = useMemo(() => settings.find(s => s.key === 'currentSemester')?.value || 'Semester I', [settings]);

    const normalizeGradeLocal = (g) => normalizeGrade(g);
    const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);
    const gradeStudents = students.filter(s => s.grade === selectedGrade);

    // Centralized Ranking for all students in the selected grade
    const rankMap = useMemo(() => {
        if (!selectedGrade || selectedGrade === 'All') return {};
        
        const studentGradeNorm = normalizeGrade(selectedGrade);
        const gradeAssesses = assessments.filter(a => {
            if (normalizeGrade(a.grade) !== studentGradeNorm) return false;
            if (isConductAssessment(a)) return false;

            const subject = subjects.find(s => s.name === a.subjectName || s.name === a.subjectname);
            const subjSem = subject?.semester || 'Semester I';
            if (activeSemester === 'Semester I') return subjSem === 'Semester I';
            return true;
        });

        if (gradeAssesses.length === 0) return {};

        const studentsInGrade = students.filter(s => normalizeGrade(s.grade) === studentGradeNorm);
        const rankings = calculateRankings(studentsInGrade, gradeAssesses, marks);
        
        const map = {};
        studentsInGrade.forEach(s => {
            const studentStats = rankings.find(r => r.id === s.id);
            const classRankings = rankings.filter(r => r.grade === s.grade);

            let overallRank = 'N/A';
            let classRank = 'N/A';

            if (studentStats) {
                // Standard Competition Ranking: Rank = 1 + (number of peers strictly ahead)
                overallRank = 1 + rankings.filter(r => r.percentage > studentStats.percentage).length;
                classRank = 1 + classRankings.filter(r => r.percentage > studentStats.percentage).length;
            }
            
            map[s.id] = { 
                classRank, 
                overallRank, 
                totalInClass: classRankings.length, 
                totalInGrade: rankings.length,
                stats: studentStats || null
            };
        });
        return map;
    }, [selectedGrade, students, assessments, marks, subjects, activeSemester]);

    const validateGradeData = () => {
        const studentGradeNorm = normalizeGrade(selectedGrade);
        const gradeAssesses = assessments.filter(a => {
            if (normalizeGrade(a.grade) !== studentGradeNorm) return false;
            if (isConductAssessment(a)) return false;

            const subjObj = subjects.find(subj => subj.name === a.subjectName || subj.name === a.subjectname);
            const isSem1 = (subjObj?.semester || 'Semester I') === 'Semester I';
            if (activeSemester === 'Semester I') return isSem1;
            return true; // Sem 2 includes everything
        });

        const report = { ready: [], incomplete: [] };

        gradeStudents.forEach(student => {
            const issues = [];
            const studentMarks = marks.filter(m => m.studentId === student.id);
            
            // 1. Mark Completeness
            gradeAssesses.forEach(a => {
                const hasMark = studentMarks.some(m => m.assessmentId === a.id);
                if (!hasMark) {
                    issues.push(`Missing mark: ${a.subjectName} - ${a.name}`);
                }
            });

            // 2. Critical Info
            if (!student.name) issues.push("Missing full name");

            if (issues.length > 0) {
                report.incomplete.push({ student, issues });
            } else {
                report.ready.push(student);
            }
        });

        return report;
    };

    const handleGenerate = async (targetStudents = null) => {
        const studentsToProcess = Array.isArray(targetStudents) ? targetStudents : gradeStudents;
        if (!selectedGrade || studentsToProcess.length === 0) return;
        
        const isIdCard = type === 'id-card';

        // 1. Validation Logic
        if (!Array.isArray(targetStudents) && !isIdCard) {
            const report = validateGradeData();
            if (report.incomplete.length > 0) {
                setValidationReport(report);
                setIsValidationModalOpen(true);
                return;
            }
        }

        const fileName = `Senbet_${type === 'id-card' ? 'ID_Cards' : 'Certificates'}_${selectedGrade}.pdf`;
        let savedFilePath = null;
        let shellOpen = null;

        // 2. Ask WHERE to save FIRST (before any rendering)
        if (window.__TAURI_INTERNALS__) {
            try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const filePath = await save({
                    defaultPath: fileName,
                    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
                    title: 'Save Generated Documents',
                });

                if (!filePath) {
                    // User cancelled — do nothing
                    return;
                }
                savedFilePath = filePath;

                // Pre-load shell open for later
                const shellModule = await import('@tauri-apps/plugin-shell');
                shellOpen = shellModule.open;
            } catch (dialogErr) {
                console.warn("Tauri dialog failed, will fall back to browser download:", dialogErr);
            }
        }

        // 3. Start the rendering progress
        setIsGenerating(true);
        setStatusMsg("Loading localized fonts...");
        setProgress(5);

        try {
            // CRITICAL: Ensure all fonts (Noto Sans Ethiopic) are loaded before capturing
            // This prevents misalignment of text bounding boxes in the canvas
            if (document.fonts) {
                await document.fonts.ready;
            }

            const doc = new jsPDF({
                orientation: isIdCard ? 'l' : 'p',
                unit: 'mm',
                format: isIdCard ? [86, 54] : 'a4'
            });

            // High-Fidelity Rendering Loop
            for (let i = 0; i < studentsToProcess.length; i++) {
                const student = studentsToProcess[i];
                setStatusMsg(`Rendering ${student.name} (${i + 1}/${studentsToProcess.length})...`);
                setProgress(Math.floor(10 + ((i / studentsToProcess.length) * 80)));
                
                // Allow UI to breathe
                await new Promise(resolve => setTimeout(resolve, 50));

                const element = document.getElementById(`temp-${type}-${student.id}`);
                if (!element) {
                    console.warn(`Template not found for student ${student.id}`);
                    continue;
                }

                const canvas = await html2canvas(element, {
                    scale: 1.5, 
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff', // Ensures JPEG background works correctly
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.85); // Use JPEG compression to fix Out of Memory limits
                const pdfWidth = doc.internal.pageSize.getWidth();
                const imgProps = doc.getImageProperties(imgData);
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                if (i > 0) doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                
                // Explicitly clear canvas to free memory
                canvas.width = 0; 
                canvas.height = 0;
            }

            // 4. Save the file
            setStatusMsg("Saving file...");
            setProgress(95);

            if (savedFilePath && window.__TAURI_INTERNALS__) {
                // --- Native Tauri Write ---
                try {
                    const { writeFile } = await import('@tauri-apps/plugin-fs');
                    const pdfBytes = doc.output('arraybuffer');
                    await writeFile(savedFilePath, new Uint8Array(pdfBytes));
                } catch (writeErr) {
                    console.warn("Tauri write failed, falling back to browser download:", writeErr);
                    doc.save(fileName);
                    savedFilePath = null;
                }
            } else {
                // --- Browser Fallback ---
                doc.save(fileName);
            }

            setProgress(100);
            setStatusMsg("Download ready.");
            setIsValidationModalOpen(false);
            setSuccessModal({ open: true, count: studentsToProcess.length, fileName: savedFilePath || fileName });
            
            // Store path for notification click handler
            if (savedFilePath) {
                lastGeneratedPath.current = savedFilePath;
            }

            // 5. Notification + Auto-open (only for native saves)
            if (savedFilePath && window.__TAURI_INTERNALS__) {
                try {
                    const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
                    console.log("[Notification] Plugin loaded successfully");
                    
                    let permissionGranted = await isPermissionGranted();
                    console.log("[Notification] Permission status:", permissionGranted);
                    
                    if (!permissionGranted) {
                        const permission = await requestPermission();
                        console.log("[Notification] Permission request result:", permission);
                        permissionGranted = permission === 'granted';
                    }
                    if (permissionGranted) {
                        const docName = type === 'id-card' ? 'Student ID Cards' : 'Certificates';
                        const gradeText = selectedGrade && selectedGrade !== 'All' ? selectedGrade : 'all selected students';
                        
                        console.log("[Notification] Sending notification now...");
                        sendNotification({ 
                            id: `gen-${Date.now()}`,
                            title: 'Senbet Students Management System', 
                            body: `Download Complete! Successfully generated ${studentsToProcess.length} ${docName} for ${gradeText}. Saved to: ${savedFilePath}`,
                            extra: { filePath: savedFilePath }
                        });
                        console.log("[Notification] Notification sent!");
                    } else {
                        console.warn("[Notification] Permission denied");
                    }
                } catch (notifyErr) {
                    console.error("[Notification] Error:", notifyErr);
                }

                // Auto-open the PDF
                if (shellOpen) {
                    try {
                        await shellOpen(savedFilePath);
                    } catch (openErr) {
                        console.log("Could not auto-open file:", openErr);
                    }
                }
            }
        } catch (err) {
            console.error("PDF Gen Error:", err);
            message.error("Failed to generate documents.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;600;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                .cert-container { font-family: 'Inter', sans-serif; }
                .cert-amharic { font-family: 'Noto Sans Ethiopic', 'Inter', sans-serif; }
                .cert-serif { font-family: 'Playfair Display', serif; }

                /* Utility Classes */
                .cert-label {
                    font-size: 12px;
                    text-transform: uppercase;
                    color: #666;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    display: block;
                    margin-bottom: 4px;
                }
                .cert-label-sm {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #666;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    display: block;
                    margin-bottom: 2px;
                }
                .cert-value {
                    font-weight: 700;
                    color: #1A1A1A;
                }
                .cert-card {
                    background: #fff;
                    border-radius: 16px;
                    border: 1px solid rgba(201,162,39,0.2);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.05);
                    z-index: 10;
                }
                .cert-th {
                    padding: 14px 12px;
                    text-align: center;
                    color: #111;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    border-bottom: 2px solid #D1D5DB;
                    background-color: #FAFAFA;
                    border-right: 1px solid #eee;
                }
                .cert-th:last-child { border-right: none; }
                .cert-td {
                    padding: 14px 12px;
                    border-right: 1px solid #f0f0f0;
                }
                .cert-td:last-child { border-right: none; }
                .cert-badge {
                    display: inline-block;
                    min-width: 48px;
                    height: 30px;
                    line-height: 30px;
                    padding: 0 10px;
                    border-radius: 6px;
                    font-weight: 900;
                    font-size: 15px;
                    letter-spacing: 0.03em;
                    text-align: center;
                    vertical-align: middle;
                    box-sizing: border-box;
                }
                .cert-sig-title {
                    font-size: 10px;
                    font-weight: 800;
                    color: #1A1A1A;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 2px;
                }
                .cert-sig-name {
                    font-size: 10px;
                    font-weight: 600;
                    color: #666;
                    letter-spacing: 0.1em;
                }
            `}</style>
            <div className="max-w-[600px]">
                <Title level={2}>{type === 'id-card' ? t('admin.idCardGenerator') : t('admin.finalCertificates')}</Title>
                <Text type="secondary">{type === 'id-card' ? t('admin.idCardDesc') : t('admin.generatorDesc')}</Text>


                <Card className="mt-6 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                    <Space orientation="vertical" className="w-full" size="middle">
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: '8px' }}>{t('admin.selectGradeCerts')}</Text>
                            <Select
                                placeholder={t('teacher.selectGrade')}
                                value={selectedGrade}
                                onChange={setSelectedGrade}
                                style={{ width: '100%' }}
                                size="large"
                                options={uniqueGrades.map(g => ({ value: g, label: g }))}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                icon={<EyeOutlined />}
                                size="large"
                                style={{ width: '40%' }}
                                disabled={!selectedGrade || gradeStudents.length === 0}
                                onClick={() => setIsPreviewOpen(true)}
                            >
                                {t('common.preview', 'Preview')}
                            </Button>
                            <Button
                                type="primary"
                                icon={<FilePdfOutlined />}
                                size="large"
                                style={{ flex: 1 }}
                                disabled={!selectedGrade || gradeStudents.length === 0}
                                loading={isGenerating}
                                onClick={() => handleGenerate()}
                            >
                                {type === 'id-card' ? t('admin.downloadIDCards') : t('admin.downloadAllCertificates')}
                            </Button>
                        </div>
                        
                        {isGenerating && (
                            <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-2">
                                    <Text strong className="text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                                        {statusMsg}
                                    </Text>
                                    <Text className="text-xs font-mono text-blue-600 font-bold">{progress}%</Text>
                                </div>
                                <Progress 
                                    percent={progress} 
                                    status="active" 
                                    strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                                    showInfo={false}
                                />
                            </div>
                        )}
                    </Space>
                </Card>
            </div>

            <div className="opacity-0 pointer-events-none fixed top-[5000px] left-0">
                {gradeStudents.map(student => (
                    <div key={student.id} id={`temp-${type}-${student.id}`} 
                        className="html2canvas-safe-zone"
                        style={{ 
                            width: type === 'id-card' ? '86mm' : '210mm',
                            height: 'auto',
                            padding: '0', // Removed 10px padding that caused content shifting
                            margin: '0',
                            background: 'white',
                            color: 'black',
                            boxSizing: 'border-box'
                        }}>
                        {type === 'id-card' ? (
                            <IDCardTemplate student={student} />
                        ) : (
                            // CertificateTemplate is now largely replaced by direct jsPDF drawing in handleGenerate
                            // This component might still be used for visual preview or if some parts are still HTML-rendered
                            <CertificateTemplate 
                                student={student} 
                                marks={marks.filter(m => m.studentId === student.id)} 
                                subjects={subjects}
                                assessments={assessments}
                                semester={activeSemester}
                                rankMap={rankMap}
                            />
                        )}
                    </div>
                ))}
            </div>
            <Modal
                title={
                    <div className="flex items-center gap-2 text-orange-600 font-serif">
                        <AlertOutlined />
                        <span className="text-lg font-bold">Data Readiness Report</span>
                    </div>
                }
                open={isValidationModalOpen}
                onCancel={() => setIsValidationModalOpen(false)}
                width={700}
                footer={[
                    <Button key="cancel" onClick={() => setIsValidationModalOpen(false)}>
                        {t('common.cancel', 'Cancel')}
                    </Button>,
                    <Button 
                        key="proceed" 
                        type="primary" 
                        danger 
                        onClick={() => handleGenerate(validationReport.ready)}
                        disabled={validationReport?.ready.length === 0}
                    >
                        Generate for {validationReport?.ready.length || 0} Ready Students
                    </Button>
                ]}
            >
                <div className="flex flex-col gap-4 py-4">
                    <Alert
                        message="Incomplete Data Detected"
                        description={`${validationReport?.incomplete.length} students have missing marks or information. Results for these students will be inaccurate.`}
                        type="warning"
                        showIcon
                    />
                    
                    <div className="max-h-[400px] overflow-y-auto mt-2">
                        <List
                            header={<Text strong>Students with Issues</Text>}
                            dataSource={validationReport?.incomplete || []}
                            renderItem={item => (
                                <List.Item className="flex flex-col !items-start gap-1 py-3 border-b border-slate-100">
                                    <Text strong className="text-slate-900">{item.student.name}</Text>
                                    <div className="flex flex-wrap gap-1">
                                        {item.issues.map((issue, idx) => (
                                            <Tag key={idx} color="red" className="text-[10px]">{issue}</Tag>
                                        ))}
                                    </div>
                                </List.Item>
                            )}
                        />
                    </div>

                    {validationReport?.ready.length === 0 && (
                        <Alert 
                            type="error"
                            message="No Complete Data Found"
                            description="All students in this grade have missing information. Please resolve the issues in the Mark Entry or Student Registration tabs."
                        />
                    )}
                </div>
            </Modal>

            {/* Preview Modal — renders the same template used for PDF generation */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <EyeOutlined className="text-blue-500" />
                        <span className="text-slate-900 dark:text-white font-bold">{t('common.documentPreview', 'Document Preview')}</span>
                    </div>
                }
                open={isPreviewOpen}
                onCancel={() => setIsPreviewOpen(false)}
                width={type === 'id-card' ? 500 : 850}
                footer={[
                    <Button key="close" onClick={() => setIsPreviewOpen(false)}>
                        {t('common.close', 'Close')}
                    </Button>,
                    <Button 
                        key="gen" 
                        type="primary" 
                        icon={<FilePdfOutlined />} 
                        onClick={() => {
                            setIsPreviewOpen(false);
                            handleGenerate();
                        }}
                    >
                        {t('common.generateNow', 'Generate Now')}
                    </Button>
                ]}
                centered
                styles={{ body: { padding: 0, backgroundColor: '#f1f5f9', overflow: 'hidden' } }}
            >
                <div style={{ 
                    maxHeight: '80vh', 
                    overflowY: 'auto', 
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    {gradeStudents.length > 0 ? (
                        <div style={{ 
                            transform: type === 'id-card' ? 'scale(1.1)' : 'scale(0.8)', 
                            transformOrigin: 'top center',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                            backgroundColor: '#fff',
                            borderRadius: type === 'id-card' ? '12px' : '0',
                            marginBottom: type === 'id-card' ? '20px' : '-100px' // Compensate for scale whitespace
                        }}>
                             {type === 'id-card' ? (
                                <IDCardTemplate student={gradeStudents[0]} />
                            ) : (
                                <CertificateTemplate 
                                    student={gradeStudents[0]} 
                                    marks={marks.filter(m => m.studentId === gradeStudents[0].id)} 
                                    subjects={subjects}
                                    assessments={assessments}
                                    semester={activeSemester}
                                    rankMap={rankMap}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-slate-400">
                            {t('admin.noPreviewAvailable', 'No preview available.')}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Success Confirmation Modal — rendered inside ConfigProvider for automatic dark mode */}
            <Modal
                open={successModal.open}
                onOk={() => setSuccessModal(s => ({ ...s, open: false }))}
                onCancel={() => setSuccessModal(s => ({ ...s, open: false }))}
                centered
                destroyOnClose
                footer={[
                    <Button key="close" onClick={() => setSuccessModal(s => ({ ...s, open: false }))}>
                        {t('common.close', 'Close')}
                    </Button>,
                    window.__TAURI_INTERNALS__ && (
                        <Button 
                            key="open" 
                            type="primary" 
                            icon={<EyeOutlined />}
                            onClick={async () => {
                                try {
                                    const { open: shellOpen } = await import('@tauri-apps/plugin-shell');
                                    await shellOpen(successModal.fileName);
                                } catch (err) {
                                    message.error("Could not open file.");
                                }
                            }}
                        >
                            {t('common.openFile', 'Open File')}
                        </Button>
                    )
                ].filter(Boolean)}
                title={
                    <Space size="middle" align="center">
                        <div style={{ 
                            width: 36, height: 36, borderRadius: '50%', 
                            background: 'linear-gradient(135deg, #52c41a, #389e0d)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 20, fontWeight: 'bold'
                        }}>✓</div>
                        <Text strong style={{ fontSize: '18px' }}>{t('common.downloadComplete', 'Download Complete!')}</Text>
                    </Space>
                }
            >
                <div style={{ padding: '12px 0' }}>
                    <Typography.Paragraph>
                        {t('admin.successGenText', 'Successfully generated documents for')}{' '}
                        <Text strong type="success">{successModal.count}</Text> {t('common.students', 'students')}.
                    </Typography.Paragraph>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {t('admin.fileSaveText', 'Your PDF file')}{' '}
                        <Text code style={{ fontSize: '13px', wordBreak: 'break-all' }}>
                            {successModal.fileName}
                        </Text>{' '}
                        {t('admin.savedToComputer', 'has been downloaded to your computer.')}
                    </Typography.Paragraph>
                </div>
            </Modal>
        </div>
    );
}

function IDCardTemplate({ student }) {
    return (
        <div className="cert-container" style={{
            width: '86mm', height: '54mm', backgroundColor: '#ffffff', border: '1px solid #d1d5db',
            borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            position: 'relative', color: '#1e293b', boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
        }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '50%' }} crossOrigin="anonymous" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="cert-amharic" style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.02em', color: '#f8fafc' }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</span>
                </div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', padding: '12px', gap: '14px', alignItems: 'center', backgroundImage: 'radial-gradient(#f1f5f9 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
                <div style={{ width: '22mm', height: '26mm', border: '2px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '28px', color: '#cbd5e1' }}>👤</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="cert-amharic" style={{ fontSize: '7px', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>ሙሉ ስም</span>
                        <span className="cert-serif" style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.2' }}>{student.name}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="cert-amharic" style={{ fontSize: '7px', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>የክርስትና ስም</span>
                        <span className="cert-amharic" style={{ fontSize: '10px', fontWeight: '600', color: '#334155' }}>{student.baptismalName || '-'}</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '16px', marginTop: '2px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="cert-amharic" style={{ fontSize: '7px', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>መለያ ቁጥር</span>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#0f172a' }}>{student.id}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="cert-amharic" style={{ fontSize: '7px', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>ክፍል</span>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a' }}>{student.grade}</div>
                        </div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ padding: '6px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
                        <QRCodeCanvas value={student.id} size={42} level="H" />
                    </div>
                    <span className="cert-amharic" style={{ fontSize: '6px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.05em' }}>የተረጋገጠ</span>
                </div>
            </div>
            
            <div style={{ height: '6px', display: 'flex', width: '100%' }}>
                <div style={{ flex: 1, backgroundColor: '#22c55e' }}></div>
                <div style={{ flex: 1, backgroundColor: '#eab308' }}></div>
                <div style={{ flex: 1, backgroundColor: '#ef4444' }}></div>
            </div>
        </div>
    );
}

function CertificateTemplate({ student, marks, subjects = [], assessments = [], semester = 'Semester I', rankMap = {} }) {
    const subjectRows = calculateSubjectRows(student, assessments, marks, subjects, semester);

    let overallEarned = 0;
    let overallMax = 0;
    subjectRows.forEach(row => {
        overallEarned += row.rowEarned;
        overallMax += row.rowMax;
    });

    const overallAvg = overallMax > 0 ? ((overallEarned / overallMax) * 100).toFixed(1) : 0;
    const rankInfo = rankMap[student.id] || { classRank: '-', overallRank: '-', totalInClass: 0, totalInGrade: 0 };

    return (
        <div className="cert-container" style={{
            width: '210mm', minHeight: '297mm', background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F0 100%)', padding: '24px',
            display: 'flex', flexDirection: 'column', position: 'relative', color: '#1A1A1A', overflow: 'hidden'
        }}>
            {/* Elegant Outer Border */}
            <div style={{ position: 'absolute', inset: '12px', border: '2px solid #C9A227', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(201,162,39,0.4)', pointerEvents: 'none' }} />

            {/* Corner Flourishes */}
            <svg style={{ position: 'absolute', top: '12px', left: '12px', width: '32px', height: '32px', color: '#C9A227' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(90deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', bottom: '12px', left: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', bottom: '12px', right: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(180deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>

            {/* Faint Background Logo Watermark - Absolute Background */}
            <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)', 
                opacity: 0.03, 
                zIndex: 1, 
                pointerEvents: 'none' 
            }}>
                <img src="/logo.png" alt="" style={{ width: '450px', height: '450px', objectFit: 'contain', filter: 'grayscale(100%)' }} crossOrigin="anonymous" />
            </div>

            {/* Header Section - Centered Monumental Layout */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                marginBottom: '32px', 
                zIndex: 10,
                textAlign: 'center'
            }}>
                <div style={{ width: '100px', height: '100px', marginBottom: '16px' }}>
                    <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }} crossOrigin="anonymous" />
                </div>
                
                <span className="cert-amharic" style={{ fontSize: '28px', fontWeight: '800', color: '#0F3A2B', marginBottom: '4px', letterSpacing: '0.02em', maxWidth: '80%' }}>
                    በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት
                </span>
                
                <span className="cert-amharic" style={{ fontSize: '14px', color: '#A67C00', marginBottom: '20px', fontStyle: 'italic', fontWeight: '600', letterSpacing: '0.05em' }}>
                    "በሃይማኖትና በምግባር የታነጹ ትውልድን ማፍራት"
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '8px' }}>
                    <span className="cert-amharic" style={{ fontSize: '32px', color: '#0A0A0A', fontWeight: '900', letterSpacing: '0.05em', marginBottom: '10px' }}>
                        የትምህርት ማስረጃ
                    </span>
                    <div style={{ width: '180px', height: '2px', backgroundColor: '#C9A227' }}></div>
                    <div style={{ width: '90px', height: '1px', backgroundColor: '#C9A227', marginTop: '4px' }}></div>
                </div>
            </div>

            {/* Student Information Card */}
            <div className="cert-card" style={{ padding: '28px 36px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
                    <div>
                        <span className="cert-amharic" style={{ fontSize: '12px', fontWeight: '800', color: '#555' }}>ሙሉ ስም</span>
                        <span className="cert-amharic" style={{ fontSize: '42px', fontWeight: '900', color: '#0A0A0A', display: 'block', lineHeight: 1.2, letterSpacing: '-0.01em', marginTop: '4px' }}>{student.name}</span>
                    </div>
                    {!!student?.baptismalName && (
                        <div style={{ marginTop: '8px' }}>
                            <span className="cert-amharic" style={{ fontSize: '11px', fontWeight: '700', color: '#555' }}>የክርስትና ስም</span>
                            <span className="cert-amharic" style={{ fontSize: '18px', fontWeight: '800', color: '#0F3A2B', display: 'block' }}>{student.baptismalName}</span>
                        </div>
                    )}
                </div>
                
                <div style={{ display: 'flex', gap: '48px', borderLeft: '2px solid #E8E8E8', paddingLeft: '48px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span className="cert-amharic" style={{ fontSize: '12px', fontWeight: '800', color: '#555' }}>የጥናት ዘመን</span>
                        <span className="cert-amharic" style={{ fontSize: '18px', fontWeight: '700' }}>{getEthiopianYear(student.academicYear || dayjs().toISOString())} ዓ.ም ( {semester === 'Semester I' ? '፩ኛ ሴሚስተር' : '፪ኛ ሴሚስተር'} )</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span className="cert-amharic" style={{ fontSize: '12px', fontWeight: '800', color: '#555' }}>ክፍል</span>
                        <span className="cert-amharic" style={{ fontSize: '22px', fontWeight: '900', color: '#0F3A2B' }}>{student.grade}</span>
                    </div>
                </div>
            </div>

            {/* Academic Performance Table */}
            <div className="cert-card" style={{ flex: 1, padding: '24px 32px', position: 'relative', zIndex: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th className="cert-th" style={{ textAlign: 'left' }}><span className="cert-amharic">የትምህርት ዓይነት</span></th>
                            <th className="cert-th" style={{ textAlign: 'center' }}><span className="cert-amharic">፩ኛ ሴሚስተር</span></th>
                            <th className="cert-th" style={{ textAlign: 'center' }}><span className="cert-amharic">፪ኛ ሴሚስተር</span></th>
                            <th className="cert-th" style={{ textAlign: 'center', borderRight: 'none' }}><span className="cert-amharic">አጠቃላይ ውጤት</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjectRows.map((row, idx) => {
                            const val = parseFloat(row.avg);
                            const badgeColor = isNaN(val) ? '#666' : (val >= 70 ? '#166534' : (val >= 50 ? '#374151' : '#991B1B'));
                            const badgeBg = isNaN(val) ? '#F9FAFB' : (val >= 70 ? '#DCFCE7' : (val >= 50 ? '#F3F4F6' : '#FEE2E2'));
                            const badgeBorder = isNaN(val) ? '1px solid #E5E7EB' : `1px solid ${val >= 70 ? '#BBF7D0' : (val >= 50 ? '#E5E7EB' : '#FECACA')}`;
                            const isLastRow = idx === subjectRows.length - 1;

                            return (
                                <tr key={idx} style={{ 
                                    borderBottom: isLastRow ? 'none' : '1px solid #E5E7EB', 
                                    backgroundColor: idx % 2 === 0 ? 'transparent' : '#FAFAFA' 
                                }}>
                                    <td className="cert-td" style={{ color: '#0A0A0A', fontWeight: '800', textAlign: 'left' }}>{row.subject}</td>
                                    <td className="cert-td" style={{ textAlign: 'center', color: '#333', fontWeight: '600', verticalAlign: 'middle' }}>
                                        {row.semI}
                                    </td>
                                    <td className="cert-td" style={{ textAlign: 'center', color: '#333', fontWeight: '600', verticalAlign: 'middle' }}>
                                        {row.semII}
                                    </td>
                                    <td className="cert-td" style={{ textAlign: 'center', fontWeight: '800', color: '#1A1A1A', borderRight: 'none', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                            <span style={{ 
                                                display: 'inline-block', 
                                                minWidth: '56px', 
                                                padding: '6px 14px', 
                                                borderRadius: '6px', 
                                                fontWeight: '900', 
                                                fontSize: '15px', 
                                                letterSpacing: '0.03em', 
                                                lineHeight: '1.4', 
                                                textAlign: 'center', 
                                                backgroundColor: badgeBg, 
                                                color: badgeColor, 
                                                border: badgeBorder
                                            }}>
                                                {row.avg}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                {/* Summary Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '48px', paddingTop: '28px', borderTop: '2px solid #E5E7EB' }}>
                    {/* Left: Stats */}
                    <div style={{ display: 'flex', gap: '44px', alignItems: 'flex-end', paddingBottom: '2px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span className="cert-amharic" style={{ fontSize: '11px', color: '#444', fontWeight: '800', letterSpacing: '0.05em' }}>አጠቃላይ ውጤት</span>
                            <span style={{ fontSize: '28px', fontWeight: '900', color: '#1A1A1A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                                {overallEarned} <span style={{fontSize: '16px', color: '#888', fontWeight: '600'}}>/ {overallMax}</span>
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                            <span className="cert-amharic" style={{ fontSize: '11px', color: '#444', fontWeight: '800', letterSpacing: '0.05em' }}>የክፍል ደረጃ</span>
                            <span style={{ fontSize: '20px', fontWeight: '800', color: '#333', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{rankInfo.classRank} <span style={{fontSize: '14px', color: '#888', fontWeight: '600'}}>/ {rankInfo.totalInClass}</span></span>
                        </div>
                    </div>

                    {/* Right: Overall Average */}
                    {(() => {
                        const score = parseFloat(overallAvg);
                        const isExcellent = score >= 90;
                        const isGood = score >= 75;
                        const isSatisfactory = score >= 50;

                        const color = isExcellent ? '#059669' : (isGood ? '#166534' : (isSatisfactory ? '#A67C00' : '#991B1B'));
                        const borderColor = isExcellent ? '#10B981' : (isGood ? '#16A34A' : (isSatisfactory ? '#C9A227' : '#DC2626'));
                        const bgColor = isExcellent ? '#ECFDF5' : (isGood ? '#F0FDF4' : (isSatisfactory ? '#FFFBEB' : '#FEF2F2'));

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span className="cert-amharic" style={{ fontSize: '13px', color: color, fontWeight: '900', letterSpacing: '0.05em', marginBottom: '8px' }}>አማካይ ውጤት</span>
                                <div style={{ 
                                    width: '160px',
                                    height: '72px',
                                    background: `linear-gradient(135deg, ${bgColor} 0%, rgba(255,255,255,0) 100%)`, 
                                    border: `2px solid ${borderColor}`, 
                                    borderRadius: '10px',
                                    display: 'grid', 
                                    placeItems: 'center', 
                                    boxSizing: 'border-box'
                                }}>
                                    <span style={{ 
                                        fontSize: '42px', fontWeight: '900', color: color, 
                                        margin: 0, padding: 0, fontVariantNumeric: 'tabular-nums' 
                                    }}>
                                        {overallAvg}%
                                    </span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Footer Section */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 10, padding: '0 24px' }}>
                {/* Official QR Code & Issue Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid rgba(201,162,39,0.4)' }}>
                        <QRCodeCanvas value={`verify:${student.id}|yr:${getEthiopianYear(student.academicYear || dayjs().toISOString())}`} size={64} level="M" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="cert-amharic" style={{ fontSize: '12px', fontWeight: '800', color: '#0F3A2B', letterSpacing: '0.05em' }}>ትክክለኛ ማስረጃ</span>
                        <span className="cert-amharic" style={{ fontSize: '9px', color: '#666', maxWidth: '140px', lineHeight: 1.4, fontWeight: '500' }}>ትክክለኛነቱን ለማረጋገጥ ይህንን ይጠቀሙ።</span>
                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #E5E7EB' }}>
                            <span className="cert-amharic" style={{ fontSize: '9px', color: '#666', fontWeight: '800', letterSpacing: '0.05em' }}>የተሰጠበት ቀን፦ </span>
                            <span className="cert-amharic" style={{ fontSize: '10px', fontWeight: '600', color: '#0A0A0A' }}>{dayjs().format('MMM D, YYYY')}</span>
                        </div>
                    </div>
                </div>
                
                {/* Signatures */}
                <div style={{ display: 'flex', gap: '64px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '160px' }}>
                        <div style={{ width: '100%', borderBottom: '2px solid #1A1A1A', marginBottom: '8px', height: '32px' }} />
                        <span className="cert-amharic" style={{fontSize:'11px', fontWeight:'800'}}>ሥራ አስኪያጅ</span>
                        <span className="cert-amharic" style={{fontSize:'12px', fontWeight:'600', color:'#666', marginTop:'4px'}}>አባ ፀጋዬ</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '160px' }}>
                        <div style={{ width: '100%', borderBottom: '2px solid #1A1A1A', marginBottom: '8px', height: '32px' }} />
                        <span className="cert-amharic" style={{fontSize:'11px', fontWeight:'800'}}>አስተባባሪ</span>
                        <span className="cert-amharic" style={{fontSize:'12px', fontWeight:'600', color:'#666', marginTop:'4px'}}>አቶ መላኩ</span>
                    </div>
                </div>
            </div>
            
            {/* Digital Seal Overlay */}
            <div style={{ position: 'absolute', bottom: '48px', left: '50%', transform: 'translateX(-50%)', opacity: 0.025, zIndex: 5, pointerEvents: 'none' }}>
                <div style={{ width: '200px', height: '200px', border: '6px double #C9A227', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201,162,39,0.05)' }}>
                    <span className="cert-amharic" style={{ fontSize: '24px', color: '#C9A227', fontWeight: '900', textAlign: 'center', letterSpacing: '0.05em' }}>ትክክለኛ<br/>ማህተም</span>
                </div>
            </div>
        </div>
    );
}
