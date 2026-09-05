import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function StaffDashboard() {

    const user = JSON.parse(localStorage.getItem("user"));

    const [loading, setLoading] = useState(true);
    const [complaints, setComplaints] = useState([]);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {

        const loadAssigned = async () => {

            try {

                setLoading(true);

                const token = localStorage.getItem("token");

                // GET /api/complaints is already scoped to "assigned to
                // me" on the backend when the caller is staff — no extra
                // filtering needed here.
                const res = await axios.get(
                    "http://localhost:5000/api/complaints",
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { limit: 100 }
                    }
                );

                setComplaints(res.data.complaints);
                setTotalCount(res.data.totalCount);

            } catch (err) {

                console.log(err);

            } finally {

                setLoading(false);

            }

        };

        if (user?.role === "staff") {
            loadAssigned();
        } else {
            setLoading(false);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!user) {
        return <Navigate to="/" />;
    }

    if (user.role !== "staff") {
        return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} />;
    }

    const pending = complaints.filter(c => c.status === "Pending").length;
    const inProgress = complaints.filter(c => c.status === "In Progress").length;
    const resolved = complaints.filter(c => c.status === "Resolved").length;

    // "Overdue" here means "needs action right now" — only complaints
    // that are still open AND past their SLA deadline. A complaint that
    // was resolved late is a separate, historical stat (sla.slaState
    // === "Breached") — it doesn't need action anymore, so it shouldn't
    // trigger this "go fix these" banner.
    const overdue = complaints.filter(
        c => c.status !== "Resolved" && c.sla?.isOverdue
    ).length;

    return (

        <div>

            <Navbar />

            <div className="container mt-4">

                <h2 className="text-center text-primary mb-4">
                    My Dashboard
                </h2>

                <p className="text-center text-muted mb-4">
                    Welcome back, {user.name}
                </p>

                {loading ? (

                    <div className="text-center p-5">
                        <div className="spinner-border text-primary"></div>
                    </div>

                ) : (

                    <>

                        <div className="row g-3 mb-4">

                            <div className="col-md-3 col-sm-6">
                                <div className="card shadow-sm text-center h-100">
                                    <div className="card-body">
                                        <i className="bi bi-clipboard-check text-primary" style={{ fontSize: "32px" }}></i>
                                        <h6 className="mt-2 text-muted">Total Assigned</h6>
                                        <h3>{totalCount}</h3>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-3 col-sm-6">
                                <div className="card shadow-sm text-center h-100 border-warning">
                                    <div className="card-body">
                                        <i className="bi bi-hourglass-split text-warning" style={{ fontSize: "32px" }}></i>
                                        <h6 className="mt-2 text-muted">Pending</h6>
                                        <h3 className="text-warning">{pending}</h3>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-3 col-sm-6">
                                <div className="card shadow-sm text-center h-100 border-info">
                                    <div className="card-body">
                                        <i className="bi bi-arrow-repeat text-info" style={{ fontSize: "32px" }}></i>
                                        <h6 className="mt-2 text-muted">In Progress</h6>
                                        <h3 className="text-info">{inProgress}</h3>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-3 col-sm-6">
                                <div className="card shadow-sm text-center h-100 border-success">
                                    <div className="card-body">
                                        <i className="bi bi-check-circle text-success" style={{ fontSize: "32px" }}></i>
                                        <h6 className="mt-2 text-muted">Resolved</h6>
                                        <h3 className="text-success">{resolved}</h3>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {overdue > 0 && (

                            <div className="alert alert-danger d-flex justify-content-between align-items-center">

                                <div>
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    You have <strong>{overdue}</strong> complaint{overdue !== 1 ? "s" : ""} past their SLA deadline.
                                </div>

                                <Link to="/complaints" className="btn btn-sm btn-outline-danger">
                                    View Overdue
                                </Link>

                            </div>

                        )}

                        <div className="text-center mt-4">

                            <Link to="/complaints" className="btn btn-primary">
                                <i className="bi bi-card-checklist me-2"></i>
                                View All Assigned Complaints
                            </Link>

                        </div>

                    </>

                )}

            </div>

            <Footer />

        </div>

    );

}

export default StaffDashboard;