import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";
import {
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabaseClient";

import "../styles/admin.css";

const navItems = [
  {
    label: "Dashboard",
    to: "/admin",
    end: true,
    icon: "⌂",
  },
  {
    label: "Users",
    to: "/admin/users",
    icon: "◎",
  },
  {
    label: "Support Tickets",
    to: "/admin/support",
    icon: "◇",
  },
  {
    label: "Legal Knowledge",
    to: "/admin/legal-knowledge",
    icon: "§",
  },
  {
    label: "Referrals",
    to: "/admin/referrals",
    icon: "↗",
  },
  {
    label: "System Activity",
    to: "/admin/activity",
    icon: "≡",
  },
  {
    label: "AI & Product Health",
    to: "/admin/ai-health",
    icon: "✦",
  },
  {
    label: "Settings",
    to: "/admin/settings",
    icon: "⚙",
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  /*
    Prevent the page behind the
    admin drawer from scrolling.
  */
  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  /*
    Allow Escape to close the
    admin navigation drawer.
  */
  useEffect(() => {
    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        sidebarOpen
      ) {
        setSidebarOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [sidebarOpen]);

  function openSidebar() {
    setSidebarOpen(true);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function handleUserApp() {
    closeSidebar();
    navigate("/home");
  }

  async function handleLogout() {
    closeSidebar();

    await supabase.auth.signOut();

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }

  return (
    <div className="admin-app">
      {/* Drawer backdrop */}
      <button
        type="button"
        className={`admin-sidebar-backdrop${
          sidebarOpen
            ? " is-open"
            : ""
        }`}
        onClick={closeSidebar}
        aria-label="Close admin navigation"
        aria-hidden={!sidebarOpen}
        tabIndex={
          sidebarOpen
            ? 0
            : -1
        }
      />

      {/* Admin navigation drawer */}
      <aside
        id="admin-navigation"
        className={`admin-sidebar${
          sidebarOpen
            ? " is-open"
            : ""
        }`}
        aria-label="Admin navigation"
        aria-hidden={!sidebarOpen}
      >
        <div className="admin-sidebar-head">
          <div className="admin-brand">
            <div className="admin-brand-mark">
              V
            </div>

            <div>
              <strong>
                VERDICT
              </strong>

              <span>
                ADMIN
              </span>
            </div>
          </div>

          <button
            type="button"
            className="admin-sidebar-close"
            onClick={closeSidebar}
            aria-label="Close admin menu"
          >
            ×
          </button>
        </div>

        <nav
          className="admin-nav"
          aria-label="Admin sections"
        >
          {navItems.map(
            (item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={
                  closeSidebar
                }
                className={({
                  isActive,
                }) =>
                  `admin-nav-link${
                    isActive
                      ? " active"
                      : ""
                  }`
                }
              >
                <span
                  className="admin-nav-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </NavLink>
            )
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="admin-secondary-action"
            onClick={
              handleUserApp
            }
          >
            <span aria-hidden="true">
              ←
            </span>

            View User App
          </button>

          <button
            type="button"
            className="admin-logout-action"
            onClick={
              handleLogout
            }
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main admin workspace */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-menu-button"
              onClick={
                openSidebar
              }
              aria-label="Open admin menu"
              aria-controls="admin-navigation"
              aria-expanded={
                sidebarOpen
              }
            >
              <span
                aria-hidden="true"
                className="admin-menu-icon"
              >
                ☰
              </span>
            </button>

            <div className="admin-topbar-title">
              <span className="admin-topbar-eyebrow">
                Operations console
              </span>

              <strong>
                Verdict Administration
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="admin-user-app-button"
            onClick={
              handleUserApp
            }
          >
            View User App
          </button>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}