/**
 * Chaos Computer Club India — Frontend Auth Middleware Guard
 * Strictly blocks unauthenticated access to inner platform routes.
 * Synchronously checks JWT validity and Redux auth state to immediately eject logged-out users.
 */

import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated, getToken, getStoredMember, silentRefreshToken } from "@/lib/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTokenDirect } from "@/store/slices/authSlice";
import { GlobalLoader } from "@/components/ui/WanderingEyes";

export function AuthGuard() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const reduxToken = useAppSelector((state) => state.auth.token);
  const reduxIsAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  // Synchronous fast-path: if valid token exists in storage, allow immediate entry
  const [authStatus, setAuthStatus] = useState<"authenticated" | "checking" | "unauthenticated">(
    () => {
      return isAuthenticated() ? "authenticated" : "checking";
    },
  );

  useEffect(() => {
    let isMounted = true;

    if (isAuthenticated()) {
      const storedToken = getToken();
      if (storedToken && (!reduxToken || !reduxIsAuthenticated)) {
        dispatch(setTokenDirect(storedToken));
      }
      setAuthStatus("authenticated");
      return;
    }

    // Token is expired or missing in storage — attempt silent refresh via HttpOnly cookie
    setAuthStatus("checking");
    silentRefreshToken()
      .then((success) => {
        if (!isMounted) return;
        if (success) {
          const newToken = getToken();
          if (newToken) {
            dispatch(setTokenDirect(newToken));
          }
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      })
      .catch(() => {
        if (isMounted) setAuthStatus("unauthenticated");
      });

    return () => {
      isMounted = false;
    };
  }, [dispatch, reduxToken, reduxIsAuthenticated]);

  if (authStatus === "checking") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <GlobalLoader text="Loading" size="large" />
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function GuestGuard() {
  const location = useLocation();
  const dispatch = useAppDispatch();

  // If already authenticated, redirect immediately
  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  // Only check silent refresh on /auth if past session indicators exist in storage
  const hasPastSession = Boolean(getToken() || getStoredMember());
  const params = new URLSearchParams(location.search);
  const hasErrorOrLogout = Boolean(params.get("error") || params.get("logged_out"));

  const [isChecking, setIsChecking] = useState(() => hasPastSession && !hasErrorOrLogout);

  useEffect(() => {
    let isMounted = true;

    if (!hasPastSession || hasErrorOrLogout || isAuthenticated()) {
      setIsChecking(false);
      return;
    }

    silentRefreshToken()
      .then((success) => {
        if (!isMounted) return;
        if (success) {
          const newToken = getToken();
          if (newToken) dispatch(setTokenDirect(newToken));
        }
        setIsChecking(false);
      })
      .catch(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hasPastSession, hasErrorOrLogout, dispatch]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <GlobalLoader text="Loading" size="large" />
      </div>
    );
  }

  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
