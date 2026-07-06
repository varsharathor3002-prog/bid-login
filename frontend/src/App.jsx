import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/auth/Login";
import Registration from "./Registration";
import ForgotPassword from "./components/auth/ForgotPassword";
import AddAnalyser from "./components/auth/AddAnalyser";
 import AnalyserDocument from "./pages/Desktop/Analyser/Analyserdocument";
import DesktopBidApproval from "./pages/Desktop/Admin/DesktopBidApproval";



import UserNavbar from "./components/user/UserNavbar";
import CreateDesktopBid from "./pages/Desktop/User/CreateDesktopBid";
import CreateWorkstationBid from "./pages/Workstation/User/CreateWorkstationBid";

import AnalyserNavbar from "./components/analyser/AnalyserNavbar";
import AnalyserDashboard from "./pages/Desktop/Analyser/AnalyserDashboard";
import BidDetailView from "./pages/Desktop/Analyser/BidDetailView";
import AnalyserProductsPage from "./pages/Desktop/Analyser/AnalyserProductsPage";
import AdminNavbar from "./components/Admin/AdminNavbar";

const ComingSoon = ({ product }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
    <div className="text-6xl">🚧</div>
    <h2 className="text-2xl font-bold text-gray-600">{product} — Coming Soon</h2>
    <p className="text-gray-400 +text-sm">Yeh section abhi development mein hai.</p>
  </div>
);

const AdminWelcome = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
    <div className="text-6xl">👈</div>
    <h2 className="text-2xl font-bold text-gray-600">Select an option from Sidebar</h2>
    <p className="text-gray-400 text-sm">Left sidebar se koi option choose karein.</p>
  </div>
);

function App() {
  return (
    <div className="app-content">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Registration />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/user" element={<UserNavbar />}>
          <Route index element={<div>Select a product</div>} />
          <Route path="aio" element={<div>AIO Page Content</div>} />
          <Route path="printer" element={<div>Printer Content</div>} />
          <Route path="toner" element={<div>Toner Content</div>} />
        </Route>

        <Route path="/user/desktop" element={<CreateDesktopBid />} />
        <Route path="/user/workstation" element={<CreateWorkstationBid />} />

        <Route path="/analyser-dashboard" element={<AnalyserNavbar />}>
          <Route index element={<Navigate to="/analyser-dashboard/desktop" replace />} />
          <Route path="desktop" element={<AnalyserDashboard product="desktop" />} />
          <Route path="aio" element={<ComingSoon product="AIO" />} />
          <Route path="workstation" element={<ComingSoon product="Workstation" />} />
          <Route path="printer" element={<ComingSoon product="Printer" />} />
          <Route path="toner" element={<ComingSoon product="Toner" />} />
        </Route>

        <Route path="/analyser-dashboard/product" element={<AnalyserProductsPage />} />
        <Route path="/analyser-dashboard/desktop/bid/:id" element={<BidDetailView product="desktop" />} />

<Route path="/analyser-document" element={<AnalyserDocument />} />
        <Route path="/admin-dashboard" element={<AdminNavbar />}>
          <Route index element={<AdminWelcome />} />
          <Route path="add-user" element={<Registration />} />
          <Route path="add-analyser" element={<AddAnalyser />} />
          <Route
            path="add-product"
            element={
              <div className="text-2xl font-bold text-gray-700">
                Add Product Coming Soon 🚀
              </div>
            }
          />
        </Route>

        <Route path="/admin-dashboard/desktop-bid-approval" element={<DesktopBidApproval />} />
        <Route path="/desktop-bid-approval" element={<Navigate to="/admin-dashboard/desktop-bid-approval" replace />} />

       
       

        <Route
          path="*"
          element={
            <div className="h-screen flex items-center justify-center text-3xl font-bold text-red-500">
              404 Page Not Found
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
