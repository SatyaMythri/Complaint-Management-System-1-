import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
function Dashboard() {

    const user = JSON.parse(localStorage.getItem("user"));

    const [loading, setLoading] = useState(true);
    const [complaints, setComplaints] = useState([]);
    const [totalCount, setTotalCount] = useState(0);


    useEffect(() => {

    const loadComplaints = async () => {

        try {

            setLoading(true);

            const token = localStorage.getItem("token");

            const res = await axios.get(
                `http://localhost:5000/api/complaints/user/${user.id}`,
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

    // Only citizens submit complaints — skip the fetch entirely for
    // admin/staff, who get redirected below anyway before this data
    // would ever be rendered.
    if (user?.id && user?.role !== "admin" && user?.role !== "staff") {
        loadComplaints();
    } else {
        setLoading(false);
    }

}, []);

    // This dashboard assumes the viewer submits complaints (it fetches
    // "my complaints" by createdBy) — that's never true for staff/admin,
    // who'd otherwise land on a confusingly empty page. Send them to the
    // dashboard that actually matches their role. This check runs after
    // all hooks above, per the Rules of Hooks — hooks must always run
    // unconditionally in the same order on every render.
    if (user?.role === "admin") {
        return <Navigate to="/admin" />;
    }

    if (user?.role === "staff") {
        return <Navigate to="/staff-dashboard" />;
    }

console.log("Current loading:", loading);

    const total = totalCount;

    const pending = complaints.filter(
        c => c.status === "Pending"
    ).length;

    const resolved = complaints.filter(
        c => c.status === "Resolved"
    ).length;

    return (

        <div>

            <Navbar />

{loading ? (

    <div className="container text-center mt-5">

        <div
            className="spinner-border text-success"
            style={{
                width: "4rem",
                height: "4rem"
            }}
        ></div>

        <h4 className="mt-3">
            Loading Dashboard...
        </h4>

    </div>

) : (

<div className="container mt-4">

                <div className="mb-4">

                    <h2 className="fw-bold text-primary">

                        <i className="bi bi-person-circle me-2"></i>

                        Welcome, {user.name}

                    </h2>

                    <p className="text-muted">

                        Track and manage your complaints easily.

                    </p>

                </div>

                <div className="row">

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="dashboard-card bg-primary">

                            <i
                                className="bi bi-file-earmark-text-fill"
                                style={{fontSize:"40px"}}
                            ></i>

                            <h5 className="mt-3">
                                Total Complaints
                            </h5>

                            <h2>{total}</h2>

                        </div>

                    </div>

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="dashboard-card bg-warning text-dark">

                            <i
                                className="bi bi-hourglass-split"
                                style={{fontSize:"40px"}}
                            ></i>

                            <h5 className="mt-3">
                                Pending
                            </h5>

                            <h2>{pending}</h2>

                        </div>

                    </div>

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="dashboard-card bg-success">

                            <i
                                className="bi bi-check-circle-fill"
                                style={{fontSize:"40px"}}
                            ></i>

                            <h5 className="mt-3">
                                Resolved
                            </h5>

                            <h2>{resolved}</h2>

                        </div>

                    </div>

                </div>

                <div className="card shadow mt-4">

                    <div className="card-body">

                        <h4 className="mb-3">

                            <i className="bi bi-lightning-charge-fill me-2 text-warning"></i>

                            Quick Actions

                        </h4>

                        <Link
                            className="btn btn-success me-2 mb-2"
                            to="/add"
                        >

                            <i className="bi bi-plus-circle me-2"></i>

                            Add Complaint

                        </Link>

                        <Link
                            className="btn btn-primary mb-2"
                            to="/complaints"
                        >

                            <i className="bi bi-card-list me-2"></i>

                            My Complaints

                        </Link>

                    </div>

                </div>

                <div className="card shadow mt-4">

                    <div className="card-body">

                        <h4 className="mb-3">

                            <i className="bi bi-clock-history me-2 text-primary"></i>

                            Recent Complaints

                        </h4>

                        {

                            complaints.length === 0 ?

                            (

                                <div className="alert alert-info">

                                    No complaints submitted yet.

                                </div>

                            )

                            :

                            (
                                <div className="table-responsive">
                                <table className="table table-hover">

                                    <thead className="table-primary">

                                        <tr>

                                            <th>Location</th>

                                            <th>Issue</th>

                                            <th>Description</th>
                                            
                                            <th>Status</th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {

                                            complaints
                                            .slice(0,5)
                                            .map(item => (

                                                <tr key={item._id}>

                                                    <td>{item.title}</td>

                                                    <td>{item.category}</td>

                                                    <td> {item.description}</td>

                                                    <td>

                                                        {

                                                            item.status==="Resolved"

                                                            ?

                                                            <span className="badge bg-success">

                                                                Resolved

                                                            </span>

                                                            :

                                                            <span className="badge bg-warning text-dark">

                                                                Pending

                                                            </span>

                                                        }

                                                    </td>

                                                </tr>

                                            ))

                                        }

                                    </tbody>

                                </table>
                                </div>

                            )

                        }

                    </div>

                </div>

            </div>

                    )}
            <Footer />
        </div>

    );

}

export default Dashboard;