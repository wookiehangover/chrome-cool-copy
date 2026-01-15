import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SharePage } from "@/pages/SharePage";
import { NotFound } from "@/pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/share/:shareId" element={<SharePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

