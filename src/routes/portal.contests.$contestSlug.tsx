import { Outlet, createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/portal/contests/$contestSlug")({component:()=> <Outlet/>});
