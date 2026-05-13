import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Registration from "./Registration";
import ForgotPassword from "./pages/auth/ForgotPassword";
import AddAnalyser from "./pages/auth/AddAnalyser";

import DesktopBidApproval from "./Admin/DesktopBidApproval";
import AIOBidApproval from "./Admin/AIOBidApproval";
import PriceList from "./Admin/PriceList";

import UserNavbar from "./components/user/UserNavbar";
import CreateDesktopBid from "./pages/user/CreateDesktopBid";

import AnalyserNavbar from "./components/analyser/AnalyserNavbar";
import AnalyserDashboard from "./pages/analyser/AnalyserDashboard";
import BidDetailView from "./pages/analyser/BidDetailView";

import AdminNavbar from "./components/AdminNavbar";

const ComingSoon = ({ product }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
    <div className="text-6xl">🚧</div>

    <h2 className="text-2xl font-bold text-gray-600">
      {product} — Coming Soon
    </h2>

    <p className="text-gray-400 text-sm">
      Yeh section abhi development mein hai.
    </p>
  </div>
);

function App() {

  return (

    <div className="app-content">

      <Routes>

        {/* ================= AUTH ================= */}

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Registration />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        {/* ================= USER ================= */}

        <Route
          path="/user"
          element={<UserNavbar />}
        >

          <Route
            index
            element={<div>Select a product</div>}
          />

          <Route
            path="aio"
            element={<div>AIO Page Content</div>}
          />

          <Route
            path="workstation"
            element={<div>Workstation Content</div>}
          />

          <Route
            path="printer"
            element={<div>Printer Content</div>}
          />

          <Route
            path="toner"
            element={<div>Toner Content</div>}
          />

        </Route>

        {/* USER DESKTOP PAGE */}

        <Route
          path="/user/desktop"
          element={<CreateDesktopBid />}
        />

        {/* ================= ANALYSER ================= */}

        <Route
          path="/analyser-dashboard"
          element={<AnalyserNavbar />}
        >

          <Route
            index
            element={
              <Navigate
                to="/analyser-dashboard/desktop"
                replace
              />
            }
          />

          <Route
            path="desktop"
            element={<AnalyserDashboard product="desktop" />}
          />

          <Route
            path="aio"
            element={<ComingSoon product="AIO" />}
          />

          <Route
            path="workstation"
            element={<ComingSoon product="Workstation" />}
          />

          <Route
            path="printer"
            element={<ComingSoon product="Printer" />}
          />

          <Route
            path="toner"
            element={<ComingSoon product="Toner" />}
          />

        </Route>

        {/* BID DETAIL */}

        <Route
          path="/analyser-dashboard/desktop/bid/:id"
          element={<BidDetailView product="desktop" />}
        />

        {/* ================= ADMIN ================= */}

        <Route
          path="/admin-dashboard"
          element={<AdminNavbar />}
        >

          {/* DEFAULT PAGE */}

          <Route
            index
            element={
              <Navigate
                to="desktop-bid-approval"
                replace
              />
            }
          />

          {/* DESKTOP BID */}

          <Route
            path="desktop-bid-approval"
            element={<DesktopBidApproval />}
          />

          {/* ADD USER */}

          <Route
            path="add-user"
            element={<Registration />}
          />

          {/* ADD ANALYSER */}

          <Route
            path="add-analyser"
            element={<AddAnalyser />}
          />

          {/* ADD PRODUCT */}

          <Route
            path="add-product"
            element={
              <div className="text-2xl font-bold text-gray-700">
                Add Product Coming Soon 🚀
              </div>
            }
          />

        </Route>

        {/* ================= REDIRECTS ================= */}

        <Route
          path="/desktop-bid-approval"
          element={
            <Navigate
              to="/admin-dashboard/desktop-bid-approval"
              replace
            />
          }
        />

        <Route
          path="/aio-bid-approval"
          element={<AIOBidApproval />}
        />

        <Route
          path="/price/:type"
          element={<PriceList />}
        />

        {/* ================= 404 ================= */}

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