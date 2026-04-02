$content = Get-Content App.tsx
$content[601] = '              <Tab.Screen name="Attendance">{(props: any) => <AttendanceTab {...props} teacher={teacher!} students={students} attendanceData={attendance} setAttendanceData={setAttendance} onRefresh={() => syncData()} C={C} s={s} showToast={showToast} settings={settings} />}</Tab.Screen>'
$content | Set-Content App.tsx
