import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Member Login — CCC Medi-Caps" },
      { name: "description", content: "Sign in to the CCC Medi-Caps contest portal." },
      { property: "og:title", content: "CCC Medi-Caps Login" },
      { property: "og:description", content: "Institutional member access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Navigate to="/auth" />,
});
