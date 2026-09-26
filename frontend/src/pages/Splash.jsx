import { useNavigate } from "react-router-dom";
import "../styles/splash.css";

function Splash() {
  const navigate = useNavigate();

  return (
    <main className="splash-page">
      <div className="splash-content">
        <div className="splash-brand">
          <div className="verdict-logo" aria-hidden="true">
            <span className="logo-left"></span>
            <span className="logo-right"></span>
          </div>

          <h1>VERDICT</h1>

          <div className="splash-divider"></div>

          <p className="splash-tagline">
            Know your rights.
            <br />
            Take the next step.
          </p>
        </div>

        <div className="splash-actions">
          <button
            className="get-started-button"
            onClick={() => navigate("/login")}
          >
            <span>Get started</span>
            <span className="arrow">→</span>
          </button>

          <p>Clear guidance. Informed decisions.</p>
        </div>
      </div>
    </main>
  );
}

export default Splash;