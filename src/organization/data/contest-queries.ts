import { contestSystemService } from "./contest-system";

export const contestSystemQueries = {
  contests: () => ({ queryKey: ["contest-system", "contests"], queryFn: () => contestSystemService.listContests() }),
  contest: (slug: string) => ({ queryKey: ["contest-system", "contest", slug], queryFn: () => contestSystemService.getContest(slug) }),
  history: () => ({ queryKey: ["contest-system", "history"], queryFn: () => contestSystemService.getHistory() }),
  settings: () => ({ queryKey: ["contest-system", "settings"], queryFn: () => contestSystemService.getSettings() }),
};
