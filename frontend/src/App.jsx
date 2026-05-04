import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Registration from "./Registration";
import AdminDashboard from "./Admin/AdminDashboard";
import DesktopBidApproval from "./Admin/DesktopBidApproval";
import AIOBidApproval from "./Admin/AIOBidApproval";
import PriceList from "./Admin/PriceList";
import UserNavbar from "./components/user/UserNavbar";
import CreateDesktopBid from "./pages/user/CreateDesktopBid";

function App() {
  return (
    <div className="app-content">
      <Routes>
        {/* 🔐 AUTH ROUTES */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Registration />} />

        {/* 👤 USER SIDEBAR LAYOUT */}
        <Route path="/user" element={<UserNavbar />}>
          {/* Default: /user → redirect to /user/desktop */}
          <Route index element={<Navigate to="/user/desktop" replace />} />

          {/* ✅ Desktop Bid Form — Sidebar ke andar Outlet mein render hoga */}
          <Route path="desktop" element={<CreateDesktopBid />} />

          <Route path="aio" element={<div>AIO Page Content</div>} />
          <Route path="workstation" element={<div>Workstation Content</div>} />
          <Route path="printer" element={<div>Printer Content</div>} />
          <Route path="toner" element={<div>Toner Content</div>} />
        </Route>

        {/* 🧑‍💻 ADMIN ROUTES */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/desktop-bid-approval" element={<DesktopBidApproval />} />
        <Route path="/aio-bid-approval" element={<AIOBidApproval />} />
        <Route path="/price/:type" element={<PriceList />} />
      </Routes>
    </div>
  );
}

export default App;