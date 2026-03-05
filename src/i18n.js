import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    en: {
        translation: {
            "app": {
                "title": "B/G/D/A/Q/Arsema Finote Birhan S/Bet",
                "welcome": "Welcome to B/G/D/A/Q/Arsema Finote Birhan S/Bet",
                "description": "The zero-cost, offline-first student management system designed for pure simplicity.",
                "adminPortal": "Admin Portal",
                "teacherPortal": "Teacher Portal"
            },
            "common": {
                "comingSoon": "Coming Soon",
                "save": "Save",
                "actions": "Actions",
                "delete": "Delete"
            },
            "admin": {
                "menu": "Admin Menu",
                "registerStudents": "Register Students",
                "certificates": "Certificates",
                "systemData": "System Data",
                "registerNewStudent": "Register New Student",
                "addStudentsDesc": "Add students to the local database.",
                "fullName": "Full Name",
                "namePlaceholder": "e.g. Abebe Kebede",
                "baptismalNameField": "Baptismal Name",
                "baptismalPlaceholder": "e.g. Gebre Mariam",
                "gradeClass": "Grade / Class",
                "gradePlaceholder": "e.g. Grade 1",
                "parentContact": "Parent Contact",
                "contactPlaceholder": "e.g. 0911...",
                "saveStudent": "Save Student",
                "enrolledStudents": "Enrolled Students",
                "noStudentsYet": "No students registered yet.",
                "name": "Name",
                "baptismalName": "Baptismal Name",
                "grade": "Grade",
                "contact": "Contact",
                "generateCertificates": "Generate Certificates",
                "generatorDesc": "Automatically generate PDF mark sheets / certificates for all students.",
                "downloadAllCertificates": "Download All Certificates (PDF)",
                "noMarksYet": "No marks have been recorded yet. Cannot generate certificates.",
                "selectGradeCerts": "Select Grade to Generate"
            },
            "teacher": {
                "menu": "Teacher Menu",
                "markEntry": "Mark Entry",
                "attendance": "Attendance",
                "speedEntryMarks": "Speed-Entry Marks",
                "attendanceModule": "Attendance Module",
                "selectGrade": "Select Grade",
                "subject": "Subject (e.g. Math)",
                "assessmentLabel": "Assessment Name (e.g. Midterm)",
                "enterMarksInfo": "Select a grade and subject to quickly enter marks for all students.",
                "recordAttendanceInfo": "Select a grade and date to record daily attendance.",
                "date": "Date",
                "score": "Score / Out of 100",
                "present": "Present",
                "absent": "Absent",
                "late": "Late",
                "savedLocal": "Saved Locally",
                "noStudentsInGrade": "No students found in this grade."
            }
        }
    },
    am: {
        translation: {
            "app": {
                "title": "በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት",
                "welcome": "ወደ በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት እንኳን በደህና መጡ",
                "description": "ያለበይነመረብ ሊሰራ የሚችል፣ ሙሉ በሙሉ ነፃ የሆነ የተማሪ አስተዳደር ስርዓት።",
                "adminPortal": "የአስተዳዳሪ ማዕከል",
                "teacherPortal": "የመምህራን ማዕከል"
            },
            "common": {
                "comingSoon": "በቅርቡ የሚመጣ",
                "save": "አስቀምጥ",
                "actions": "ድርጊቶች",
                "delete": "ሰርዝ"
            },
            "admin": {
                "menu": "የአስተዳዳሪ ምናሌ",
                "registerStudents": "ተማሪዎችን መመዝገብ",
                "certificates": "የምስክር ወረቀቶች",
                "systemData": "የስርዓት መረጃ",
                "registerNewStudent": "አዲስ ተማሪ ይመዝገቡ",
                "addStudentsDesc": "ተማሪዎችን ወደ አካባቢያዊ የውሂብ ጎታ ያክሉ።",
                "fullName": "ሙሉ ስም",
                "namePlaceholder": "ለምሳሌ አበበ ከበደ",
                "baptismalNameField": "የክርስትና ስም",
                "baptismalPlaceholder": "ለምሳሌ ገብረ ማርያም",
                "gradeClass": "ክፍል",
                "gradePlaceholder": "ለምሳሌ 1ኛ ክፍል",
                "parentContact": "የወላጅ ስልክ ቁጥር",
                "contactPlaceholder": "ለምሳሌ 0911...",
                "saveStudent": "ተማሪ መዝግብ",
                "enrolledStudents": "የተመዘገቡ ተማሪዎች",
                "noStudentsYet": "እስካሁን ምንም ተማሪ አልተመዘገበም።",
                "name": "ስም",
                "baptismalName": "የክርስትና ስም",
                "grade": "ክፍል",
                "contact": "ስልክ ቁጥር",
                "generateCertificates": "የምስክር ወረቀቶችን ማመንጨት",
                "generatorDesc": "ለሁሉም ተማሪዎች በራስ ሰር የPDF የምስክር ወረቀቶችን ይፍጠሩ።",
                "downloadAllCertificates": "የምስክር ወረቀቶችን ያውርዱ (PDF)",
                "noMarksYet": "ምንም አይነት ውጤት አልተመዘገበም። የምስክር ወረቀት ማመንጨት አይቻልም።",
                "selectGradeCerts": "ለመፍጠር ክፍል ይምረጡ"
            },
            "teacher": {
                "menu": "የመምህራን ምናሌ",
                "markEntry": "ውጤት መመዝገቢያ",
                "attendance": "ክትትል",
                "speedEntryMarks": "ፈጣን ውጤት መመዝገቢያ",
                "attendanceModule": "የክትትል ሞጁል",
                "selectGrade": "ክፍል ይምረጡ",
                "subject": "የትምህርት ዓይነት (ለምሳሌ ሂሳብ)",
                "assessmentLabel": "የምዘና ስም (ለምሳሌ አጋማሽ ፈተና)",
                "enterMarksInfo": "ለሁሉም ተማሪዎች ውጤት በፍጥነት ለማስገባት ክፍል እና የትምህርት ዓይነት ይምረጡ።",
                "recordAttendanceInfo": "የዕለት ክትትል ለመመዝገብ ክፍል እና ቀን ይምረጡ።",
                "date": "ቀን",
                "score": "ውጤት (ከ 100)",
                "present": "ተገኝቷል",
                "absent": "ቀሪ",
                "late": "አርፍዷል",
                "savedLocal": "ተቀምጧል (Local)",
                "noStudentsInGrade": "በዚህ ክፍል ተማሪዎች አልተገኙም።"
            }
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;
