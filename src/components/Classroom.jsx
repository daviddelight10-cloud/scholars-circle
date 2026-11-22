import { ClassroomRoot } from "../features/Classroom/ClassroomRoot.jsx";

/**
 * Classroom — thin wrapper kept for the existing import contract in
 * pages/Classroom.jsx (student app + faculty portal). The implementation
 * lives in src/features/Classroom/.
 */
export function Classroom(props) {
  return <ClassroomRoot {...props} />;
}
