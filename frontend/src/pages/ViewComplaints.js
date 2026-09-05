import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
import { Modal } from "bootstrap";

// Attachments uploaded after the Cloudinary migration store a full URL
// directly (e.g. "https://res.cloudinary.com/..."). Complaints created
// before that migration only have a bare local filename, which needs
// the old /uploads/ path prefixed — this only works if that original
// server still has the file on disk, which won't be true after a
// redeploy, but keeps old local-dev data viewable in the meantime.
function resolveFileUrl(value) {
    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://")) {
        return value;
    }
    return `http://localhost:5000/uploads/${value}`;
}

function ViewComplaints() {

    const user = JSON.parse(localStorage.getItem("user"));
    const [complaints, setComplaints] = useState([]);
    const [categories, setCategories] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [overdueOnly, setOverdueOnly] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const complaintsPerPage = 5;

    // Debounce the search box so we don't fire a request on every
    // keystroke — wait 400ms after the user stops typing.
    useEffect(() => {

        const handle = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1); // reset to page 1 whenever the search changes
        }, 400);

        return () => clearTimeout(handle);

    }, [search]);

    // Re-fetch whenever any filter, search, or page changes.
    useEffect(() => {

        fetchComplaints();
        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, [debouncedSearch, statusFilter, categoryFilter, overdueOnly, currentPage]);

    useEffect(() => {

        fetchCategories();

        if (user.role === "admin") {
            fetchStaffList();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, []);

    if (!user) {
        return <Navigate to="/" />;
    }

    const fetchStaffList = async () => {

        const token = localStorage.getItem("token");

        try {

            const res = await axios.get(
                "http://localhost:5000/api/auth/users",
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { role: "staff" }
                }
            );

            setStaffList(res.data);

        } catch (err) {

            console.log(err);

        }

    };

    const assignComplaint = async (complaintId, staffId) => {

        const token = localStorage.getItem("token");

        try {

            await axios.put(
                `http://localhost:5000/api/complaints/assign/${complaintId}`,
                { staffId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success("Complaint assigned successfully");

            fetchComplaints();

        } catch (err) {

            toast.error(
                err.response?.data?.message || "Failed to assign complaint"
            );

        }

    };

    const fetchCategories = async () => {

        const token = localStorage.getItem("token");

        try {

            const res = await axios.get(
                "http://localhost:5000/api/complaints/categories",
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setCategories(res.data);

        } catch (err) {

            console.log(err);

        }

    };

    const fetchComplaints = async () => {

    setLoading(true);

    const token = localStorage.getItem("token");

    const params = {
        page: currentPage,
        limit: complaintsPerPage,
        search: debouncedSearch,
        status: statusFilter,
        category: categoryFilter
    };

    const config = {
        headers: { Authorization: `Bearer ${token}` },
        params
    };

    try {

        let res;

        if (overdueOnly && (user.role === "admin" || user.role === "staff")) {

            res = await axios.get(
                "http://localhost:5000/api/complaints/overdue",
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { page: currentPage, limit: complaintsPerPage }
                }
            );

        } else if (user.role === "admin" || user.role === "staff") {

            // Staff must use the shared list endpoint too — it's scoped
            // to assignedTo on the backend. GET /user/:id is scoped to
            // createdBy, which is always empty for staff since they
            // don't submit complaints themselves.
            res = await axios.get(
                "http://localhost:5000/api/complaints",
                config
            );

        } else {

            res = await axios.get(
                `http://localhost:5000/api/complaints/user/${user.id}`,
                config
            );

        }

        setComplaints(res.data.complaints);
        setTotalPages(res.data.totalPages);

    } catch (err) {

        console.log(err);

    } finally {

        setLoading(false);

    }

};


const updateStatus = async (id, status) => {

    let remarks = "";

    if (status === "Resolved") {

        remarks = prompt("Enter remarks");

        if (remarks === null) return;

        if (remarks.trim() === "") {

            toast.error("Remarks required");

            return;

        }

    }

    try {

        const token = localStorage.getItem("token");

        await axios.put(

            `http://localhost:5000/api/complaints/update/${id}`,

            {
                status,
                remarks
            },

            {
                headers: { Authorization: `Bearer ${token}` }
            }

        );

        toast.success("Status Updated");

        fetchComplaints();

    } catch {

        toast.error("Update Failed");

    }

};

    const deleteComplaint = async (id) => {

    const confirmDelete = window.confirm(
        "Are you sure you want to delete this complaint?"
    );

    if (!confirmDelete) return;

    try {

        const token = localStorage.getItem("token");

        await axios.delete(
            `http://localhost:5000/api/complaints/delete/${id}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        toast.success("🗑 Complaint Deleted Successfully");

        fetchComplaints();

    } catch (err) {

        toast.error("❌ Unable to delete complaint");

    }

};

    // Renders a small colored badge for a complaint's computed SLA state.
    // `sla` may be null/undefined for older data that predates SLA
    // tracking, so this degrades gracefully to a muted placeholder.
    const renderSlaBadge = (sla) => {

        if (!sla || !sla.slaState) {
            return <span className="text-muted">—</span>;
        }

        const variants = {
            "On Track": "bg-success",
            "Due Soon": "bg-warning text-dark",
            "Overdue": "bg-danger",
            "Met": "bg-success",
            "Breached": "bg-danger",
            "Unknown": "bg-secondary"
        };

        return (
            <span className={`badge ${variants[sla.slaState] || "bg-secondary"}`}>
                {sla.slaState}
            </span>
        );

    };

    // Search, status/category filtering, and pagination are now all done
    // server-side (see fetchComplaints) — `complaints` already holds just
    // the current page's matching results.
        return (

        <div>

            <Navbar />

            <div className="container mt-4">

                <div className="card shadow p-4">

                    <h2 className="text-center text-primary mb-4">

                        {user.role === "admin"
                            ? "Manage Complaints"
                            : user.role === "staff"
                            ? "My Assigned Complaints"
                            : "My Complaints"}

                    </h2>

                    <div className="row mb-4">

                        <div className="col-md-4">

                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search by Location or Category"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />

                        </div>

                        <div className="col-md-4">

                            <select
                                className="form-select"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >

                                <option value="">All Issues</option>

{categories.map(issue => (
    <option key={issue} value={issue}>
        {issue}
    </option>
))}

                            </select>

                        </div>

                        <div className="col-md-4">

                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                disabled={overdueOnly}
                            >

                                <option value="">
                                    All Status
                                </option>

                                <option>
                                    Pending
                                </option>

                                <option>
                                    In Progress
                                </option>

                                <option>
                                    Resolved
                                </option>

                            </select>

                        </div>

                    </div>

                    {(user.role === "admin" || user.role === "staff") && (

                        <div className="row mb-4">

                            <div className="col-md-6">

                                <div className="form-check">

                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="overdueOnlyToggle"
                                        checked={overdueOnly}
                                        onChange={(e) => {
                                            setOverdueOnly(e.target.checked);
                                            setCurrentPage(1);
                                        }}
                                    />

                                    <label className="form-check-label" htmlFor="overdueOnlyToggle">
                                        <i className="bi bi-exclamation-triangle-fill text-danger me-1"></i>
                                        Show overdue only
                                    </label>

                                </div>

                            </div>

                        </div>

                    )}

                    {
    loading ? (

        <div
    className="d-flex flex-column justify-content-center align-items-center"
    style={{
        height: "350px"
    }}
>

    <div
        className="spinner-border text-primary"
        style={{
            width: "4rem",
            height: "4rem"
        }}
    ></div>

    <h5 className="mt-4">
        Loading Complaints...
    </h5>

    <p className="text-muted">
        Please wait while we fetch the latest data.
    </p>

</div>

    ) : (
        <div className="table-responsive">

        <table className="table table-hover table-bordered">

            <thead className="table-primary">

                <tr>

                    <th>ID</th>

                    <th>Location</th>

                    <th>Issue</th>

                    <th>Image</th>

                    <th>Description</th>

                    <th>Date</th>

                    <th>Priority</th>

                    <th>Status</th>

                    <th>SLA</th>

                    {(user.role === "admin" || user.role === "staff") && (
                        <th>Assigned To</th>
                    )}

                    <th>View</th>

                    {(user.role === "admin" || user.role === "staff") && (

    <th>Actions</th>

)}

                </tr>

            </thead>

            <tbody>

                {

                    complaints.length === 0 ? (

                        <tr>

                            <td
                            colSpan={
                                user.role === "admin" || user.role === "staff"
                                ? 12
                                : 10
                        }
                        className="text-center p-5"
                    >
                    <i
                    className="bi bi-inbox"
                    style={{
                        fontSize: "55px",
                        color: "#6c757d"
                    }}
                    ></i>
                    <i
    className="bi bi-inbox-fill text-secondary"
    style={{ fontSize: "70px" }}
></i>

<h4 className="mt-3">
    No Complaints Found
</h4>

<p className="text-muted">
    You haven't submitted any complaints yet.
</p>

{user.role === "user" && (

    <button
        className="btn btn-primary mt-2"
        onClick={() => window.location.href = "/add"}
    >

        <i className="bi bi-plus-circle me-2"></i>

        Submit Complaint

    </button>

)}
            </td>
            </tr>
            ) : (
                complaints.map((item) => (

                            <tr key={item._id}>

                                <td>

                                    <span className="badge bg-dark">

                                        {item.complaintId}

                                    </span>

                                </td>
                                <td>{item.title}</td>

                                <td>{item.category}</td>
                                <td>
                                    {item.image ? (
                                        <img
                                        src={resolveFileUrl(item.image)}
                                        alt="Complaint"
                                        width="70"
                                        height="70"
                                        style={{
                                            objectFit: "cover",
                                            borderRadius: "8px"
                                        }}
        />

    ) : (

        <span className="text-muted">
            No Image
        </span>

    )}

</td>

                                <td>{item.description}</td>

                                <td>

                                    {new Date(
                                        item.createdAt
                                    ).toLocaleString()}

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

                                    {item.status === "Resolved" && (
                                        <span className="badge bg-success">
                                            Resolved
                                        </span>
                                    )}

                                    {item.status === "In Progress" && (
                                        <span className="badge bg-info text-dark">
                                            In Progress
                                        </span>
                                    )}

                                    {item.status === "Pending" && (
                                        <span className="badge bg-warning text-dark">
                                            Pending
                                        </span>
                                    )}

                                </td>

                                <td>
                                    {renderSlaBadge(item.sla)}
                                </td>

                                {(user.role === "admin" || user.role === "staff") && (

                                    <td>

                                        {item.assignedTo ? (

                                            <span className="badge bg-primary">
                                                {item.assignedTo.name}
                                            </span>

                                        ) : user.role === "admin" ? (

                                            <select
                                                className="form-select form-select-sm"
                                                style={{ minWidth: 140 }}
                                                defaultValue=""
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        assignComplaint(item._id, e.target.value);
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>Assign staff...</option>
                                                {staffList.map((s) => (
                                                    <option key={s._id} value={s._id}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                            </select>

                                        ) : (

                                            <span className="text-muted">Unassigned</span>

                                        )}

                                    </td>

                                )}

                                <td>

                                    <button
                                    className="btn btn-info btn-sm"
                                    data-bs-toggle="modal"
                                    data-bs-target="#viewComplaintModal"
                                    onClick={() => setSelectedComplaint(item)}
                                   >
                                    View
                                </button>

                                </td>

                                {(user.role === "admin" || user.role === "staff") && (

                                    <td>

                                        {item.status === "Pending" && (
                                            <button
                                                className="btn btn-info btn-sm me-2"
                                                onClick={() => updateStatus(item._id, "In Progress")}
                                            >
                                                Start
                                            </button>
                                        )}

                                        {item.status !== "Resolved" && (
                                            <button
                                                className="btn btn-success btn-sm me-2"
                                                onClick={() => updateStatus(item._id, "Resolved")}
                                            >
                                                Resolve
                                            </button>
                                        )}

                                        {user.role === "admin" && (
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() =>
                                                    deleteComplaint(item._id)
                                                }
                                            >
                                                Delete
                                            </button>
                                        )}

                                    </td>

                                )}

                            </tr>

                        ))

                    )

                }

            </tbody>

        </table>
        </div>
        

    )
}
<div className="d-flex justify-content-center mt-4">

    <button
        className="btn btn-outline-primary me-2"
        disabled={currentPage === 1}
        onClick={() =>
            setCurrentPage(currentPage - 1)
        }
    >
        Previous
    </button>

    <span
        className="align-self-center fw-bold"
    >
        Page {currentPage} of {totalPages}
    </span>

    <button
        className="btn btn-outline-primary ms-2"
        disabled={currentPage === totalPages}
        onClick={() =>
            setCurrentPage(currentPage + 1)
        }
    >
        Next
    </button>

</div>

                </div>

            </div>
            <div
    className="modal fade"
    id="viewComplaintModal"
    tabIndex="-1"
>

    <div className="modal-dialog modal-lg">

        <div className="modal-content">

            <div className="modal-header bg-primary text-white">

                <h5 className="modal-title">

                    Complaint Details

                </h5>

                <button
                    className="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                ></button>

            </div>

            <div className="modal-body">

                {selectedComplaint && (

                    <>
                    <p>

    <strong>Complaint ID :</strong>{" "}

    {selectedComplaint.complaintId}

</p>
                        <p>

                            <strong>Location :</strong>

                            {" "}

                            {selectedComplaint.title}

                        </p>

                        <p>

                            <strong>Issue :</strong>

                            {" "}

                            {selectedComplaint.category}

                        </p>

                        <p>

                            <strong>Description :</strong>

                            {" "}

                            {selectedComplaint.description}

                        </p>
                        <p>

    <strong>Attachments :</strong>

</p>

{selectedComplaint.attachments && selectedComplaint.attachments.length > 0 ? (

    <div className="d-flex flex-wrap gap-3 mb-2">

        {selectedComplaint.attachments.map((att, idx) => {

            const fileUrl = resolveFileUrl(att.url || att.filename);

            return att.mimetype === "application/pdf" ? (

                <a
                    key={idx}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="d-flex flex-column align-items-center text-center border rounded shadow-sm p-2 text-decoration-none"
                    style={{ width: 110 }}
                >
                    <i className="bi bi-file-earmark-pdf text-danger" style={{ fontSize: "36px" }}></i>
                    <small className="text-truncate w-100">{att.originalName || "Document.pdf"}</small>
                </a>

            ) : (

                <a
                    key={idx}
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src={fileUrl}
                        alt={`Attachment ${idx + 1}`}
                        className="rounded shadow-sm"
                        style={{
                            width: 110,
                            height: 110,
                            objectFit: "cover"
                        }}
                    />
                </a>

            );

        })}

    </div>

) : selectedComplaint.image ? (

    // Fallback for complaints created before multi-attachment support
    <img
        src={resolveFileUrl(selectedComplaint.image)}
        alt="Complaint"
        className="img-fluid rounded shadow"
        style={{
            maxHeight: "250px"
        }}
    />

) : (

    <p className="text-muted">
        No Attachments Uploaded
    </p>

)}

                        <p>

                            <strong>Priority :</strong>

                            {" "}

                            {selectedComplaint.priority}

                        </p>

                        <p>

                            <strong>Status :</strong>

                            {" "}

                            {selectedComplaint.status}

                        </p>

                        {selectedComplaint.sla && (

                            <p>

                                <strong>SLA :</strong>{" "}

                                {renderSlaBadge(selectedComplaint.sla)}

                                {" "}

                                {selectedComplaint.sla.dueAt && selectedComplaint.status !== "Resolved" && (

                                    <span className="text-muted small ms-1">
                                        (due {new Date(selectedComplaint.sla.dueAt).toLocaleString()})
                                    </span>

                                )}

                                {selectedComplaint.sla.resolvedAt && (

                                    <span className="text-muted small ms-1">
                                        (resolved {new Date(selectedComplaint.sla.resolvedAt).toLocaleString()})
                                    </span>

                                )}

                            </p>

                        )}

                        {(user.role === "admin" || user.role === "staff") && (

                            <p>

                                <strong>Assigned To :</strong>{" "}

                                {selectedComplaint.assignedTo ? (
                                    selectedComplaint.assignedTo.name
                                ) : (
                                    <span className="text-muted">Unassigned</span>
                                )}

                                {user.role === "admin" && (

                                    <select
                                        className="form-select form-select-sm mt-2"
                                        style={{ maxWidth: 220 }}
                                        defaultValue=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                assignComplaint(selectedComplaint._id, e.target.value);
                                            }
                                        }}
                                    >
                                        <option value="" disabled>
                                            {selectedComplaint.assignedTo ? "Reassign to..." : "Assign to..."}
                                        </option>
                                        {staffList.map((s) => (
                                            <option key={s._id} value={s._id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>

                                )}

                            </p>

                        )}
<p>

    <strong>Remarks :</strong>{" "}

    {selectedComplaint.remarks ?

        selectedComplaint.remarks

        :

        "No remarks yet"}

</p>

{selectedComplaint.history && selectedComplaint.history.length > 0 && (

    <>
        <hr />

        <h6 className="mb-3">Status History</h6>

        <ul className="list-group mb-2">

            {[...selectedComplaint.history]
                .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
                .map((entry) => (

                <li key={entry._id || entry.changedAt} className="list-group-item">

                    <div className="d-flex justify-content-between align-items-start">

                        <div>

                            <span className={
                                entry.status === "Resolved"
                                    ? "badge bg-success me-2"
                                    : entry.status === "In Progress"
                                    ? "badge bg-info text-dark me-2"
                                    : "badge bg-warning text-dark me-2"
                            }>
                                {entry.status}
                            </span>

                            {entry.remarks && (
                                <span className="text-body">{entry.remarks}</span>
                            )}

                        </div>

                        <small className="text-muted text-nowrap ms-3">
                            {new Date(entry.changedAt).toLocaleString()}
                        </small>

                    </div>

                    {entry.changedBy?.name && (
                        <small className="text-muted">
                            by {entry.changedBy.name}
                        </small>
                    )}

                </li>

            ))}

        </ul>

    </>

)}
                        <p>

                            <strong>Date :</strong>

                            {" "}

                            {new Date(
                                selectedComplaint.createdAt
                            ).toLocaleString()}

                        </p>

                        <p>

                            <strong>Submitted By :</strong>

                            {" "}

                            {selectedComplaint.createdBy?.name}

                            {" ("}

                            {selectedComplaint.createdBy?.email}

                            {")"}

                        </p>

                    </>

                )}

            </div>

            <div className="modal-footer">

                <button
                    className="btn btn-secondary"
                    data-bs-dismiss="modal"
                >
                    Close
                </button>

            </div>

        </div>

    </div>

</div>
<Footer />
        </div>

    );

}

export default ViewComplaints;