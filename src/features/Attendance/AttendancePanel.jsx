import HostAttendance from "./HostAttendance.jsx";
import StudentAttendance from "./StudentAttendance.jsx";

/** Classroom "Attendance" tab: lecturers run + review it; members mark + see their record. */
export function AttendancePanel({ classroomId, isHost, token }) {
  return isHost
    ? <HostAttendance classroomId={classroomId} token={token} />
    : <StudentAttendance classroomId={classroomId} token={token} />;
}
