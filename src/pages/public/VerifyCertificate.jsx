import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Typography, message } from 'antd';
import { DownloadOutlined, SafetyCertificateFilled, CheckCircleFilled } from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../utils/supabaseClient';
import { calculateSubjectRows, calculateSingleStudentRank } from '../../utils/analyticsEngine';
import { getEthiopianYear } from '../../utils/dateUtils';

const { Text } = Typography;

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

  // 📐 ROBUST SCALING ENGINE
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const certWidthInPixels = 210 * 3.7795; // A4 width in px
        const padding = 16;
        
        if (containerWidth < certWidthInPixels + padding) {
          const newScale = (containerWidth - padding) / certWidthInPixels;
          setScale(newScale);
        } else {
          setScale(1);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    const timer = setTimeout(handleResize, 300);
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
        if (!studentData) throw new Error("Not Found");
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

  const handleDownloadPDF = async () => {
    if (!certRef.current) return;
    try {
      setDownloading(true);
      const hideMsg = message.loading('Generating Official High-Res Document...', 0);

      // CRITICAL: Temporarily reset scale for high-quality capture
      const originalTransform = certRef.current.style.transform;
      const originalMargin = certRef.current.style.margin;
      
      // Force 1:1 scale for capture
      certRef.current.style.transform = 'none';
      certRef.current.style.margin = '0';
      
      // Wait for re-render
      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(certRef.current, {
        scale: 3, // Very high res
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 15000,
      });

      // Restore original view scale
      certRef.current.style.transform = originalTransform;
      certRef.current.style.margin = originalMargin;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'SLOW');
      pdf.save(`Official_Record_${student.name.replace(/\s+/g, '_')}.pdf`);
      
      hideMsg();
      message.success('Download Complete');
    } catch (err) {
      console.error(err);
      message.error('Generation Failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Spin size="large" /></div>;
  if (error || !student) return <div className="min-h-screen flex items-center justify-center bg-white"><Text type="danger">Verification Error</Text></div>;

  const scoreNum = parseFloat(overallAvg);
  const avgColor = scoreNum >= 70 ? '#166534' : (scoreNum >= 50 ? '#A67C00' : '#991B1B');
  const avgBg = scoreNum >= 70 ? '#ECFDF5' : (scoreNum >= 50 ? '#FFFBEB' : '#FEF2F2');
  const avgBorder = scoreNum >= 70 ? '#10B981' : (scoreNum >= 50 ? '#C9A227' : '#DC2626');

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center overflow-x-hidden" ref={containerRef}>
      
      {/* 🟢 TOP STATUS RIBBON (NON-CLICKABLE) */}
      <div className="w-full bg-[#10B981] py-3 flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
        <SafetyCertificateFilled className="text-white text-lg" />
        <span className="text-white font-bold text-xs uppercase tracking-widest pointer-events-none">Officially Verified Document</span>
        <CheckCircleFilled className="text-white text-xs" />
      </div>

      {/* 📥 FLOATING DOWNLOAD BUTTON */}
      <button 
        onClick={handleDownloadPDF}
        disabled={downloading}
        style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: 100,
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#0F172A',
            color: 'white',
            border: 'none',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
        }}
        className="download-fab hide-on-print"
      >
        {downloading ? <Spin size="small" /> : <DownloadOutlined style={{ fontSize: '28px' }} />}
      </button>

      <div className="flex-1 w-full flex flex-col items-center pt-8 pb-24 px-2">
        
        {/* CERTIFICATE BODY */}
        <div 
          ref={certRef} 
          className="cert-body" 
          style={{
            width: '210mm', 
            minHeight: '297mm', 
            background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F0 100%)',
            padding: '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative', 
            color: '#1A1A1A',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `calc(297mm * ${1 - scale} * -1)`,
            boxShadow: '0 30px 60px rgba(0,0,0,0.12)',
            borderRadius: '4px'
          }}
        >
          {/* Borders */}
          <div style={{ position: 'absolute', inset: '12px', border: '2.5px solid #C9A227', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(201,162,39,0.3)', pointerEvents: 'none' }} />
          
          {/* Watermark */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.03, zIndex: 1, pointerEvents: 'none' }}>
            <img src="/logo.png" alt="" style={{ width: '450px' }} crossOrigin="anonymous" />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', zIndex: 10 }}>
            <img src="/logo.png" alt="" style={{ width: '100px', height: '100px', marginBottom: '16px' }} crossOrigin="anonymous" />
            <span className="cert-amharic" style={{ fontSize: '28px', fontWeight: '800', color: '#0F3A2B', marginBottom: '4px' }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</span>
            <span className="cert-amharic" style={{ fontSize: '14px', color: '#A67C00', fontStyle: 'italic' }}>"በሃይማኖትና በምግባር የታነጹ ትውልድን ማፍራት"</span>
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <span className="cert-amharic" style={{ fontSize: '32px', color: '#000', fontWeight: '900' }}>የትምህርት ማስረጃ</span>
              <div style={{ width: '200px', height: '3px', backgroundColor: '#C9A227', margin: '8px auto' }}></div>
            </div>
          </div>

          {/* Student Info */}
          <div className="cert-card-inner" style={{ padding: '30px 40px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div>
              <span className="cert-amharic" style={{ fontSize: '11px', color: '#666', fontWeight: '800' }}>ሙሉ ስም / FULL NAME</span>
              <span className="cert-amharic" style={{ fontSize: '42px', fontWeight: '950', display: 'block', lineHeight: 1.1 }}>{student.name}</span>
              {!!(student?.baptismalName || student?.baptismalname) && (
                <span className="cert-amharic" style={{ fontSize: '18px', fontWeight: '800', color: '#0F3A2B', display: 'block', marginTop: '8px' }}>{student.baptismalName || student.baptismalname}</span>
              )}
            </div>
            <div style={{ borderLeft: '2px dashed #DDD', paddingLeft: '40px' }}>
              <div style={{ marginBottom: '8px' }}>
                <span className="cert-amharic" style={{ fontSize: '11px', color: '#666' }}>ዓ.ም / YEAR</span>
                <span style={{ fontSize: '18px', fontWeight: '800', display: 'block' }}>{getEthiopianYear(student.academicyear || student.academicYear || dayjs().toISOString())}</span>
              </div>
              <div>
                <span className="cert-amharic" style={{ fontSize: '11px', color: '#666' }}>ክፍል / GRADE</span>
                <span style={{ fontSize: '24px', fontWeight: '900', color: '#0F3A2B', display: 'block' }}>{student.grade}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="cert-card-inner" style={{ flex: 1, padding: '24px 32px', zIndex: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
              <thead>
                <tr style={{ borderBottom: '2.5px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '12px' }}>የትምህርት ዓይነት / SUBJECT</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>፩ኛ</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>፪ኛ</th>
                  <th style={{ textAlign: 'center', padding: '12px' }}>አማካይ</th>
                </tr>
              </thead>
              <tbody>
                {subjectRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #EEE', backgroundColor: idx % 2 === 0 ? 'transparent' : '#FAFAFA' }}>
                    <td style={{ padding: '14px 12px', fontWeight: '800' }}>{row.subject}</td>
                    <td style={{ textAlign: 'center' }}>{row.semI}</td>
                    <td style={{ textAlign: 'center' }}>{row.semII}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontWeight: '900', background: parseFloat(row.avg) >= 70 ? '#DCFCE7' : '#F1F5F9', color: parseFloat(row.avg) >= 70 ? '#166534' : '#1A1A1A' }}>{row.avg}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #000', paddingTop: '32px' }}>
              <div style={{ display: 'flex', gap: '48px' }}>
                <div>
                  <span className="cert-amharic" style={{ fontSize: '11px', color: '#666' }}>ጠቅላላ ውጤት</span>
                  <span style={{ fontSize: '32px', fontWeight: '950', display: 'block' }}>{overallEarned} <span style={{fontSize:'16px', color:'#999'}}>/ {overallMax}</span></span>
                </div>
                <div>
                  <span className="cert-amharic" style={{ fontSize: '11px', color: '#666' }}>ደረጃ / RANK</span>
                  <span style={{ fontSize: '24px', fontWeight: '900', display: 'block' }}>{rankInfo.classRank || '-'} <span style={{fontSize:'14px', color:'#999'}}>/ {rankInfo.totalInClass || '-'}</span></span>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span className="cert-amharic" style={{ fontSize: '13px', color: avgColor, fontWeight: '900' }}>አማካይ ውጤት</span>
                <div style={{ padding: '12px 24px', background: avgBg, border: `2.5px solid ${avgBorder}`, borderRadius: '12px', marginTop: '6px' }}>
                  <span style={{ fontSize: '36px', fontWeight: '950', color: avgColor }}>{overallAvg}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 20px', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '8px', background: 'white', borderRadius: '8px', border: '1.5px solid #C9A227' }}>
                <QRCodeCanvas value={`https://senbet-students-management-system.vercel.app/verify/${student.id}`} size={64} level="H" />
              </div>
              <div style={{ maxWidth: '140px' }}>
                <span className="cert-amharic" style={{ fontSize: '12px', fontWeight: '800', color: '#0F3A2B', display: 'block' }}>ትክክለኛ ዲጂታል ማስረጃ</span>
                <span style={{ fontSize: '9px', color: '#666' }}>Verified official document record.</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '48px' }}>
              <div style={{ width: '120px', borderTop: '2.5px solid #000', textAlign: 'center', paddingTop: '6px' }}>
                <span className="cert-amharic" style={{fontSize:'10px', fontWeight:'900'}}>ሥራ አስኪያጅ</span>
              </div>
              <div style={{ width: '120px', borderTop: '2.5px solid #000', textAlign: 'center', paddingTop: '6px' }}>
                <span className="cert-amharic" style={{fontSize:'10px', fontWeight:'900'}}>አስተባባሪ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .cert-card-inner { background: white; border: 1px solid #E2E8F0; border-radius: 12px; }
        .cert-amharic { font-family: 'Noto Sans Ethiopic', sans-serif; }
        .download-fab:active { transform: scale(0.9); }
        .download-fab:hover { background-color: #000 !important; }
        @media print { 
          .hide-on-print { display: none !important; } 
          .cert-body { transform: none !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; } 
        }
      `}} />
    </div>
  );
}
