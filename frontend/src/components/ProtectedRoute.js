import { Navigate } from "react-router-dom";

function ProtectedRoute({ children, adminOnly = false }) {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");

    if (!token || !user) {
        return <Navigate to="/login" />;
    }

    if (adminOnly && user.role !== "admin") {
        return <Navigate to="/dashboard" />;
    }

    return children;
}

export default ProtectedRoute;