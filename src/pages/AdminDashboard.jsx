import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { UserPlus, Settings, Database, FileText, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function AdminDashboard() {
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
        { name: t('admin.registerStudents'), path: '/admin', icon: <UserPlus className="w-5 h-5 mr-3" /> },
        { name: t('admin.certificates'), path: '/admin/certificates', icon: <FileText className="w-5 h-5 mr-3" /> },
        { name: t('admin.systemData'), path: '/admin/data', icon: <Database className="w-5 h-5 mr-3" /> },
    ];

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <aside className="w-full md:w-64 flex-shrink-0">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sticky top-24">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-3">{t('admin.menu')}</h2>
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path || (location.pathname === '/admin/' && item.path === '/admin');
                            return (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    {item.icon}
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </aside>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 min-h-[500px]">
                <Routes>
                    <Route path="/" element={<StudentRegistration />} />
                    <Route path="/certificates" element={<CertificateGenerator />} />
                    <Route path="/data" element={<div className="p-6">{t('common.comingSoon')}</div>} />
                </Routes>
            </div>
        </div>
    );
}

function StudentRegistration() {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [baptismalName, setBaptismalName] = useState('');
    const [grade, setGrade] = useState('');
    const [parentContact, setParentContact] = useState('');

    const students = useLiveQuery(() => db.students.toArray()) || [];

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!name || !grade) return;

        try {
            await db.students.add({
                name,
                baptismalName,
                grade,
                parentContact,
            });
            setName('');
            setBaptismalName('');
            setGrade('');
            setParentContact('');
        } catch (err) {
            console.error("Failed to add student:", err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await db.students.delete(id);
        } catch (err) {
            console.error("Failed to delete student:", err);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{t('admin.registerNewStudent')}</h2>
                    <p className="text-slate-500 text-sm mt-1">{t('admin.addStudentsDesc')}</p>
                </div>
            </div>

            <form onSubmit={handleRegister} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.fullName')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder={t('admin.namePlaceholder')}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.baptismalNameField')}</label>
                        <input
                            type="text"
                            value={baptismalName}
                            onChange={(e) => setBaptismalName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder={t('admin.baptismalPlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.gradeClass')}</label>
                        <input
                            type="text"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder={t('admin.gradePlaceholder')}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.parentContact')}</label>
                        <input
                            type="text"
                            value={parentContact}
                            onChange={(e) => setParentContact(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder={t('admin.contactPlaceholder')}
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        type="submit"
                        className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
                    >
                        {t('admin.saveStudent')}
                    </button>
                </div>
            </form>

            <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">{t('admin.enrolledStudents')} ({students.length})</h3>

                {students.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
                        {t('admin.noStudentsYet')}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 font-medium">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">{t('admin.name')}</th>
                                    <th className="px-4 py-3">{t('admin.baptismalName')}</th>
                                    <th className="px-4 py-3">{t('admin.grade')}</th>
                                    <th className="px-4 py-3">{t('admin.contact')}</th>
                                    <th className="px-4 py-3 text-right rounded-tr-lg">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {students.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                                        <td className="px-4 py-3 text-slate-500">{student.baptismalName || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                                {student.grade}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{student.parentContact || '-'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(student.id)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                                                title="Delete student"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function CertificateGenerator() {
    const { t } = useTranslation();
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const [selectedGrade, setSelectedGrade] = useState('');

    const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);

    const generateCertificates = () => {
        if (!selectedGrade) return;

        const gradeStudents = students.filter(s => s.grade === selectedGrade);
        if (gradeStudents.length === 0) return;

        const doc = new jsPDF();

        gradeStudents.forEach((student, index) => {
            if (index > 0) doc.addPage();

            // Clean holy aesthetic
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(0, 0, 210, 297, 'F');

            doc.setDrawColor(22, 101, 52); // forest-700 border
            doc.setLineWidth(1.5);
            doc.rect(10, 10, 190, 277);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(26);
            doc.setTextColor(15, 23, 42); // navy
            doc.text("Certificate of Achievement", 105, 40, { align: "center" });

            doc.setFontSize(16);
            doc.setFont("helvetica", "normal");
            doc.text("B/G/D/A/Q/Arsema Finote Birhan S/Bet", 105, 50, { align: "center" });

            doc.setFontSize(14);
            doc.text(`This certifies that`, 105, 80, { align: "center" });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(22, 101, 52); // forest
            doc.text(student.name, 105, 95, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(`has successfully completed Grade ${student.grade}.`, 105, 110, { align: "center" });

            // Fetch and display marks
            const studentMarks = allMarks.filter(m => m.studentId === student.id);
            if (studentMarks.length > 0) {
                doc.autoTable({
                    startY: 130,
                    head: [['Subject', 'Assessment Date', 'Score']],
                    body: studentMarks.map(m => [m.subject, m.assessmentDate, m.score]),
                    theme: 'striped',
                    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
                    margin: { left: 20, right: 20 }
                });
            } else {
                doc.setFontSize(12);
                doc.setTextColor(100, 116, 139);
                doc.text(t('admin.noMarksYet'), 105, 140, { align: "center" });
            }
        });

        doc.save(`Senbet_Certificates_${selectedGrade}.pdf`);
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('admin.generateCertificates')}</h2>
            <p className="text-slate-500 text-sm mb-6">{t('admin.generatorDesc')}</p>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 inline-block w-full max-w-md">
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('admin.selectGradeCerts')}</label>
                <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white mb-6"
                    value={selectedGrade}
                    onChange={e => setSelectedGrade(e.target.value)}
                >
                    <option value="">-- {t('teacher.selectGrade')} --</option>
                    {uniqueGrades.map(g => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>

                <button
                    onClick={generateCertificates}
                    disabled={!selectedGrade}
                    className={`w-full py-3 rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2 ${selectedGrade
                        ? 'bg-forest-700 text-white hover:bg-forest-800'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        }`}
                    style={selectedGrade ? { backgroundColor: 'var(--color-forest)' } : {}}
                >
                    <FileText className="w-5 h-5" />
                    {t('admin.downloadAllCertificates')}
                </button>
            </div>
        </div>
    );
}
