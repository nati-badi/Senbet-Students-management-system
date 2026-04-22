import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Button, Typography, message, Result } from 'antd';
import { DownloadOutlined, SafetyCertificateFilled, CheckCircleFilled } from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../utils/supabaseClient';
import { calculateSubjectRows, calculateSingleStudentRank } from '../../utils/analyticsEngine';
import { getEthiopianYear } from '../../utils/dateUtils';

const { Text, Title } = Typography;

export default function VerifyCertificate() {
  const { id } = useParams();
  const certRef = useRef(null);
  const containerRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  
  const [student, setStudent] = useState(null);
  const [rankInfo, setRankInfo] = useState({});
  const [subjectRows, setSubjectRows] = useState([]);
  const [semester, setSemester] = useState('Semester I');

  // 📐 SMART SCALING LOGIC
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const certWidthInPixels = 210 * 3.7795275591; // 210mm to px at 96dpi
        const padding = 32; // Standard padding
        
        if (containerWidth < certWidthInPixels + padding) {
          const newScale = (containerWidth - padding) / certWidthInPixels;
          setScale(newScale);
        } else {
          setScale(1);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    // Call again after a short delay to ensure layout is settled
    const timer = setTimeout(handleResize, 500);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (studentError) throw studentError;
        if (!studentData) throw new Error("Student not found");
        setStudent(studentData);

        const [mRes, aRes, subRes, setRes, allStudentsRes] = await Promise.all([
          supabase.from('marks').select('*').eq('studentid', studentData.id),
          supabase.from('assessments').select('*').eq('grade', studentData.grade),
          supabase.from('subjects').select('*'),
          supabase.from('settings').select('*'),
          supabase.from('students').select('*').eq('grade', studentData.grade)
        ]);

        const allStudents = allStudentsRes.data || [];
        const studentIdsInGrade = allStudents.map(s => s.id);
        const allMarksRes = await supabase.from('marks').select('*').in('studentid', studentIdsInGrade);

        const studentMarks = mRes.data || [];
        const allMarks = allMarksRes.data || [];
        const gradeAssessments = aRes.data || [];
        const allSubjects = subRes.data || [];
        
        let settingsMap = {};
        if (setRes.data) setRes.data.forEach(s => settingsMap[s.key] = s.value);
        const activeSemester = settingsMap['currentSemester'] || 'Semester I';
        setSemester(activeSemester);

        const ri = calculateSingleStudentRank(studentData, allStudents, gradeAssessments, allMarks, activeSemester, allSubjects);
        const rows = calculateSubjectRows(studentData, gradeAssessments, studentMarks, allSubjects, activeSemester);

        setRankInfo(ri || { classRank: '-', overallRank: '-', totalInClass: 0, totalInGrade: 0 });
        setSubjectRows(rows);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const { overallEarned, overallMax, overallAvg } = useMemo(() => {
    let earned = 0, max = 0;
    subjectRows.forEach(row => { earned += row.rowEarned; max += row.rowMax; });
    return { overallEarned: earned, overallMax: max, overallAvg: max > 0 ? ((earned / max) * 100).toFixed(1) : 0 };
  }, [subjectRows]);

  // 📥 AUTOMATIC PDF DOWNLOAD GENERATOR
  const handleDownloadPDF = async () => {
    if (!certRef.current) return;
    try {
      setDownloading(true);
      const msg = message.loading({ content: 'Generating Secure PDF...', key: 'pdf', duration: 0 });

      // Create a temporary high-res clone for capture to ensure best quality
      const canvas = await html2canvas(certRef.current, {
        scale: 2.5, // Ultra high res
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 210 * 3.7795, // Force A4 width for calculation
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Official_Certificate_${student.name.replace(/\s+/g, '_')}.pdf`);
      
      message.success({ content: 'Download Complete!', key: 'pdf' });
    } catch (err) {
      console.error(err);
      message.error({ content: 'Generation Failed', key: 'pdf' });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Spin size="large" strokeWidth={4} />
      <Text type="secondary" className="animate-pulse">Verifying Security Credentials...</Text>
    </div>;
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Result status="warning" title="Verification Failed" subTitle="The certificate link is invalid or the record has been archived." />
      </div>
    );
  }

  const scoreNum = parseFloat(overallAvg);
  const avgColor = scoreNum >= 70 ? '#166534' : (scoreNum >= 50 ? '#A67C00' : '#991B1B');
  const avgBg = scoreNum >= 70 ? '#ECFDF5' : (scoreNum >= 50 ? '#FFFBEB' : '#FEF2F2');
  const avgBorder = scoreNum >= 70 ? '#10B981' : (scoreNum >= 50 ? '#C9A227' : '#DC2626');

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col" ref={containerRef}>
      
      {/* 🚀 STICKY VERIFICATION HEADER */}
      <div className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-lg border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm hide-on-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-emerald-200 shadow-lg">
            <SafetyCertificateFilled className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 m-0 uppercase tracking-tight">Verified Transcript</h1>
            <div className="flex items-center gap-1">
              <CheckCircleFilled className="text-emerald-500 text-[10px]" />
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Official Digital Record</span>
            </div>
          </div>
        </div>
        <Button 
          type="primary" 
          icon={<DownloadOutlined />} 
          loading={downloading}
          onClick={handleDownloadPDF}
          className="bg-slate-900 hover:bg-black border-none h-10 px-6 rounded-lg font-bold shadow-lg"
        >
          {downloading ? 'Generating...' : 'Save PDF'}
        </Button>
      </div>

      <div className="flex-1 w-full flex flex-col items-center py-6 px-4 overflow-x-hidden">
        
        {/* CERTIFICATE DISPLAY WITH SCALE TRANSFORMATION */}
        <div className="cert-display-wrapper" style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'top center',
          marginBottom: `calc(297mm * ${1 - scale} * -1)` 
        }}>
          <div ref={certRef} className="cert-container" style={{
            width: '210mm',
            minHeight: '297mm',
            background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F0 100%)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            color: '#1A1A1A',
            boxSizing: 'border-box'
          }}>
            {/* Elegant Double Border */}
            <div style={{ position: 'absolute', inset: '12px', border: '2.5px solid #C9A227', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(201,162,39,0.3)', pointerEvents: 'none' }} />

            {/* Corner Motifs */}
            <svg style={{ position: 'absolute', top: '12px', left: '12px', width: '32px', height: '32px', color: '#C9A227' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(90deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', bottom: '12px', left: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', bottom: '12px', right: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(180deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>

            {/* Logo Watermark Overlay */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.025, zIndex: 1, pointerEvents: 'none' }}>
              <img src="/logo.png" alt="" style={{ width: '450px', height: '450px', objectFit: 'contain' }} crossOrigin="anonymous" />
            </div>

            {/* Header Content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', zIndex: 10, textAlign: 'center' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '110px', height: '110px', marginBottom: '16px', objectFit: 'contain' }} crossOrigin="anonymous" />
              <span className="cert-amharic" style={{ fontSize: '28px', fontWeight: '800', color: '#0F3A2B', marginBottom: '4px' }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</span>
              <span className="cert-amharic" style={{ fontSize: '14px', color: '#A67C00', fontStyle: 'italic', fontWeight: '600' }}>"በሃይማኖትና በምግባር የታነጹ ትውልድን ማፍራት"</span>
              <div style={{ marginTop: '24px' }}>
                <span className="cert-amharic" style={{ fontSize: '32px', color: '#000', fontWeight: '900' }}>የክፍል ትምህርት ማስረጃ</span>
                <div style={{ width: '220px', height: '3px', backgroundColor: '#C9A227', margin: '8px auto' }}></div>
              </div>
            </div>

            {/* Student Identity Card */}
            <div className="doc-card" style={{ padding: '32px 40px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
              <div style={{ flex: 1 }}>
                <span className="cert-amharic" style={{ fontSize: '12px', color: '#666', fontWeight: '800', letterSpacing: '0.05em' }}>ሙሉ ስም / FULL NAME</span>
                <span className="cert-amharic" style={{ fontSize: '44px', fontWeight: '950', display: 'block', lineHeight: 1, marginTop: '4px' }}>{student.name}</span>
                {!!(student?.baptismalName || student?.baptismalname) && (
                  <div style={{ marginTop: '12px' }}>
                    <span className="cert-amharic" style={{ fontSize: '11px', color: '#666', fontWeight: '700' }}>የክርስትና ስም / BAPTISMAL NAME</span>
                    <span className="cert-amharic" style={{ fontSize: '20px', fontWeight: '800', color: '#0F3A2B', display: 'block' }}>{student.baptismalName || student.baptismalname}</span>
                  </div>
                )}
              </div>
              <div style={{ borderLeft: '2px dashed #DDD', paddingLeft: '40px', display: 'flex', gap: '48px' }}>
                <div>
                  <span className="cert-amharic" style={{ fontSize: '12px', color: '#666', fontWeight: '800' }}>ዓመተ ምሕረት / YEAR</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', display: 'block', color: '#1A1A1A' }}>{getEthiopianYear(student.academicyear || student.academicYear || dayjs().toISOString())} ዓ.ም</span>
                </div>
                <div>
                  <span className="cert-amharic" style={{ fontSize: '12px', color: '#666', fontWeight: '800' }}>ክፍል / GRADE</span>
                  <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F3A2B', display: 'block' }}>{student.grade}</span>
                </div>
              </div>
            </div>

            {/* Performance Table */}
            <div className="doc-card" style={{ flex: 1, padding: '28px 36px', zIndex: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                <thead>
                  <tr style={{ borderBottom: '2.5px solid #1A1A1A' }}>
                    <th style={{ textAlign: 'left', padding: '14px', color: '#1A1A1A', fontWeight: '900' }}>የትምህርት ዓይነት / SUBJECT</th>
                    <th style={{ textAlign: 'center', padding: '14px', color: '#1A1A1A', fontWeight: '900' }}>፩ኛ</th>
                    <th style={{ textAlign: 'center', padding: '14px', color: '#1A1A1A', fontWeight: '900' }}>፪ኛ</th>
                    <th style={{ textAlign: 'center', padding: '14px', color: '#1A1A1A', fontWeight: '900' }}>አማካይ</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: idx % 2 === 0 ? 'transparent' : '#F9FAFB' }}>
                      <td style={{ padding: '16px 14px', fontWeight: '800', color: '#1A1A1A' }}>{row.subject}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700' }}>{row.semI}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700' }}>{row.semII}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          display: 'inline-block', width: '56px', padding: '6px 0', borderRadius: '6px', fontWeight: '900',
                          backgroundColor: parseFloat(row.avg) >= 70 ? '#DCFCE7' : '#F1F5F9',
                          color: parseFloat(row.avg) >= 70 ? '#166534' : '#1E293B',
                          border: `1px solid ${parseFloat(row.avg) >= 70 ? '#BBF7D0' : '#E2E8F0'}`
                        }}>{row.avg}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Ranking & Average Section */}
              <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2.5px solid #1A1A1A', paddingTop: '32px' }}>
                <div style={{ display: 'flex', gap: '56px' }}>
                  <div>
                    <span className="cert-amharic" style={{ fontSize: '13px', color: '#555', fontWeight: '800' }}>ጠቅላላ ውጤት</span>
                    <span style={{ fontSize: '32px', fontWeight: '950', display: 'block', color: '#000' }}>{overallEarned} <span style={{fontSize:'16px', color:'#999', fontWeight:'700'}}>/ {overallMax}</span></span>
                  </div>
                  <div>
                    <span className="cert-amharic" style={{ fontSize: '13px', color: '#555', fontWeight: '800' }}>ደረጃ / RANK</span>
                    <span style={{ fontSize: '24px', fontWeight: '900', display: 'block', color: '#1A1A1A' }}>{rankInfo.classRank || '-'} <span style={{fontSize:'14px', color:'#999', fontWeight:'700'}}>/ {rankInfo.totalInClass || '-'}</span></span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span className="cert-amharic" style={{ fontSize: '14px', color: avgColor, fontWeight: '950', letterSpacing: '0.05em' }}>አማካይ ውጤት</span>
                  <div style={{ padding: '14px 28px', background: avgBg, border: `2.5px solid ${avgBorder}`, borderRadius: '12px', marginTop: '6px', boxShadow: `0 4px 12px ${avgBorder}20` }}>
                    <span style={{ fontSize: '40px', fontWeight: '1000', color: avgColor }}>{overallAvg}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Verification QR & Signatures */}
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 24px', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '10px', border: '1.5px solid #C9A227', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <QRCodeCanvas value={`https://senbet-students-management-system.vercel.app/verify/${student.id}`} size={70} level="H" />
                </div>
                <div style={{ maxWidth: '160px' }}>
                  <span className="cert-amharic" style={{ fontSize: '13px', fontWeight: '900', color: '#0F3A2B', display: 'block' }}>ትክክለኛ ዲጂታል ማስረጃ</span>
                  <span style={{ fontSize: '10px', color: '#666', lineHeight: 1.3 }}>Use this QR code to verify the authenticity of this record at any time.</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '64px' }}>
                <div style={{ width: '130px', borderTop: '2px solid #000', textAlign: 'center', paddingTop: '6px' }}>
                  <span className="cert-amharic" style={{fontSize:'11px', fontWeight:'900'}}>ሥራ አስኪያጅ</span>
                </div>
                <div style={{ width: '130px', borderTop: '2px solid #000', textAlign: 'center', paddingTop: '6px' }}>
                  <span className="cert-amharic" style={{fontSize:'11px', fontWeight:'900'}}>አስተባባሪ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .hide-on-print { display: none !important; }
          .cert-display-wrapper { transform: none !important; margin: 0 !important; width: 100% !important; }
          body { background: white !important; }
          @page { margin: 0; size: A4 portrait; }
        }
        
        .cert-display-wrapper {
          box-shadow: 0 30px 60px rgba(15, 23, 42, 0.15);
          border-radius: 4px;
          background: white;
          transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .doc-card {
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .cert-amharic { 
          font-family: 'Noto Sans Ethiopic', 'Inter', sans-serif; 
          font-feature-settings: "tnum";
        }

        /* Prevent text selection to look more like a secure document */
        .cert-container {
          user-select: none;
        }
      `}} />
    </div>
  );
}
