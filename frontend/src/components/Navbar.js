import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Navbar() {

    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem("user"));
    const [darkMode, setDarkMode] = useState(

    localStorage.getItem("theme") === "dark"

);
    const logout = () => {

        localStorage.removeItem("user");

        navigate("/");

    };
    useEffect(() => {

    if (darkMode) {

        document.body.classList.add(
            "bg-dark",
            "text-light"
        );

        document.body.setAttribute(
            "data-bs-theme",
            "dark"
        );

        localStorage.setItem(
            "theme",
            "dark"
        );

    } else {

        document.body.classList.remove(
            "bg-dark",
            "text-light"
        );

        document.body.setAttribute(
            "data-bs-theme",
            "light"
        );

        localStorage.setItem(
            "theme",
            "light"
        );

    }

}, [darkMode]);
    return (

        <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow">

            <div className="container">

                <Link
                    className="navbar-brand fw-bold"
                    to={
                        user?.role === "admin"
                            ? "/admin"
                            : user?.role === "staff"
                            ? "/staff-dashboard"
                            : "/dashboard"
                    }
                >
                    <i className="bi bi-building-fill me-2"></i>
                    CMS Portal
                </Link>

                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div
                    className="collapse navbar-collapse"
                    id="navbarNav"
                >

                    <ul className="navbar-nav ms-auto align-items-center">

                        {user?.role === "user" && (

                            <>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/dashboard"
                                    >
                                        <i className="bi bi-house-door me-1"></i>
                                        Dashboard
                                    </Link>

                                </li>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/add"
                                    >
                                        <i className="bi bi-plus-circle me-1"></i>
                                        Add Complaint
                                    </Link>

                                </li>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/complaints"
                                    >
                                        <i className="bi bi-card-list me-1"></i>
                                        My Complaints
                                    </Link>

                                </li>

                                

                            </>

                        )}

                        {user?.role === "admin" && (

                            <>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/admin"
                                    >
                                        <i className="bi bi-speedometer2 me-1"></i>
                                        Dashboard
                                    </Link>

                                </li>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/complaints"
                                    >
                                        <i className="bi bi-tools me-1"></i>
                                        Manage Complaints
                                    </Link>

                                </li>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/manage-staff"
                                    >
                                        <i className="bi bi-people-fill me-1"></i>
                                        Manage Staff
                                    </Link>

                                </li>

                            </>

                        )}

                        {user?.role === "staff" && (

                            <>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/staff-dashboard"
                                    >
                                        <i className="bi bi-speedometer2 me-1"></i>
                                        Dashboard
                                    </Link>

                                </li>

                                <li className="nav-item">

                                    <Link
                                        className="nav-link"
                                        to="/complaints"
                                    >
                                        <i className="bi bi-card-checklist me-1"></i>
                                        My Assigned Complaints
                                    </Link>

                                </li>

                            </>

                        )}

                        <li className="nav-item">

    <Link
        to="/profile"
        className="nav-link d-flex align-items-lg-center"
    >
        <i className="bi bi-person-circle me-2"></i>
        {user?.name}
    </Link>

</li>
                        <li className="nav-item ms-3">

    <button
        className="btn btn-outline-light btn-sm"
        onClick={() => setDarkMode(!darkMode)}
    >

        {darkMode ? "☀️ Light" : "🌙 Dark"}

    </button>

</li>
                        <li className="nav-item ms-3">

                            <button
                                className="btn btn-danger btn-sm"
                                onClick={logout}
                            >

                                <i className="bi bi-box-arrow-right me-1"></i>

                                Logout

                            </button>

                        </li>

                    </ul>

                </div>

            </div>

        </nav>

    );

}

export default Navbar;