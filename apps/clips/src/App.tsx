import { HashRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { ClipsList } from "@/components/ClipsList";
import { ClipViewer } from "@/components/ClipViewer";
import { MediaClipViewer } from "@/components/MediaClipViewer";

// Handle legacy ?id=<clipId> URLs from before React Router
function LegacyRedirect() {
  const [searchParams] = useSearchParams();
  const clipId = searchParams.get("id");

  if (clipId) {
    return <Navigate to={`/viewer/${clipId}`} replace />;
  }
  return <Navigate to="/clips" replace />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LegacyRedirect />} />
        <Route
          path="/clips"
          element={
            <div className="flex h-screen w-full flex-col bg-background text-foreground">
              <ClipsList />
            </div>
          }
        />
        <Route path="/viewer/:clipId" element={<ClipViewer />} />
        <Route path="/media/:mediaId" element={<MediaClipViewer />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
