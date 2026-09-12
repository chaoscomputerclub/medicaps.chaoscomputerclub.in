import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CCC Medi-Caps — Offline Contest Portal" },
      {
        name: "description",
        content:
          "The proctored offline competitive programming platform of Chaos Computer Club, Medi-Caps Chapter.",
      },
      { property: "og:title", content: "CCC Medi-Caps Offline Contest Portal" },
      {
        property: "og:description",
        content: "Campus contests, verified scoreboards, ratings, and cryptographic result proofs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Navigate to="/portal" />,
});
