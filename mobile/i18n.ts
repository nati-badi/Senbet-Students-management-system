import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: {
    translation: {
      "app": {
        "title": "በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት",
        "welcome": "ወደ አርሴማ ሰንበት ትምህርት ቤት እንኳን በደህና መጡ",
        "description": "Offline-first student management.",
        "welcomeMessage": "Welcome! Please select your portal",
        "teacherPortal": "Teacher Portal"
      },
      "parent": {
        "title": "Parent Portal",
        "searchTitle": "Find Student Results",
        "searchDesc": "Enter the student full name or their ID/Portal code to view academic records.",
        "studentNameOrId": "Student Name or ID",
        "searchPlaceholder": "e.g. Abebe or S001...",
        "notFound": "Student Not Found",
        "notFoundDesc": "We couldn't find a student with that name or ID.",
        "results": "Academic Results",
        "noAssessments": "No assessments recorded yet.",
        "attendanceSoon": "Detailed attendance history integration coming soon.",
        "searchAnother": "Search Another Student"
      },
      "common": {
        "save": "Save",
        "cancel": "Cancel",
        "delete": "Delete",
        "logout": "Logout",
        "login": "Login",
        "search": "Search...",
        "sync": "Sync",
        "loading": "Loading...",
      },
      "teacher": {
        "portalLogin": "Portal Login",
        "teacherName": "Teacher Name",
        "accessCode": "Access Code",
        "students": "Students",
        "attendance": "Attendance",
        "marks": "Marks",
        "urgent": "Urgent",
        "markAllPresent": "Mark All Present",
        "fillConstant": "Fill Constant Mark",
        "predictMarks": "Predict Missing Marks",
        "present": "Present",
        "absent": "Absent",
        "late": "Late",
        "noHistory": "No history found for prediction.",
        "saveSuccess": "Saved successfully!",
        "syncSuccess": "Data synced!",
        "syncError": "Sync failed.",
        "analytics": "Analytics",
        "totalAssessments": "Total Assessments",
        "missingMarks": "Missing Marks",
        "scanID": "Scan ID Card",
        "selectGrade": "Select Grade",
        "clearAll": "Clear All",
        "clearAllMarks": "Clear All Marks?",
        "confirmClearAll": "This will remove all marks for the current assessment. This cannot be undone once saved.",
      },
      "profile": {
        "title": "Student Profile",
        "overview": "Overview",
        "attendance": "Attendance",
        "marks": "Marks",
        "cert": "Certificate",
        "baptismalName": "Baptismal Name",
        "grade": "Grade",
        "contact": "Contact",
        "rank": "Rank",
        "average": "Average",
      },
      "dashboard": {
        "title": "Dashboard",
        "totalStudents": "Total Students",
        "attendanceToday": "Attendance Today",
        "recentActivity": "Recent Activity",
      }
    }
  },
  am: {
    translation: {
      "app": {
        "title": "በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት",
        "welcome": "ወደ አርሴማ ሰንበት ትምህርት ቤት እንኳን በደህና መጡ",
        "description": "ያለበይነመረብ የሚሰራ የተማሪዎች አስተዳደር።",
        "welcomeMessage": "እንኳን ደህና መጡ! እባክዎ መግቢያዎን ይምረጡ",
        "teacherPortal": "የመምህራን መግቢያ"
      },
      "parent": {
        "title": "የወላጆች መግቢያ",
        "searchTitle": "የተማሪ ውጤት ፈልግ",
        "searchDesc": "የተማሪውን ሙሉ ስም ወይም የመለያ ቁጥር በማስገባት የትምህርት መረጃውን መመልከት ይችላሉ።",
        "studentNameOrId": "የተማሪ ስም ወይም መለያ ቁጥር",
        "searchPlaceholder": "ምሳሌ፡ አበበ ወይም S001...",
        "notFound": "ተማሪው አልተገኘም",
        "notFoundDesc": "በዚህ ስም ወይም መለያ ቁጥር የተመዘገበ ተማሪ አላገኘንም።",
        "results": "የትምህርት ውጤቶች",
        "noAssessments": "እስካሁን ምንም አይነት የምዘና ውጤት አልተመዘገበም።",
        "attendanceSoon": "ዝርዝር የክትትል ታሪክ በቅርቡ ይካተታል።",
        "searchAnother": "ሌላ ተማሪ ፈልግ"
      },
      "common": {
        "save": "አስቀምጥ",
        "cancel": "ሰርዝ",
        "delete": "አጥፋ",
        "logout": "ውጣ",
        "login": "ግባ",
        "search": "ፈልግ...",
        "sync": "አመሳስል",
        "loading": "በመጫን ላይ...",
      },
      "teacher": {
        "portalLogin": "የመምህራን መግቢያ",
        "teacherName": "የመምህር ስም",
        "accessCode": "የመግቢያ ኮድ",
        "students": "ተማሪዎች",
        "attendance": "ክትትል",
        "marks": "ውጤት",
        "urgent": "አስቸኳይ",
        "markAllPresent": "ሁሉንም ተገኝተዋል በል",
        "fillConstant": "ተመሳሳይ ውጤት ሙላ",
        "predictMarks": "ቀሪ ውጤቶችን ገምት",
        "present": "ተገኝቷል",
        "absent": "ቀሪ",
        "late": "አርፍዷል",
        "noHistory": "ለመገመት የሚያስችል ታሪክ አልተገኘም።",
        "saveSuccess": "በተሳካ ሁኔታ ተቀምጧል!",
        "syncSuccess": "ውሂቡ ታምርቷል!",
        "syncError": "ማመሳሰል አልተሳካም።",
        "analytics": "ትንተና",
        "totalAssessments": "ጠቅላላ ምዘናዎች",
        "missingMarks": "ያልተሞሉ ውጤቶች",
        "scanID": "መታወቂያ ይቃኙ",
        "selectGrade": "ክፍል ይምረጡ",
        "clearAll": "ሁሉንም አጥፋ",
        "clearAllMarks": "ሁሉንም ውጤቶች አጥፋ?",
        "confirmClearAll": "ይህ ለዚህ ምዘና የተመዘገቡትን ውጤቶች በሙሉ ያጠፋል። አንዴ ከተቀመጠ በኋላ መመለስ አይቻልም።",
      },
      "profile": {
        "title": "የተማሪ መገለጫ",
        "overview": "አጠቃላይ እይታ",
        "attendance": "ክትትል",
        "marks": "ውጤት",
        "cert": "ምሥክር ወረቀት",
        "baptismalName": "የክርስትና ስም",
        "grade": "ክፍል",
        "contact": "ስልክ ቁጥር",
        "rank": "ደረጃ",
        "average": "አማካይ",
      },
      "dashboard": {
        "title": "ዳሽቦርድ",
        "totalStudents": "ጠቅላላ ተማሪዎች",
        "attendanceToday": "የዛሬ ክትትል",
        "recentActivity": "የቅርብ ጊዜ እንቅስቃሴ",
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

// Load language from storage if available
AsyncStorage.getItem('app_language').then(lang => {
  if (lang) i18n.changeLanguage(lang);
});

export default i18n;
