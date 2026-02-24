import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import ToolPage from './ToolPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tool/:toolId" element={<ToolPage />} />
    </Routes>
  );
}