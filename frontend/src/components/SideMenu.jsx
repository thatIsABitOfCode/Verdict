import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabaseClient";
import { useMatter } from "../context/useMatter";
import verdictIcon from "../assets/verdict-icon.png";

function SideMenu({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearMatter } = useMatter();
  const [loggingOut, setLoggingOut] = useState(false);

  function goTo(path) {
    navigate(path, { replace: true });
    onClose?.();
  }

  function isActive(path) {
    if (path === "/home") {
      return location.pathname === "/home";
    }

    return location.pathname.startsWith(path);
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      clearMatter();

      try {
        localStorage.removeItem("verdict-profile");
        localStorage.removeItem("verdict-settings");
        localStorage.removeItem("verdict-calendar-events");
        localStorage.removeItem("verdict-current-matter");
      } catch (storageError) {
        console.error(
          "Unable to clear local Verdict data:",
          storageError
        );
      }

      navigate("/login", { replace: true });
      onClose?.();
    } catch (logoutError) {
      console.error("Unable to sign out:", logoutError);
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div
        className={`menu-overlay ${open ? "open" : ""}`}
        onClick={onClose}
      />

      <aside
        className={`side-menu ${open ? "open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="menu-top">
          <div className="menu-brand-wrap">
            <img
              src={verdictIcon}
              alt=""
              className="side-menu-icon"
            />

            <div className="menu-brand-text">
              <strong>VERDICT</strong>
              <p>Your legal preparation space</p>
            </div>
          </div>

          <button
            type="button"
            className="close-menu-button"
            onClick={onClose}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <nav className="main-navigation">
          <button
            type="button"
            className={`nav-link ${isActive("/home") ? "active" : ""}`}
            onClick={() => goTo("/home")}
          >
            <span className="nav-icon">⌂</span>
            <span>Home</span>
          </button>

          <button
            type="button"
            className={`nav-link ${isActive("/matters") ? "active" : ""}`}
            onClick={() => goTo("/matters")}
          >
            <span className="nav-icon">▣</span>
            <span>My Matters</span>
          </button>

          <button
            type="button"
            className={`nav-link ${isActive("/verdict-ai") ? "active" : ""}`}
            onClick={() => goTo("/verdict-ai")}
          >
            <span className="nav-icon">V</span>
            <span>Verdict AI</span>
          </button>

          <button
            type="button"
            className={`nav-link ${isActive("/calendar") ? "active" : ""}`}
            onClick={() => goTo("/calendar")}
          >
            <span className="nav-icon">□</span>
            <span>Calendar</span>
          </button>

          <button
            type="button"
            className={`nav-link ${isActive("/rights") ? "active" : ""}`}
            onClick={() => goTo("/rights")}
          >
            <span className="nav-icon">i</span>
            <span>Know Your Rights</span>
          </button>

          <button
            type="button"
            className={`nav-link ${isActive("/help") ? "active" : ""}`}
            onClick={() => goTo("/help")}
          >
            <span className="nav-icon">◎</span>
            <span>Find Help</span>
          </button>

          <button
            type="button"
            className={`nav-link ${isActive("/profile") ? "active" : ""}`}
            onClick={() => goTo("/profile")}
          >
            <span className="nav-icon">○</span>
            <span>Profile</span>
          </button>
        </nav>

        <div className="menu-footer">
          <button type="button" onClick={() => goTo("/settings")}>
            Settings
          </button>

          <button type="button" onClick={() => goTo("/support")}>
            Help &amp; Support
          </button>

          <button type="button" onClick={() => goTo("/privacy")}>
            Privacy
          </button>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </aside>
    </>
  );
}

export default SideMenu;