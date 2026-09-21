/**
 * Chaos Computer Club India — Frontend Auth Middleware Guard
 * Strictly blocks unauthenticated access to inner platform routes.
 * Synchronously checks JWT validity and redirects before rendering any child elements.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated, getToken } from "@/lib/auth";

export function AuthGuard() {
  const location = useLocation();
  const token = getToken();
  const authed = isAuthenticated();

  if (!token || !authed) {
    // Save current path so user can be redirected back after logging in
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function GuestGuard() {
  const token = getToken();
  const authed = isAuthenticated();

  // If already authenticated, redirect straight to inner operations console
  if (token && authed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
