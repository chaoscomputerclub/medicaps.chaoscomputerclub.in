import { queryOptions } from "@tanstack/react-query";
import { contestSystemService } from "./contest-system";

export const contestSystemQueries = {
  contests: () => queryOptions({ queryKey: ["contest-system", "contests"], queryFn: () => contestSystemService.listContests() }),
  contest: (slug: string) => queryOptions({ queryKey: ["contest-system", "contest", slug], queryFn: () => contestSystemService.getContest(slug) }),
  history: () => queryOptions({ queryKey: ["contest-system", "history"], queryFn: () => contestSystemService.getHistory() }),
  settings: () => queryOptions({ queryKey: ["contest-system", "settings"], queryFn: () => contestSystemService.getSettings() }),
};
