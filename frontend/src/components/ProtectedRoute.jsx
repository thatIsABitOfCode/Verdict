import {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function ProtectedRoute({
  children,
}) {
  const location =
    useLocation();

  const [loading, setLoading] =
    useState(true);

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth
          .getSession();

      if (!mounted) {
        return;
      }

      setIsAuthenticated(
        Boolean(session)
      );

      setLoading(false);
    }

    checkSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            session
          ) => {
            if (!mounted) {
              return;
            }

            setIsAuthenticated(
              Boolean(session)
            );

            setLoading(false);
          }
        );

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-shell">
          <div className="auth-brand">
            <div className="mini-logo">
              V
            </div>

            <span>
              VERDICT
            </span>
          </div>

          <div className="auth-copy">
            <p className="eyebrow">
              Checking session
            </p>

            <h1>
              Please wait...
            </h1>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            location.pathname,
        }}
      />
    );
  }

  return children;
}

export default ProtectedRoute;