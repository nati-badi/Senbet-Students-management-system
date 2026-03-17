import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: {
    translation: {
      "app": {
        "title": "Senbet Teacher",
        "welcome": "Welcome to Arsema Senbet School",
        "description": "Offline-first student management.",
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
        "title": "ሰንበት መምህር",
        "welcome": "ወደ አርሴማ ሰንበት ትምህርት ቤት እንኳን በደህና መጡ",
        "description": "ያለበይነመረብ የሚሰራ የተማሪዎች አስተዳደር።",
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
