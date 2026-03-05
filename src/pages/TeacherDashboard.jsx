import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { PenTool, CheckCircle, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

export default function TeacherDashboard() {
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
        { name: t('teacher.markEntry'), path: '/teacher', icon: <PenTool className="w-5 h-5 mr-3" /> },
        { name: t('teacher.attendance'), path: '/teacher/attendance', icon: <CheckCircle className="w-5 h-5 mr-3" /> },
    ];

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <aside className="w-full md:w-64 flex-shrink-0">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sticky top-24">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-3">{t('teacher.menu')}</h2>
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path || (location.pathname === '/teacher/' && item.path === '/teacher');
                            return (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-forest-700 text-white'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                    style={isActive ? { backgroundColor: 'var(--color-forest)' } : {}}
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
                    <Route path="/" element={<SpeedEntryMarks />} />
                    <Route path="/attendance" element={<AttendanceModule />} />
                </Routes>
            </div>
        </div>
    );
}

function SpeedEntryMarks() {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [subject, setSubject] = useState('');
    const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
    const [localMarks, setLocalMarks] = useState({});

    // Fetch unique grades for the dropdown
    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const uniqueGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);

    // Fetch students in selected grade
    const studentsInGrade = allStudents.filter(s => s.grade === selectedGrade);

    // Initial load of marks for selected params
    useEffect(() => {
        if (!selectedGrade || !subject || !assessmentDate) return;

        async function loadMarks() {
            const marks = await db.marks
                .where('assessmentDate').equals(assessmentDate)
                .toArray();

            const matchingMarks = marks.filter(m => m.subject === subject);

            const markMap = {};
            matchingMarks.forEach(m => {
                markMap[m.studentId] = m.score;
            });
            setLocalMarks(markMap);
        }
        loadMarks();
    }, [selectedGrade, subject, assessmentDate]);

    const handleMarkChange = async (studentId, value) => {
        const score = parseFloat(value);

        // Update local react state instantly for speed
        setLocalMarks(prev => ({ ...prev, [studentId]: score }));

        if (isNaN(score)) return;

        // Auto-save offline to Dexie
        const existingMark = await db.marks
            .filter(m => m.studentId === studentId && m.subject === subject && m.assessmentDate === assessmentDate)
            .first();

        if (existingMark) {
            await db.marks.update(existingMark.id, { score, synced: false });
        } else {
            await db.marks.add({
                studentId,
                subject,
                assessmentDate,
                score,
                synced: false
            });
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('teacher.speedEntryMarks')}</h2>
            <p className="text-slate-500 text-sm mb-6">{t('teacher.enterMarksInfo')}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('teacher.selectGrade')}</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                        value={selectedGrade}
                        onChange={e => setSelectedGrade(e.target.value)}
                    >
                        <option value="">-- {t('teacher.selectGrade')} --</option>
                        {uniqueGrades.map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('teacher.subject')}</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="e.g. Math"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('teacher.date')}</label>
                    <input
                        type="date"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                        value={assessmentDate}
                        onChange={e => setAssessmentDate(e.target.value)}
                    />
                </div>
            </div>

            {selectedGrade && subject ? (
                studentsInGrade.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 font-medium">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">{t('admin.name')}</th>
                                    <th className="px-4 py-3 text-right rounded-tr-lg w-48">{t('teacher.score')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {studentsInGrade.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                className="w-full text-right px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-600"
                                                placeholder="0-100"
                                                value={localMarks[student.id] || ''}
                                                onChange={e => handleMarkChange(student.id, e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
                        {t('teacher.noStudentsInGrade')}
                    </div>
                )
            ) : null}
        </div>
    );
}

function AttendanceModule() {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [localAttendance, setLocalAttendance] = useState({});

    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const uniqueGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const studentsInGrade = allStudents.filter(s => s.grade === selectedGrade);

    useEffect(() => {
        if (!selectedGrade || !attendanceDate) return;

        async function loadAttendance() {
            const records = await db.attendance
                .filter(a => a.date === attendanceDate)
                .toArray();

            const attMap = {};
            records.forEach(r => {
                attMap[r.studentId] = r.status;
            });
            setLocalAttendance(attMap);
        }
        loadAttendance();
    }, [selectedGrade, attendanceDate]);

    const handleAttendanceChange = async (studentId, status) => {
        setLocalAttendance(prev => ({ ...prev, [studentId]: status }));

        const existingRecord = await db.attendance
            .filter(a => a.studentId === studentId && a.date === attendanceDate)
            .first();

        if (existingRecord) {
            await db.attendance.update(existingRecord.id, { status, synced: false });
        } else {
            await db.attendance.add({
                studentId,
                date: attendanceDate,
                status,
                synced: false
            });
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('teacher.attendanceModule')}</h2>
            <p className="text-slate-500 text-sm mb-6">{t('teacher.recordAttendanceInfo')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('teacher.selectGrade')}</label>
                    <select
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                        value={selectedGrade}
                        onChange={e => setSelectedGrade(e.target.value)}
                    >
                        <option value="">-- {t('teacher.selectGrade')} --</option>
                        {uniqueGrades.map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('teacher.date')}</label>
                    <input
                        type="date"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                        value={attendanceDate}
                        onChange={e => setAttendanceDate(e.target.value)}
                    />
                </div>
            </div>

            {selectedGrade ? (
                studentsInGrade.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 font-medium">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">{t('admin.name')}</th>
                                    <th className="px-4 py-3 text-right rounded-tr-lg">{t('teacher.attendance')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {studentsInGrade.map(student => {
                                    const currentStatus = localAttendance[student.id] || 'present';
                                    return (
                                        <tr key={student.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
                                            <td className="px-4 py-3 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleAttendanceChange(student.id, 'present')}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${currentStatus === 'present' ? 'bg-forest-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                    style={currentStatus === 'present' ? { backgroundColor: 'var(--color-forest)' } : {}}
                                                >
                                                    {t('teacher.present')}
                                                </button>
                                                <button
                                                    onClick={() => handleAttendanceChange(student.id, 'late')}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${currentStatus === 'late' ? 'bg-yellow-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                >
                                                    {t('teacher.late')}
                                                </button>
                                                <button
                                                    onClick={() => handleAttendanceChange(student.id, 'absent')}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${currentStatus === 'absent' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                                >
                                                    {t('teacher.absent')}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
                        {t('teacher.noStudentsInGrade')}
                    </div>
                )
            ) : null}
        </div>
    );
}
