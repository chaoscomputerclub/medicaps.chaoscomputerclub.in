import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/recover")({ component: () => <Navigate to="/auth" /> });
