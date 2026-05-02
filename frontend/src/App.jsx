import { Routes, Route, useLocation } from "react-router-dom";
import Login from "./Login";
import Registration from "./Registration";
import Header from "./components/Header";
import AdminDashboard from "./Admin/AdminDashboard";
import DesktopBidApproval from "./Admin/DesktopBidApproval";
import AIOBidApproval from "./Admin/AIOBidApproval";
import PriceList from "./Admin/PriceList";


function App() {
  const location = useLocation();

  // ✅ hide header on login, register & admin dashboard
  const hideLayout =
    location.pathname === "/" ||
    location.pathname === "/register" ||
    location.pathname === "/admin-dashboard";

  return (
    <>
      {/* Header */}
      {!hideLayout && <Header />}

      {/* Main Content */}
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/desktop-bid-approval" element={<DesktopBidApproval />} />
          <Route path="/aio-bid-approval" element={<AIOBidApproval />} />
          <Route path="/price/:type" element={<PriceList />} />
        </Routes>
      </div>
    </>
  );
}

export default App;