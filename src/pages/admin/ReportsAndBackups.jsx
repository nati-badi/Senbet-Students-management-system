import { useState } from 'react';
import { Typography, Card, Button, Space, Select, DatePicker, Row, Col, Modal, App as AntApp, Alert } from 'antd';
import { DownloadOutlined, FileExcelOutlined, DatabaseOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { formatEthiopianDate, formatEthiopianTime, getEthiopianYear } from '../../utils/dateUtils';
import { GRADE_OPTIONS, formatGrade, normalizeGrade } from '../../utils/gradeUtils';


const { Title, Text, Paragraph } = Typography;

export default function ReportsAndBackups() {
    const { t } = useTranslation();
    const { message } = AntApp.useApp();
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const marks = useLiveQuery(() => db.marks.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const attendance = useLiveQuery(() => db.attendance.toArray()) || [];

    const [loadingAction, setLoadingAction] = useState(null); // null, 'students', 'semester1', 'semester2'
    const [successModal, setSuccessModal] = useState({ open: false, fileName: '' });
    const [selectedGrade, setSelectedGrade] = useState(undefined);

    const handleDownloadStudents = async () => {
        if (!selectedGrade) {
            message.warning(t('admin.selectGradeFirst', 'Please select a grade first.'));
            return;
        }
        const gradeStudents = students.filter(s => String(s.grade) === String(selectedGrade) && s.archived !== 1);
        if (!gradeStudents || gradeStudents.length === 0) {
            message.warning(t('admin.noStudentsToExport', 'No students to export for this grade.'));
            return;
        }

        setLoadingAction('students');
        try {
            const gradeLabel = formatGrade(selectedGrade);
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Enrolled Students');

            // 1. Add Title Header
            worksheet.mergeCells('A1:F2');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = `SENBET SCHOOL - ${gradeLabel} ENROLLED STUDENTS`;
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

            // 2. Add Info Header
            worksheet.mergeCells('A3:F3');
            const infoCell = worksheet.getCell('A3');
            infoCell.value = `ሪፖርቱ የተዘጋጀበት ቀን፦ ${formatEthiopianDate(new Date())} ${formatEthiopianTime(new Date())}`;
            infoCell.font = { italic: true };
            infoCell.alignment = { horizontal: 'right' };

            // 3. Define Table Columns (no Grade column since it's filtered)
            worksheet.getRow(5).values = [
                'Full Name', 'Baptismal Name', 'Gender', 'Portal Code', 'Parent Contact', 'Date of Entry'
            ];

            // Style Header Row
            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true };
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = { bottom: { style: 'thin' } };
            });

            // 4. Add Data
            gradeStudents.forEach((s, idx) => {
                const row = worksheet.addRow([
                    s.name,
                    s.baptismalName || s.baptismalname || '',
                    s.gender,
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

            // Auto-fit columns
            worksheet.columns.forEach(column => {
                let maxLen = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const len = cell.value ? cell.value.toString().length : 0;
                    if (len > maxLen) maxLen = len;
                });
                column.width = Math.min(maxLen < 15 ? 15 : maxLen + 2, 40);
            });

            // 5. Save logic
            const filename = `Senbet_${gradeLabel}_Students.xlsx`;
            if (window.__TAURI_INTERNALS__) {
                const buffer = await workbook.xlsx.writeBuffer();
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
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
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
        if (!selectedGrade) {
            message.warning(t('admin.selectGradeFirst', 'Please select a grade first.'));
            return;
        }
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
                const targetYearNum = currentYear ? getEthiopianYear(currentYear) : null;
                const assessmentYearNum = a.academicYear ? getEthiopianYear(a.academicYear) : null;

                const matchesYear = !targetYearNum ||
                    assessmentYearNum === targetYearNum ||
                    !assessmentYearNum ||
                    (assessmentYearNum === '2017 ዓ.ም' && targetYearNum === '2018 ዓ.ም');

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
            const gradeLabel = formatGrade(selectedGrade);
            const worksheet = workbook.addWorksheet(`${gradeLabel} ${semester} Report`);

            // Filter assessments to the selected grade only
            const gradeAssessments = semesterAssessments.filter(a => String(a.grade) === String(selectedGrade));
            if (gradeAssessments.length === 0) {
                message.warning(t('admin.noAssessmentsForGrade', { grade: gradeLabel, defaultValue: `No assessments found for ${gradeLabel} in this semester.` }));
                setLoadingAction(null);
                return;
            }

            const activeSubjectNames = [...new Set(gradeAssessments.map(a => a.subjectName))].sort();
            const assessmentIds = gradeAssessments.map(a => a.id);
            const semesterMarks = marks.filter(m => assessmentIds.includes(m.assessmentId));

            // Build ordered assessment columns grouped by subject
            const assessmentColumns = [];
            activeSubjectNames.forEach(subjectName => {
                const subjAssessments = gradeAssessments
                    .filter(a => a.subjectName === subjectName)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                subjAssessments.forEach(sa => {
                    assessmentColumns.push({
                        subjectName,
                        assessmentId: sa.id,
                        assessmentName: sa.name,
                        maxScore: parseFloat(sa.maxScore) || 0
                    });
                });
            });

            const overallMax = assessmentColumns.reduce((sum, ac) => sum + ac.maxScore, 0);

            // --- 1. Title Header (Row 1-2) ---
            // Columns: Rank | Student Name | [one col per assessment] | Total (X) | Percentage
            const totalDataCols = 2 + assessmentColumns.length + 2; // rank, name, assessments..., total, percentage
            worksheet.mergeCells(1, 1, 2, totalDataCols);
            const titleCell = worksheet.getCell(1, 1);
            titleCell.value = `SENBET SCHOOL - ${gradeLabel} ${semester.toUpperCase()} GRADE REPORT`;
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            const headerColor = semester === 'Semester I' ? 'FF2563EB' : 'FF9333EA';
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };

            // --- 2. Subject Group Header (Row 3) - merge cells per subject ---
            const subjectGroupRow = worksheet.getRow(3);
            subjectGroupRow.height = 22;
            // First two columns: blank (Rank / Student Name)
            let colIdx = 3; // 1-indexed, starting after Rank and Name
            activeSubjectNames.forEach(subjectName => {
                const subjCols = assessmentColumns.filter(ac => ac.subjectName === subjectName);
                const subjTotalMax = subjCols.reduce((sum, ac) => sum + ac.maxScore, 0);
                if (subjCols.length > 1) {
                    worksheet.mergeCells(3, colIdx, 3, colIdx + subjCols.length - 1);
                }
                const cell = worksheet.getCell(3, colIdx);
                cell.value = `${subjectName} (${subjTotalMax})`;
                cell.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                // Style all merged cells in this group
                for (let i = 1; i < subjCols.length; i++) {
                    const mergedCell = worksheet.getCell(3, colIdx + i);
                    mergedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                    mergedCell.border = {
                        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                    };
                }
                colIdx += subjCols.length;
            });

            // --- 3. Assessment Column Headers (Row 4) ---
            // Format: "Assessment Name (maxScore)"
            const headerValues = ['Rank', 'Student Name'];
            assessmentColumns.forEach(ac => {
                headerValues.push(`${ac.assessmentName} (${ac.maxScore})`);
            });
            headerValues.push(`Total (${overallMax})`);
            headerValues.push('Percentage');

            const headerRow = worksheet.getRow(4);
            headerRow.values = headerValues;
            headerRow.font = { bold: true, size: 10 };
            headerRow.height = 28;
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.border = {
                    bottom: { style: 'medium' },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });

            // --- 4. Student Data Rows ---
            const gradeStudents = students.filter(s => s.archived !== 1 && String(s.grade) === String(selectedGrade));

            // Pre-calculate scores for sorting and ranking
            const studentResults = gradeStudents.map(student => {
                const scores = [];
                let totalScore = 0;
                let totalMax = 0;

                assessmentColumns.forEach(ac => {
                    const mark = semesterMarks.find(m => m.studentId === student.id && m.assessmentId === ac.assessmentId);
                    const score = mark ? (parseFloat(mark.score) || 0) : 0;
                    scores.push(score);
                    totalScore += score;
                    totalMax += ac.maxScore;
                });

                const pct = totalMax > 0 ? (totalScore / totalMax) : 0;

                return {
                    student,
                    scores,
                    totalScore,
                    totalMax,
                    pct
                };
            });

            // Filter out students with 0 total score (0%)
            const filteredResults = studentResults.filter(result => result.totalScore > 0);

            // Sort by total score descending
            filteredResults.sort((a, b) => b.totalScore - a.totalScore);

            // Assign ranks (handling ties)
            let currentRank = 1;
            let previousScore = null;
            let studentsWithSameScore = 0;

            filteredResults.forEach((result, idx) => {
                if (previousScore !== null && result.totalScore < previousScore) {
                    currentRank += studentsWithSameScore;
                    studentsWithSameScore = 1;
                } else if (previousScore !== null && result.totalScore === previousScore) {
                    studentsWithSameScore++;
                } else {
                    studentsWithSameScore = 1;
                }
                result.rank = currentRank;
                previousScore = result.totalScore;
            });

            // Write to worksheet
            filteredResults.forEach((result, idx) => {
                const rowValues = [result.rank, result.student.name, ...result.scores];

                rowValues.push(result.totalMax > 0 ? `${result.totalScore}/${result.totalMax}` : '-');
                rowValues.push(result.totalMax > 0 ? result.pct : '-');

                const row = worksheet.addRow(rowValues);

                // Center-align all data cells (Rank + columns after Name)
                row.eachCell((cell, colNumber) => {
                    if (colNumber === 1 || colNumber > 2) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });

                // Zebra striping
                if (idx % 2 === 1) {
                    row.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                    });
                }

                // Format percentage cell
                if (result.totalMax > 0) {
                    const percentageCell = row.getCell(rowValues.length);
                    percentageCell.numFmt = '0.00%';
                    percentageCell.font = { bold: true, color: { argb: 'FF166534' } };
                }
            });

            // --- 5. Auto-fit columns ---
            worksheet.columns.forEach((column, i) => {
                if (i === 0) {
                    column.width = 8;  // Rank column
                } else if (i === 1) {
                    column.width = 30; // Name column
                } else {
                    column.width = 16; // Assessment/Total/Pct columns
                }
            });

            // --- 6. Save logic ---
            const filename = `Senbet_${gradeLabel}_${semester.replace(' ', '_')}_Report.xlsx`;
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

            <Card className="rounded-2xl shadow-sm border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <FilterOutlined className="text-blue-500 text-lg" />
                        <Text strong>{t('admin.selectGradeForReport', 'Select Grade')}</Text>
                    </div>
                    <Select
                        value={selectedGrade}
                        onChange={setSelectedGrade}
                        placeholder={t('admin.selectGrade', 'Select a grade...')}
                        options={GRADE_OPTIONS}
                        className="w-64"
                        size="large"
                        allowClear
                    />
                    {selectedGrade && (
                        <Text type="secondary">
                            {t('admin.studentsInGrade', { count: students.filter(s => String(s.grade) === String(selectedGrade) && s.archived !== 1).length, grade: formatGrade(selectedGrade), defaultValue: `${students.filter(s => String(s.grade) === String(selectedGrade) && s.archived !== 1).length} active students in ${formatGrade(selectedGrade)}` })}
                        </Text>
                    )}
                </div>
            </Card>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <Card
                        title={<Space><DatabaseOutlined className="text-blue-500" /> {t('admin.enrolledStudentsData', 'Enrolled Students Data')}</Space>}
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
                        title={<Space><FileExcelOutlined className="text-green-500" /> {t('admin.semesterGradeReports', 'Semester Grade Reports')}</Space>}
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
                        <br />
                        <Text code style={{ fontSize: '13px', wordBreak: 'break-all', marginTop: '8px', display: 'inline-block' }}>
                            {successModal.fileName}
                        </Text>
                    </Paragraph>
                </div>
            </Modal>
        </div>
    );
}
