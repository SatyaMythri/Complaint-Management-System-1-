import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import StaffDashboard from "./pages/StaffDashboard";
import AddComplaint from "./pages/AddComplaint";
import ViewComplaints from "./pages/ViewComplaints";
import AdminDashboard from "./pages/AdminDashboard";
import ManageStaff from "./pages/ManageStaff";
import VerifyOTP from "./pages/VerifyOTP";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import ChangePassword from "./pages/ChangePassword";
import ProtectedRoute from "./components/ProtectedRoute";
function App() {
    useEffect(() => {

    const theme = localStorage.getItem("theme") || "light";

    document.body.setAttribute("data-bs-theme", theme);

    if (theme === "dark") {
        document.body.classList.add("bg-dark", "text-light");
    } else {
        document.body.classList.remove("bg-dark", "text-light");
    }

}, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/staff-dashboard" element={<ProtectedRoute><StaffDashboard /></ProtectedRoute>} />
<Route path="/add" element={<ProtectedRoute><AddComplaint /></ProtectedRoute>} />
<Route path="/complaints" element={<ProtectedRoute><ViewComplaints /></ProtectedRoute>} />
<Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminDashboard /></ProtectedRoute>} />
<Route path="/manage-staff" element={<ProtectedRoute adminOnly={true}><ManageStaff /></ProtectedRoute>} />

        <Route
    path="/forgot-password"
    element={<ForgotPassword />}
/>
<Route
    path="/verify-otp"
    element={<VerifyOTP />}
/>
<Route
    path="/reset-password"
    element={<ResetPassword />}
/>
<Route path="/login" element={<Login />} />
<Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
<Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
<Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      </Routes>

      <ToastContainer
    position="top-right"
    autoClose={3000}
    hideProgressBar={false}
    newestOnTop
    closeOnClick
    pauseOnHover
    draggable
    theme="colored"
/>


    </BrowserRouter>

    
  );
}

export default App;
