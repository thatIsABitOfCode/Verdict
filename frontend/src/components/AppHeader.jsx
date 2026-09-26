import verdictLogo from "../assets/verdict-logo.png";

function AppHeader({
  onMenuOpen,
  onNotifications,
}) {
  return (
    <header className="app-header">
      <button
        className="menu-button"
        type="button"
        onClick={onMenuOpen}
        aria-label="Open navigation"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className="app-wordmark">
        <img
          src={verdictLogo}
          alt="Verdict"
          className="app-header-logo"
        />
      </div>

      <button
        className="notification-button"
        type="button"
        onClick={onNotifications}
        aria-label="Open notifications"
      >
        <span className="notification-ring">
          ◌
        </span>
      </button>
    </header>
  );
}

export default AppHeader;