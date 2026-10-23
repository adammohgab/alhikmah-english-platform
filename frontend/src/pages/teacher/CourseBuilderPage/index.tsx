import { useNavigate, useParams } from "react-router-dom";
import VersionHistoryModal from "./VersionHistoryModal";

/** Route wrapper so the history inspector can also be opened directly from course links. */
export default function CourseVersionHistoryPage() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  if (!courseId) {
    return (
      <main style={{ maxWidth: 760, margin: "3rem auto", padding: 24 }}>
        <h1>Course version history</h1>
        <p>A course ID is required to inspect published versions.</p>
        <button onClick={() => navigate("/teacher")}>Back to teacher portal</button>
      </main>
    );
  }
  return (
    <VersionHistoryModal
      courseId={courseId}
      open
      onClose={() => navigate("/teacher")}
      onRestored={() => undefined}
    />
  );
}
