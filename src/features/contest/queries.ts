import { queryOptions } from "@tanstack/react-query";
import { contestApi } from "./api";

const MINUTE = 60 * 1000;

export const contestQueries = {
  list: () =>
    queryOptions({
      queryKey: ["contest", "list"],
      queryFn: () => contestApi.list(),
      staleTime: MINUTE,
    }),
  detail: (slug: string) =>
    queryOptions({
      queryKey: ["contest", "detail", slug],
      queryFn: () => contestApi.detail(slug),
      staleTime: MINUTE,
    }),
  problems: (slug: string) =>
    queryOptions({
      queryKey: ["contest", "problems", slug],
      queryFn: () => contestApi.problems(slug),
      staleTime: 5 * MINUTE,
    }),
  registration: (slug: string) =>
    queryOptions({
      queryKey: ["contest", "registration", slug],
      queryFn: () => contestApi.registrationStatus(slug),
      staleTime: 15 * 1000,
    }),
  ranking: (slug: string) =>
    queryOptions({
      queryKey: ["contest", "ranking", slug],
      queryFn: () => contestApi.ranking(slug),
      refetchInterval: 30 * 1000,
      staleTime: 15 * 1000,
    }),
  finalStandings: (slug: string) =>
    queryOptions({
      queryKey: ["contest", "final-standings", slug],
      queryFn: () => contestApi.finalStandings(slug),
      staleTime: MINUTE,
    }),
  pass: () =>
    queryOptions({
      queryKey: ["contest", "pass"],
      queryFn: () => contestApi.myPass(),
      staleTime: MINUTE,
    }),
  participated: () =>
    queryOptions({
      queryKey: ["contest", "participated"],
      queryFn: () => contestApi.participated(),
      staleTime: MINUTE,
    }),
};
