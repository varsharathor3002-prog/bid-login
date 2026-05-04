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

        {/* 👤 USER SIDEBAR LAYOUT — AIO, Workstation, Printer, Toner yahan */}
        <Route path="/user" element={<UserNavbar />}>
          {/* /user par aane par AIO pe redirect */}
          <Route index element={<Navigate to="/user/aio" replace />} />
          <Route path="aio"         element={<div>AIO Page Content</div>} />
          <Route path="workstation" element={<div>Workstation Content</div>} />
          <Route path="printer"     element={<div>Printer Content</div>} />
          <Route path="toner"       element={<div>Toner Content</div>} />
        </Route>

        {/* 📄 DESKTOP BID — Full Page (Sidebar ke BINA) */}
        <Route path="/user/desktop" element={<CreateDesktopBid />} />

        {/* 🧑‍💻 ADMIN ROUTES */}
        <Route path="/admin-dashboard"      element={<AdminDashboard />} />
        <Route path="/desktop-bid-approval" element={<DesktopBidApproval />} />
        <Route path="/aio-bid-approval"     element={<AIOBidApproval />} />
        <Route path="/price/:type"          element={<PriceList />} />

      </Routes>
    </div>
  );
}

export default App;