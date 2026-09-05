import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function ManageStaff() {

    const user = JSON.parse(localStorage.getItem("user"));
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState("");
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {

        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps

    }, [roleFilter]);

    if (!user) {
        return <Navigate to="/" />;
    }

    if (user.role !== "admin") {
        return <Navigate to="/dashboard" />;
    }

    const fetchUsers = async () => {

        setLoading(true);

        const token = localStorage.getItem("token");

        try {

            const res = await axios.get(
                "http://localhost:5000/api/auth/users",
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: roleFilter ? { role: roleFilter } : {}
                }
            );

            setUsers(res.data);

        } catch (err) {

            toast.error(
                err.response?.data?.message || "Failed to load users"
            );

        } finally {

            setLoading(false);

        }

    };

    const changeRole = async (targetUser, newRole) => {

        if (targetUser._id === user.id) {
            toast.error("You cannot change your own role");
            return;
        }

        setUpdatingId(targetUser._id);

        const token = localStorage.getItem("token");

        try {

            await axios.put(
                `http://localhost:5000/api/auth/users/${targetUser._id}/role`,
                { role: newRole },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success(`${targetUser.name} is now ${newRole}`);

            fetchUsers();

        } catch (err) {

            toast.error(
                err.response?.data?.message || "Failed to update role"
            );

        } finally {

            setUpdatingId(null);

        }

    };

    const roleBadge = (role) => {

        if (role === "admin") {
            return <span className="badge bg-danger">Admin</span>;
        }

        if (role === "staff") {
            return <span className="badge bg-info text-dark">Staff</span>;
        }

        return <span className="badge bg-secondary">User</span>;

    };

    return (

        <div>

            <Navbar />

            <div className="container mt-4">

                <div className="mb-4">

                    <h2 className="fw-bold text-primary">
                        <i className="bi bi-people-fill me-2"></i>
                        Manage Staff &amp; Users
                    </h2>

                    <p className="text-muted">
                        Promote users to Staff to let them handle complaints assigned to them, or promote to Admin for full access.
                    </p>

                </div>

                <div className="card shadow mb-3">

                    <div className="card-body">

                        <div className="row g-2 align-items-center">

                            <div className="col-auto">
                                <label className="col-form-label">
                                    Filter by role:
                                </label>
                            </div>

                            <div className="col-auto">

                                <select
                                    className="form-select"
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                >
                                    <option value="">All</option>
                                    <option value="user">User</option>
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>

                            </div>

                        </div>

                    </div>

                </div>

                <div className="card shadow">

                    <div className="card-body">

                        {loading ? (

                            <div className="text-center p-5">
                                <div className="spinner-border text-primary"></div>
                            </div>

                        ) : (

                            <div className="table-responsive">

                                <table className="table table-hover align-middle">

                                    <thead className="table-primary">
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Change Role</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {users.length === 0 ? (

                                            <tr>
                                                <td colSpan="4" className="text-center text-muted p-4">
                                                    No users found
                                                </td>
                                            </tr>

                                        ) : (

                                            users.map((u) => (

                                                <tr key={u._id}>

                                                    <td>
                                                        {u.name}
                                                        {u._id === user.id && (
                                                            <span className="badge bg-light text-dark ms-2">You</span>
                                                        )}
                                                    </td>

                                                    <td>{u.email}</td>

                                                    <td>{roleBadge(u.role)}</td>

                                                    <td>

                                                        <select
                                                            className="form-select form-select-sm"
                                                            style={{ maxWidth: 160 }}
                                                            value={u.role}
                                                            disabled={u._id === user.id || updatingId === u._id}
                                                            onChange={(e) => changeRole(u, e.target.value)}
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="staff">Staff</option>
                                                            <option value="admin">Admin</option>
                                                        </select>

                                                    </td>

                                                </tr>

                                            ))

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </div>

                </div>

            </div>

            <Footer />

        </div>

    );

}

export default ManageStaff;