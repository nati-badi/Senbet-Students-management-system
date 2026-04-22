import { useState } from 'react';
import { Typography, Card, Button, Space, message, Select, DatePicker, Row, Col, Modal } from 'antd';
import { DownloadOutlined, FileExcelOutlined, DatabaseOutlined, EyeOutlined } from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { formatEthiopianDate } from '../../utils/dateUtils';
import { formatGrade } from '../../utils/gradeUtils';

const { Title, Text, Paragraph } = Typography;

export default function ReportsAndBackups() {
    const { t } = useTranslation();
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const marks = useLiveQuery(() => db.marks.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const attendance = useLiveQuery(() => db.attendance.toArray()) || [];

    const [loadingAction, setLoadingAction] = useState(null); // null, 'students', 'semester1', 'semester2'
    const [successModal, setSuccessModal] = useState({ open: false, fileName: '' });

    const handleDownloadStudents = async () => {
        if (!students || students.length === 0) {
            message.warning(t('admin.noStudentsToExport', 'No students to export.'));
            return;
        }

        setLoadingAction('students');
        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Enrolled Students');

            // 1. Add Title Header
            worksheet.mergeCells('A1:G2');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'SENBET SCHOOL - ENROLLED STUDENTS LIST';
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate-800

            // 2. Add Info Header
            worksheet.mergeCells('A3:G3');
            const infoCell = worksheet.getCell('A3');
            infoCell.value = `ሪፖርቱ የተዘጋጀበት ቀን፦ ${formatEthiopianDate(new Date())} ${formatEthiopianTime(new Date())}`;
            infoCell.font = { italic: true };
            infoCell.alignment = { horizontal: 'right' };

            // 3. Define Table Columns
            worksheet.getRow(5).values = [
                'Full Name', 'Baptismal Name', 'Gender', 'Grade', 'Portal Code', 'Parent Contact', 'Date of Entry'
            ];
            
            // Style Header Row
            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true };
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = { bottom: { style: 'thin' } };
            });

            // 4. Add Data
            students.forEach((s, idx) => {
                const row = worksheet.addRow([
                    s.name,
                    s.baptismalName || s.baptismalname || '',
                    s.gender,
                    formatGrade(s.grade),
                    s.portalCode || s.portalcode || '',
                    s.parentContact || s.parentcontact,
                    formatEthiopianDate(s.academicYear || s.academicyear, true)
                ]);

                // Zebra striping
                if (idx % 2 === 1) {
                    row.eachCell((cell) => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    });
                }
            });

            // Auto-fit columns (rough calculation)
            worksheet.columns.forEach(column => {
                let maxLen = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const len = cell.value ? cell.value.toString().length : 0;
                    if (len > maxLen) maxLen = len;
                });
                column.width = Math.min(maxLen < 15 ? 15 : maxLen + 2, 40);
            });

            // 5. Save logic
            if (window.__TAURI_INTERNALS__) {
                const buffer = await workbook.xlsx.writeBuffer();
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeFile: writeBinaryFile } = await import('@tauri-apps/plugin-fs');
                
                const filePath = await save({
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
                    defaultPath: 'Senbet_Enrolled_Students.xlsx'
                });

                if (filePath) {
                    await writeBinaryFile(filePath, new Uint8Array(buffer));
                    setSuccessModal({ open: true, fileName: filePath });
                }
            } else {
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Senbet_Enrolled_Students.xlsx';
                a.click();
                message.success(t('admin.studentsExportSuccess', 'Students exported successfully!'));
            }
        } catch (err) {
            console.error("Export Error:", err);
            message.error(t('admin.exportFailed', 'Failed to export students.'));
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDownloadSemesterReport = async (semester) => {
        if (!students.length || !marks.length || !assessments.length) {
            message.warning(t('admin.noDataForReport', 'No data available to generate report.'));
            return;
        }

        const actionKey = semester === 'Semester I' ? 'semester1' : 'semester2';
        setLoadingAction(actionKey);
        try {
            const settings = await db.settings.toArray();
            const currentYear = settings.find(s => s.key === 'currentAcademicYear')?.value;

            // Correct filtering: Use the semester property on the assessment itself AND the academicYear
            const semesterAssessments = assessments.filter(a => {
                const matchesYear = !currentYear || a.academicYear === currentYear;
                if (!matchesYear) return false;

                if (semester === 'Semester I') {
                    return a.semester === 'Semester I';
                }
                // Semester II is cumulative (includes both)
                return a.semester === 'Semester I' || a.semester === 'Semester II';
            });

            if (semesterAssessments.length === 0) {
                message.warning(t('admin.noAssessmentsFoundForReport', { semester, currentYear, defaultValue: `No assessments found for ${semester} in the current academic year (${currentYear}).` }));
                setLoadingAction(null);
                return;
            }

            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`${semester} Report`);

            // Find unique subjects found in THESE assessments
            const activeSubjectNames = [...new Set(semesterAssessments.map(a => a.subjectName))].sort();
            const assessmentIds = semesterAssessments.map(a => a.id);
            const semesterMarks = marks.filter(m => assessmentIds.includes(m.assessmentId));

            // 1. Add Title Header
            const lastColNum = activeSubjectNames.length * 2 + 5; // Student Name, Grade + 2 cols/subject + Total, Max, %
            worksheet.mergeCells(1, 1, 2, lastColNum);
            const titleCell = worksheet.getCell(1, 1);
            titleCell.value = `SENBET SCHOOL - ${semester.toUpperCase()} GRADE REPORT`;
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            
            // Premium Color Scheme matching UI buttons
            const headerColor = semester === 'Semester I' ? 'FF2563EB' : 'FF9333EA'; // Blue-600 vs Purple-600
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };

            // 2. Add Column Headers (Row 4)
            const headerRow = worksheet.getRow(4);
            headerRow.values = ['Student Name', 'Grade', ...activeSubjectNames.flatMap(s => [s, 'Max']), 'Total', 'Max', 'Percentage'];
            headerRow.font = { bold: true };
            headerRow.height = 25;
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = { 
                    bottom: { style: 'medium' },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });

            // 3. Process Student Data
            students.forEach((student, idx) => {
                const rowValues = [student.name, formatGrade(student.grade)];
                let totalScore = 0;
                let totalMax = 0;

                activeSubjectNames.forEach(subjectName => {
                    const subjAssessments = semesterAssessments.filter(a => a.subjectName === subjectName && a.grade === student.grade);
                    let subjScore = 0;
                    let subjMax = 0;

                    subjAssessments.forEach(sa => {
                        const mark = semesterMarks.find(m => m.studentId === student.id && m.assessmentId === sa.id);
                        if (mark) subjScore += mark.score;
                        subjMax += sa.maxScore;
                    });

                    rowValues.push(subjMax > 0 ? subjScore : '-');
                    rowValues.push(subjMax > 0 ? subjMax : '-');
                    totalScore += subjScore;
                    totalMax += subjMax;
                });

                if (totalMax > 0) {
                    rowValues.push(totalScore);
                    rowValues.push(totalMax);
                    rowValues.push((totalScore / totalMax));
                    
                    const row = worksheet.addRow(rowValues);
                    
                    // Style row
                    if (idx % 2 === 1) {
                        row.eachCell(cell => {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                        });
                    }

                    // Format percentage cell
                    const percentageCell = row.getCell(rowValues.length);
                    percentageCell.numFmt = '0.00%';
                    percentageCell.font = { bold: true, color: { argb: 'FF166534' } }; // green-800
                }
            });

            // Auto-fit columns
            worksheet.columns.forEach(column => {
                column.width = 15;
            });
            worksheet.getColumn(1).width = 30; // Name column wider

            // 5. Save logic
            const filename = `Senbet_${semester.replace(' ', '_')}_Report.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();

            if (window.__TAURI_INTERNALS__) {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeFile: writeBinaryFile } = await import('@tauri-apps/plugin-fs');
                
                const filePath = await save({
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
                    defaultPath: filename
                });

                if (filePath) {
                    await writeBinaryFile(filePath, new Uint8Array(buffer));
                    setSuccessModal({ open: true, fileName: filePath });
                }
            } else {
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                message.success(t('admin.reportExportSuccess', { semester, defaultValue: `${semester} report exported successfully!` }));
            }
        } catch (err) {
            console.error("Report Generation Error:", err);
            message.error(t('admin.reportGenerateFailed', 'Failed to generate report.'));
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div>
                <Title level={2} style={{ margin: 0 }}>{t('admin.reportsBackups', 'Reports & Backups')}</Title>
                <Text type="secondary">{t('admin.reportsDesc', 'Generate comprehensive reports and download system data backups.')}</Text>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <Card 
                        title={<Space><DatabaseOutlined className="text-blue-500"/> {t('admin.enrolledStudentsData', 'Enrolled Students Data')}</Space>}
                        className="h-full rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"
                    >
                        <Paragraph type="secondary" className="mb-6">
                            {t('admin.enrolledStudentsDesc', 'Download a complete Excel spreadsheet containing all currently registered students, including their contact details and portal access codes. Useful for generating parent contact lists or external backups.')}
                        </Paragraph>
                        <Button 
                            type="primary" 
                            icon={<FileExcelOutlined />} 
                            onClick={handleDownloadStudents}
                            size="large"
                            className="bg-green-600 hover:bg-green-500 border-none w-full sm:w-auto"
                            loading={loadingAction === 'students'}
                        >
                            {t('admin.downloadStudentsList', 'Download Students List (Excel)')}
                        </Button>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card 
                        title={<Space><FileExcelOutlined className="text-green-500"/> {t('admin.semesterGradeReports', 'Semester Grade Reports')}</Space>}
                        className="h-full rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"
                    >
                        <Paragraph type="secondary" className="mb-6">
                            {t('admin.semesterGradeDesc', 'Generate a comprehensive matrix of all student marks across all subjects for a specific semester. This calculates totals and percentages automatically.')}
                        </Paragraph>
                        <Space className="w-full flex-wrap gap-4">
                            <Button 
                                type="primary" 
                                icon={<DownloadOutlined />} 
                                onClick={() => handleDownloadSemesterReport('Semester I')}
                                size="large"
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500"
                                loading={loadingAction === 'semester1'}
                            >
                                {t('admin.genSemester1Report', 'Generate Semester I Report')}
                            </Button>
                            <Button 
                                type="primary" 
                                icon={<DownloadOutlined />} 
                                onClick={() => handleDownloadSemesterReport('Semester II')}
                                size="large"
                                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500"
                                loading={loadingAction === 'semester2'}
                            >
                                {t('admin.genSemester2Report', 'Generate Semester II Report')}
                            </Button>
                        </Space>
                    </Card>
                </Col>
            </Row>

            {/* Success Confirmation Modal */}
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
                                    console.error("[Modal-Open] Failed:", err);
                                    message.error(t('common.couldNotOpenFile', 'Could not open file.'));
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
                            width: 32, height: 32, borderRadius: '50%', 
                            background: 'linear-gradient(135deg, #52c41a, #389e0d)', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 18, fontWeight: 'bold'
                        }}>✓</div>
                        <Text strong style={{ fontSize: '16px' }}>{t('common.downloadComplete', 'Download Complete!')}</Text>
                    </Space>
                }
            >
                <div style={{ padding: '12px 0' }}>
                    <Paragraph>
                        {t('admin.successGenExcel', 'Successfully generated the Excel report for Senbet School.')}
                    </Paragraph>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {t('admin.fileSavedTo', 'The file has been saved to:')}
                        <br/>
                        <Text code style={{ fontSize: '13px', wordBreak: 'break-all', marginTop: '8px', display: 'inline-block' }}>
                            {successModal.fileName}
                        </Text>
                    </Paragraph>
                </div>
            </Modal>
        </div>
    );
}
