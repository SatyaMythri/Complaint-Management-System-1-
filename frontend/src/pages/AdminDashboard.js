import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import {
    Chart as ChartJS,
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
} from "chart.js";

import { Pie, Bar } from "react-chartjs-2";

ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
);

// Attachments uploaded after the Cloudinary migration store a full URL
// directly. Complaints from before that migration only have a bare
// local filename, which needs the old /uploads/ path prefixed.
function resolveFileUrl(value) {
    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://")) {
        return value;
    }
    return `http://localhost:5000/uploads/${value}`;
}

function AdminDashboard() {

    const user = JSON.parse(localStorage.getItem("user"));
    const [loading, setLoading] = useState(true);
    const [complaints, setComplaints] = useState([]);
    const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("All");
const [totalUsers, setTotalUsers] = useState(0);
const [overdueCount, setOverdueCount] = useState(0);

useEffect(() => {

    const loadComplaints = async () => {

        try {

            setLoading(true);

            const token = localStorage.getItem("token");
            const authHeader = { headers: { Authorization: `Bearer ${token}` } };

            // GET /api/complaints is paginated (capped at 100/page by
            // design, to protect the server from unbounded queries). This
            // dashboard needs the full dataset for its stats/charts and
            // PDF/Excel export, so pull every page and concatenate.
            const PAGE_SIZE = 100;

            const firstPage = await axios.get(
                "http://localhost:5000/api/complaints",
                { ...authHeader, params: { limit: PAGE_SIZE, page: 1 } }
            );

            let allComplaints = firstPage.data.complaints;
            const totalPages = firstPage.data.totalPages;

            if (totalPages > 1) {

                const remainingPages = await Promise.all(
                    Array.from({ length: totalPages - 1 }, (_, i) =>
                        axios.get(
                            "http://localhost:5000/api/complaints",
                            { ...authHeader, params: { limit: PAGE_SIZE, page: i + 2 } }
                        )
                    )
                );

                remainingPages.forEach(pageRes => {
                    allComplaints = allComplaints.concat(pageRes.data.complaints);
                });

            }

            setComplaints(allComplaints);

            const stats = await axios.get(
                "http://localhost:5000/api/complaints/stats",
                authHeader
            );

            setTotalUsers(stats.data.totalUsers);
            setOverdueCount(stats.data.overdue || 0);

        } catch (err) {

            console.log(err);

        } finally {

            setLoading(false);

        }

    };

    if (user?.role === "admin") {
        loadComplaints();
    }

}, []);

    if (!user) {

        return <Navigate to="/" />;

    }

    if (user.role !== "admin") {

        return <Navigate to="/dashboard" />;

    }

    const total = complaints.length;

    const pending = complaints.filter(
        c => c.status === "Pending"
    ).length;

    const resolved = complaints.filter(
        c => c.status === "Resolved"
    ).length;
    const todayComplaints = complaints.filter(c => {

    const complaintDate = new Date(c.createdAt).toDateString();

    const today = new Date().toDateString();

    return complaintDate === today;

}).length;

    const resolutionRate =
    total === 0
        ? 0
        : Math.round((resolved / total) * 100);

    const highPriority = complaints.filter(
        c => c.priority === "High"
    ).length;

    const mediumPriority = complaints.filter(
        c => c.priority === "Medium"
    ).length;

    const lowPriority = complaints.filter(
        c => c.priority === "Low"
    ).length;

    const issueCount = {};

    const locationCount = {};

    complaints.forEach((item) => {

        issueCount[item.category] =
    (issueCount[item.category] || 0) + 1;

        locationCount[item.title] =
            (locationCount[item.title] || 0) + 1;

    });
    const filteredComplaints = complaints.filter(item => {

    const matchesSearch =

        item.title.toLowerCase().includes(search.toLowerCase()) ||

        item.category.toLowerCase().includes(search.toLowerCase()) ||

        item.complaintId.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =

        statusFilter === "All" ||

        item.status === statusFilter;

    return matchesSearch && matchesStatus;

});

    const recentComplaints = [...complaints]
        .sort(
            (a, b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        )
        .slice(0, 5);

    const chartData = {

        labels: ["Pending", "Resolved"],

        datasets: [

            {

                data: [pending, resolved],

                backgroundColor: [

                    "#ffc107",

                    "#198754"

                ]

            }

        ]

    };

    const barChartData = {

        labels: Object.keys(locationCount),

        datasets: [

            {

                label: "Complaints",

                data: Object.values(locationCount),

                backgroundColor: [

                    "#0d6efd",

                    "#198754",

                    "#ffc107",

                    "#dc3545",

                    "#6f42c1"

                ]

            }

        ]

    };

    const exportPDF = () => {

        const doc = new jsPDF();

        doc.setFontSize(18);

        doc.text(
            "Complaint Report",
            14,
            20
        );

        autoTable(doc, {

            head: [[

                "Location",

                "Issue",

                "Priority",

                "Status",

                "Date"

            ]],

            body: complaints.map(item => [

                item.title,

                item.category,

                item.priority,

                item.status,

                new Date(item.createdAt)
                    .toLocaleDateString()

            ])

        });

        doc.save("Complaint_Report.pdf");

    };

    const exportExcel = () => {

        const data = complaints.map(item => ({

            Location: item.title,

            Issue: item.category,

            Priority: item.priority,

            Status: item.status,

            Date: new Date(item.createdAt)
                .toLocaleDateString()

        }));

        const worksheet =
            XLSX.utils.json_to_sheet(data);

        const workbook =
            XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Complaints"
        );

        const excelBuffer =
            XLSX.write(workbook, {

                bookType: "xlsx",

                type: "array"

            });

        saveAs(

            new Blob([excelBuffer]),

            "Complaint_Report.xlsx"

        );

    };
    return (

        <div>

            <Navbar />

            {loading ? (
<div className="container text-center mt-5">

    <div
        className="spinner-border text-primary"
        style={{
            width: "4rem",
            height: "4rem"
        }}
    ></div>

    <h4 className="mt-3">
        Loading Dashboard...
    </h4>

</div>
            ):(
            <div className="container mt-4">

                <div className="mb-4">

                    <h2 className="fw-bold text-primary">

                        <i className="bi bi-speedometer2 me-2"></i>

                        Administrator Dashboard

                    </h2>

                    <p className="text-muted">

                        Last Updated :
                        {new Date().toLocaleString()}

                    </p>

                    <div className="alert alert-info shadow-sm">

                        <h4>

                            👋 Welcome, {user.name}

                        </h4>

                        <p className="mb-0">

                            Manage complaints and monitor the complaint system efficiently.

                        </p>

                    </div>

                </div>

                <div className="row">

    {/* Total Users */}
    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">
        <div className="card shadow border-info">
            <div className="card-body text-center">

                <i
                    className="bi bi-people-fill text-info"
                    style={{ fontSize: "45px" }}
                ></i>

                <h5 className="mt-3">
                    Total Users
                </h5>

                <h2 className="text-info">
                    {totalUsers}
                </h2>

            </div>
        </div>
    </div>

    {/* Overdue Complaints */}
    <div
        className="col-lg-4 col-md-6 col-sm-12 mb-3"
        style={{ cursor: "pointer" }}
        onClick={() => window.location.href = "/complaints"}
        title="View overdue complaints"
    >
        <div className={`card shadow ${overdueCount > 0 ? "border-danger" : "border-success"}`}>
            <div className="card-body text-center">

                <i
                    className={`bi bi-exclamation-triangle-fill ${overdueCount > 0 ? "text-danger" : "text-success"}`}
                    style={{ fontSize: "45px" }}
                ></i>

                <h5 className="mt-3">
                    Overdue Complaints
                </h5>

                <h2 className={overdueCount > 0 ? "text-danger" : "text-success"}>
                    {overdueCount}
                </h2>

                <small className="text-muted">Past their SLA target</small>

            </div>
        </div>
    </div>

    {/* Resolution Rate */}
    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">
        <div className="card shadow border-success">
            <div className="card-body text-center">

                <i
                    className="bi bi-graph-up-arrow text-success"
                    style={{ fontSize: "45px" }}
                ></i>

                <h5 className="mt-3">
                    Resolution Rate
                </h5>

                <h2 className="text-success">
                    {resolutionRate}%
                </h2>

            </div>
        </div>
    </div>

    {/* Today */}
    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">
        <div className="card shadow border-primary">
            <div className="card-body text-center">

                <i
                    className="bi bi-calendar-event text-primary"
                    style={{ fontSize: "45px" }}
                ></i>

                <h4 className="mt-3">
    Today's Complaints
</h4>

<h2 className="text-primary">
    {todayComplaints}
</h2>

            </div>
        </div>
    </div>

</div>

{/* Existing Statistics Row */}
<div className="row">

    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

        <div className="card shadow border-primary">

            <div className="card-body text-center">

                <i
                    className="bi bi-file-earmark-text-fill text-primary"
                    style={{ fontSize: "45px" }}
                ></i>

                <h5 className="mt-3">
                    Total Complaints
                </h5>

                <h2>{total}</h2>

            </div>

        </div>
    </div>

        

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="card shadow border-warning">

                            <div className="card-body text-center">

                                <i
                                    className="bi bi-hourglass-split text-warning"
                                    style={{ fontSize: "45px" }}
                                ></i>

                                <h5 className="mt-3">

                                    Pending

                                </h5>

                                <h2 className="text-warning">

                                    {pending}

                                </h2>

                            </div>

                        </div>

                    </div>

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="card shadow border-success">

                            <div className="card-body text-center">

                                <i
                                    className="bi bi-check-circle-fill text-success"
                                    style={{ fontSize: "45px" }}
                                ></i>

                                <h5 className="mt-3">

                                    Resolved

                                </h5>

                                <h2 className="text-success">

                                    {resolved}

                                </h2>

                            </div>

                        </div>

                    </div>

                </div>

                <div className="row mt-3">

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="card shadow border-danger">

                            <div className="card-body text-center">

                                <i
                                    className="bi bi-exclamation-triangle-fill text-danger"
                                    style={{ fontSize: "42px" }}
                                ></i>

                                <h5 className="mt-2">

                                    High Priority

                                </h5>

                                <h2 className="text-danger">

                                    {highPriority}

                                </h2>

                            </div>

                        </div>

                    </div>

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="card shadow border-warning">

                            <div className="card-body text-center">

                                <i
                                    className="bi bi-flag-fill text-warning"
                                    style={{ fontSize: "42px" }}
                                ></i>

                                <h5 className="mt-2">

                                    Medium Priority

                                </h5>

                                <h2 className="text-warning">

                                    {mediumPriority}

                                </h2>

                            </div>

                        </div>

                    </div>

                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3">

                        <div className="card shadow border-success">

                            <div className="card-body text-center">

                                <i
                                    className="bi bi-check-circle-fill text-success"
                                    style={{ fontSize: "42px" }}
                                ></i>

                                <h5 className="mt-2">

                                    Low Priority

                                </h5>

                                <h2 className="text-success">

                                    {lowPriority}

                                </h2>

                            </div>

                        </div>

                    </div>

                </div>
                                <div className="row mt-4">

                    <div className="col-lg-7 mb-4">

                        <div className="card shadow h-100">

                            <div className="card-body">

                                <h4>

                                    <i className="bi bi-list-task me-2"></i>

                                    Complaint Issues

                                </h4>
                                <div className="table-responsive">
                                <table className="table table-hover mt-3">

                                    <thead className="table-primary">

                                        <tr>

                                            <th>Category</th>

                                            <th>Total</th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {

                                            Object.keys(issueCount).map((category) => (

                                                <tr key={category}>

                                                    <td>

                                                        {category}

                                                    </td>

                                                    <td>

                                                        <span className="badge bg-primary">

                                                            {issueCount[category]}

                                                        </span>

                                                    </td>

                                                </tr>

                                            ))

                                        }

                                    </tbody>

                                </table>
                                </div>

                            </div>

                        </div>

                    </div>

                    <div className="col-lg-5 mb-4">

                        <div className="card shadow h-100">

                            <div className="card-body">

                                <h4>

                                    <i className="bi bi-lightning-fill text-warning me-2"></i>

                                    Quick Actions

                                </h4>

                                <hr />

                                <Link

                                    to="/complaints"

                                    className="btn btn-primary w-100 mb-3"

                                >

                                    <i className="bi bi-tools me-2"></i>

                                    Manage Complaints

                                </Link>

                                <button

                                    className="btn btn-success w-100 mb-3"

                                    onClick={exportExcel}

                                >

                                    <i className="bi bi-file-earmark-excel me-2"></i>

                                    Export Excel

                                </button>

                                <button

                                    className="btn btn-danger w-100"

                                    onClick={exportPDF}

                                >

                                    <i className="bi bi-file-earmark-pdf me-2"></i>

                                    Export PDF

                                </button>

                            </div>

                        </div>

                    </div>

                </div>

                <div className="row">

                    <div className="col-lg-6 mb-4">

                        <div className="card shadow">

                            <div className="card-body">

                                <h4 className="text-center mb-4">

                                    <i className="bi bi-pie-chart-fill me-2"></i>

                                    Complaint Status

                                </h4>

                               <div
    style={{
        width: "220px",
        height: "220px",
        margin: "0 auto"
    }}
>
    <Pie data={chartData} />
</div>

                            </div>

                        </div>

                    </div>

                    <div className="col-lg-6 mb-4">

                        <div className="card shadow">

                            <div className="card-body">

                                <h4>

                                    <i className="bi bi-info-circle-fill me-2"></i>

                                    Summary

                                </h4>

                                <hr />

                                <div className="mb-3">

                                    <strong>Total Complaints</strong>

                                    <h3 className="text-primary">

                                        {total}

                                    </h3>

                                </div>

                                <div className="mb-3">

                                    <strong>Pending</strong>

                                    <h3 className="text-warning">

                                        {pending}

                                    </h3>

                                </div>

                                <div>

                                    <strong>Resolved</strong>

                                    <h3 className="text-success">

                                        {resolved}

                                    </h3>

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

                <div className="row">

                    <div className="col-lg-12 mb-4">

                        <div className="card shadow">

                            <div className="card-body">

                                <h4 className="text-center mb-4">

                                    <i className="bi bi-bar-chart-fill me-2"></i>

                                    Complaints by Location

                                </h4>

                                <div
    style={{
        height: "250px"
    }}
>
    <Bar
        data={barChartData}
        options={{
            maintainAspectRatio: false,
            responsive: true
        }}
    />
</div>

                            </div>

                        </div>

                    </div>

                </div>
                                <div className="card shadow mb-4">

                    <div className="card-body">

                        <h4 className="mb-3">

                            <i className="bi bi-clock-history me-2"></i>

                            Recent Complaints

                        </h4>

                        <div className="table-responsive">

                            <table className="table table-hover table-bordered">

                                <thead className="table-primary">

                                    <tr>
                                        <th>ID</th>

                                        <th>Location</th>

                                        <th>Issue</th>

                                        <th>Image</th>

                                        <th>Priority</th>

                                        <th>Status</th>

                                        <th>Date</th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {
    recentComplaints.length === 0 ? (

        <tr>
            <td colSpan="7" className="text-center">
                No Complaints Found
            </td>
        </tr>

    ) : (

        recentComplaints.map((item) => (

                                <tr key={item._id}>

    <td>
        {item.complaintId}
    </td>

    <td>
        {item.title}
    </td>

    <td>
        {item.category}
    </td>

    <td>

        {item.image ? (

            <img
                src={resolveFileUrl(item.image)}
                alt=""
                width="60"
                height="60"
                style={{
                    objectFit: "cover",
                    borderRadius: "8px"
                }}
            />

        ) : (

            "No Image"

        )}

    </td>

    <td>

        {item.priority === "High" && (
            <span className="badge bg-danger">
                High
            </span>
        )}

        {item.priority === "Medium" && (
            <span className="badge bg-warning text-dark">
                Medium
            </span>
        )}

        {item.priority === "Low" && (
            <span className="badge bg-success">
                Low
            </span>
        )}

    </td>

    <td>

        {item.status === "Resolved" ? (

            <span className="badge bg-success">
                Resolved
            </span>

        ) : (

            <span className="badge bg-warning text-dark">
                Pending
            </span>

        )}

    </td>

    <td>

        {new Date(item.createdAt).toLocaleDateString()}

    </td>

</tr>
        )
    ))
}
</tbody>

                            </table>

                        </div>

                    </div>

                </div>

            </div>
            )}
            <Footer />

        </div>

    );

}

export default AdminDashboard;