/**
 * Chaos Computer Club India — Frontend Auth Middleware Guard
 * Strictly blocks unauthenticated access to inner platform routes.
 * Synchronously checks JWT validity and Redux auth state to immediately eject logged-out users.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated, getToken } from "@/lib/auth";
import { useAppSelector } from "@/store/hooks";

export function AuthGuard() {
  const location = useLocation();
  const reduxToken = useAppSelector((state) => state.auth.token);
  const reduxIsAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const token = getToken();
  const authed = isAuthenticated();

  // If token is absent in storage or Redux state marks user logged out, immediately throw outside to /auth
  if (!token || !authed || !reduxToken || !reduxIsAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function GuestGuard() {
  const reduxToken = useAppSelector((state) => state.auth.token);
  const reduxIsAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const token = getToken();
  const authed = isAuthenticated();

  // If already authenticated in both storage and Redux, redirect straight to inner operations console
  if ((token && authed) && (reduxToken && reduxIsAuthenticated)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
