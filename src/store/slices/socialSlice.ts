/**
 * Chaos Computer Club India — Social Redux Slice
 * Real-Time peer following/followers state management, drawer UI, and optimistic sync.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getApiBase, getToken, getStoredMember, apiFetch } from "@/lib/auth";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { invalidateFullProfileCache } from "@/organization/data/queries";
import type { StudentFollowItem } from "@/organization/data/types";
import { fetchCurrentUserThunk } from "./authSlice";

function getMemberSocialKey(): string | null {
  try {
    const mem = getStoredMember();
    return mem?.id ? `ccc_my_social_counts_${mem.id}` : null;
  } catch {
    return null;
  }
}

function getStoredSocialCounts(): { followers: number; following: number; synced: boolean } {
  if (typeof window === "undefined") return { followers: 0, following: 0, synced: false };
  const key = getMemberSocialKey();
  if (key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.followers === "number" && typeof parsed?.following === "number") {
          return { followers: parsed.followers, following: parsed.following, synced: true };
        }
      }
    } catch {}
  }
  try {
    const mem = getStoredMember();
    if (typeof mem?.followers_count === "number" || typeof mem?.following_count === "number") {
      return {
        followers: mem.followers_count || 0,
        following: mem.following_count || 0,
        synced: true,
      };
    }
  } catch {}
  return { followers: 0, following: 0, synced: false };
}

function persistSocialCounts(followers: number, following: number) {
  if (typeof window === "undefined") return;
  const key = getMemberSocialKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ followers, following }));
  } catch {}
}

export interface CadetSocialStats {
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean | undefined;
}

export interface SocialState {
  followingIds: string[];
  hasFetchedFollowing: boolean;
  drawerOpen: boolean;
  drawerType: "followers" | "following";
  drawerTargetHandle: string | null;
  drawerTargetName: string | null;
  drawerTargetId: string | null;
  drawerTargetIsSelf: boolean;
  followersCount: number;
  followingCount: number;
  /** Authenticated user's own follower count — global source of truth */
  myFollowersCount: number;
  /** Authenticated user's own following count — global source of truth */
  myFollowingCount: number;
  /** Whether own social counts have been hydrated from the server */
  hasSyncedMyCounts: boolean;
  /** Global cache of visited/viewed cadets' social counts indexed by handle or id */
  cadetSocialCounts: Record<string, CadetSocialStats>;
  studentsList: StudentFollowItem[];
  loadingList: boolean;
  actionPendingId: string | null;
  searchQuery: string;
  error: string | null;
}

const initialCounts = getStoredSocialCounts();

const initialState: SocialState = {
  followingIds: [],
  hasFetchedFollowing: false,
  drawerOpen: false,
  drawerType: "followers",
  drawerTargetHandle: null,
  drawerTargetName: null,
  drawerTargetId: null,
  drawerTargetIsSelf: false,
  followersCount: 0,
  followingCount: 0,
  myFollowersCount: initialCounts.followers,
  myFollowingCount: initialCounts.following,
  hasSyncedMyCounts: initialCounts.synced,
  cadetSocialCounts: {},
  studentsList: [],
  loadingList: false,
  actionPendingId: null,
  searchQuery: "",
  error: null,
};

// 1. Fetch current authenticated member's followed IDs
export const fetchMyFollowingIdsThunk = createAsyncThunk<string[]>(
  "social/fetchMyFollowingIds",
  async (_, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) return [];
      const data = await apiFetch<{ following_ids: string[] }>("/social/my-following-ids");
      return Array.isArray(data.following_ids) ? Array.from(new Set(data.following_ids)) : [];
    } catch {
      return rejectWithValue("Failed to load following list.");
    }
  },
);

// 1b. Fetch current authenticated member's complete social stats (followers, following, followingIds)
export const fetchMySocialStatsThunk = createAsyncThunk<
  { followersCount: number; followingCount: number; followingIds: string[] },
  string | void
>("social/fetchMySocialStats", async (explicitHandle, { rejectWithValue, getState }) => {
  try {
    const token = getToken();
    if (!token) return { followersCount: 0, followingCount: 0, followingIds: [] };
    const state = getState() as any;
    const currentMember = state.auth?.member || getStoredMember();
    const handle = (typeof explicitHandle === "string" && explicitHandle)
      ? explicitHandle
      : currentMember?.handle;

    const [followersRes, followingIdsRes] = await Promise.all([
      handle
        ? apiFetch<any>(`/social/${encodeURIComponent(handle.replace(/^@+/, ""))}/followers?limit=1`).catch(() => null)
        : null,
      apiFetch<{ following_ids: string[] }>("/social/my-following-ids").catch(() => null),
    ]);

    const followingIds = Array.isArray(followingIdsRes?.following_ids)
      ? Array.from(new Set(followingIdsRes.following_ids))
      : [];

    const followersCount =
      typeof followersRes?.count === "number"
        ? followersRes.count
        : typeof followersRes?.followers_count === "number"
        ? followersRes.followers_count
        : typeof currentMember?.followers_count === "number"
        ? currentMember.followers_count
        : 0;

    const followingCount =
      typeof followersRes?.following_count === "number" && followersRes.following_count > 0
        ? followersRes.following_count
        : followingIds.length;

    return {
      followersCount,
      followingCount,
      followingIds,
    };
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to fetch social stats");
  }
});

// 2. Fetch followers list for a student
export const fetchFollowersThunk = createAsyncThunk<
  { students: StudentFollowItem[]; followersCount: number; followingCount: number },
  string
>("social/fetchFollowers", async (target, { rejectWithValue }) => {
  try {
    const cleanTarget = target.replace(/^@+/, "").trim();
    if (!cleanTarget) return { students: [], followersCount: 0, followingCount: 0 };
    const data = await apiFetch<any>(`/social/${encodeURIComponent(cleanTarget)}/followers`);
    return {
      students: data.students || [],
      followersCount: data.followers_count ?? data.count ?? (data.students || []).length,
      followingCount: data.following_count ?? 0,
    };
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to fetch followers");
  }
});

// 3. Fetch following list for a student
export const fetchFollowingThunk = createAsyncThunk<
  { students: StudentFollowItem[]; followersCount: number; followingCount: number },
  string
>("social/fetchFollowing", async (target, { rejectWithValue }) => {
  try {
    const cleanTarget = target.replace(/^@+/, "").trim();
    if (!cleanTarget) return { students: [], followersCount: 0, followingCount: 0 };
    const data = await apiFetch<any>(`/social/${encodeURIComponent(cleanTarget)}/following`);
    return {
      students: data.students || [],
      followersCount: data.followers_count ?? 0,
      followingCount: data.following_count ?? data.count ?? (data.students || []).length,
    };
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to fetch following");
  }
});

// 4. Toggle Follow / Unfollow
export const toggleFollowThunk = createAsyncThunk<
  {
    targetId: string;
    targetHandle: string;
    isFollowing: boolean;
    followersCount: number;
    followingCount: number;
  },
  { targetId?: string; targetHandle?: string } | string
>("social/toggleFollow", async (arg, { rejectWithValue }) => {
  try {
    const token = getToken();
    if (!token) {
      return rejectWithValue("Authentication required");
    }
    const target = typeof arg === "string" ? arg : (arg.targetId || arg.targetHandle || "");
    const cleanTarget = target.replace(/^@+/, "").trim();
    if (!cleanTarget) return rejectWithValue("Target student handle is required.");

    const data = await apiFetch<any>(`/social/toggle/${encodeURIComponent(cleanTarget)}`, {
      method: "POST",
    });

    invalidateSwrCache("member:profile:full");
    invalidateSwrCache("student:profile:*");
    invalidateFullProfileCache();
    return {
      targetId: data.target_id || (typeof arg === "object" && arg.targetId) || cleanTarget,
      targetHandle: data.target_handle || cleanTarget,
      isFollowing: Boolean(data.is_following),
      followersCount: data.followers_count ?? 0,
      followingCount: data.following_count ?? 0,
    };
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to toggle follow status");
  }
});

export const socialSlice = createSlice({
  name: "social",
  initialState,
  reducers: {
    openSocialDrawer: (
      state,
      action: PayloadAction<{
        targetHandle?: string;
        handle?: string;
        target?: string;
        targetName?: string | null;
        name?: string | null;
        targetId?: string | null;
        followersCount?: number;
        followingCount?: number;
        type?: "followers" | "following";
        mode?: "followers" | "following";
        isSelf?: boolean;
      } | string>,
    ) => {
      const payload = typeof action.payload === "string" ? { handle: action.payload } : action.payload;
      const rawHandle = payload.targetHandle || payload.handle || payload.target || "";
      const cleanHandle = rawHandle.replace(/^@+/, "").trim();
      const rawName = payload.targetName || payload.name || cleanHandle;
      const drawerType = payload.type || payload.mode || "followers";

      state.drawerOpen = true;
      state.drawerType = drawerType;
      state.drawerTargetHandle = cleanHandle;
      state.drawerTargetName = rawName || cleanHandle;
      state.drawerTargetId = payload.targetId || null;
      state.drawerTargetIsSelf = Boolean(payload.isSelf);
      if (typeof payload.followersCount === "number") state.followersCount = payload.followersCount;
      if (typeof payload.followingCount === "number") state.followingCount = payload.followingCount;
      state.searchQuery = "";
      state.studentsList = [];
    },
    closeSocialDrawer: (state) => {
      state.drawerOpen = false;
      state.searchQuery = "";
    },
    setDrawerType: (state, action: PayloadAction<"followers" | "following">) => {
      state.drawerType = action.payload;
    },
    setSocialSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    updateFollowingIdsDirectly: (state, action: PayloadAction<string[]>) => {
      state.followingIds = Array.from(new Set(action.payload));
    },
    /**
     * Hydrate the authenticated user's own follower/following counts from any
     * data source (profile API, SWR, SSE). This is the single write point for
     * `myFollowersCount` / `myFollowingCount` — call it wherever you have
     * fresh server data so every component reads from one global location.
     */
    syncSocialCounts: (
      state,
      action: PayloadAction<{ followersCount?: number; followingCount?: number }>,
    ) => {
      if (typeof action.payload.followersCount === "number") {
        state.myFollowersCount = action.payload.followersCount;
      }
      if (typeof action.payload.followingCount === "number") {
        state.myFollowingCount = action.payload.followingCount;
      }
      state.hasSyncedMyCounts = true;
      persistSocialCounts(state.myFollowersCount, state.myFollowingCount);
    },
    /**
     * Store/update social telemetry for any cadet profile (by handle or id)
     * so non-self social stats stay reactive across components.
     */
    syncCadetSocialCounts: (
      state,
      action: PayloadAction<{
        handleOrId: string;
        followersCount?: number;
        followingCount?: number;
        isFollowing?: boolean;
      }>,
    ) => {
      const key = action.payload.handleOrId.replace(/^@+/, "").trim().toLowerCase();
      if (!key) return;
      const existing = state.cadetSocialCounts[key] || { followersCount: 0, followingCount: 0 };
      state.cadetSocialCounts[key] = {
        followersCount:
          typeof action.payload.followersCount === "number"
            ? action.payload.followersCount
            : existing.followersCount,
        followingCount:
          typeof action.payload.followingCount === "number"
            ? action.payload.followingCount
            : existing.followingCount,
        isFollowing:
          typeof action.payload.isFollowing === "boolean"
            ? action.payload.isFollowing
            : (existing.isFollowing ?? false),
      };
    },
  },
  extraReducers: (builder) => {
    // Current User Profile Sync: keeps authoritative follower/following counts up to date
    builder.addCase(fetchCurrentUserThunk.fulfilled, (state, action) => {
      let changed = false;
      if (typeof action.payload.followers_count === "number") {
        state.myFollowersCount = action.payload.followers_count;
        changed = true;
      }
      if (typeof action.payload.following_count === "number") {
        state.myFollowingCount = action.payload.following_count;
        changed = true;
      }
      if (changed) {
        state.hasSyncedMyCounts = true;
        persistSocialCounts(state.myFollowersCount, state.myFollowingCount);
      }
    });

    // My Social Stats (Followers + Following + FollowingIDs coordinated fetch)
    builder.addCase(fetchMySocialStatsThunk.fulfilled, (state, action) => {
      state.myFollowersCount = action.payload.followersCount;
      state.myFollowingCount = action.payload.followingCount;
      state.hasSyncedMyCounts = true;
      state.followingIds = action.payload.followingIds;
      state.hasFetchedFollowing = true;
      persistSocialCounts(state.myFollowersCount, state.myFollowingCount);
    });

    // My Following IDs
    builder.addCase(fetchMyFollowingIdsThunk.fulfilled, (state, action) => {
      state.followingIds = Array.from(new Set(action.payload));
      state.hasFetchedFollowing = true;
    });
    builder.addCase(fetchMyFollowingIdsThunk.rejected, (state) => {
      state.hasFetchedFollowing = true;
    });

    // Followers List
    builder.addCase(fetchFollowersThunk.pending, (state) => {
      state.loadingList = true;
      state.error = null;
    });
    builder.addCase(fetchFollowersThunk.fulfilled, (state, action) => {
      state.loadingList = false;
      state.studentsList = action.payload.students;
      state.followersCount = action.payload.followersCount;
      if (typeof action.payload.followingCount === "number") {
        state.followingCount = action.payload.followingCount;
      }
      if (state.drawerTargetIsSelf) {
        state.myFollowersCount = action.payload.followersCount;
        if (typeof action.payload.followingCount === "number" && action.payload.followingCount > 0) {
          state.myFollowingCount = action.payload.followingCount;
        }
        state.hasSyncedMyCounts = true;
        persistSocialCounts(state.myFollowersCount, state.myFollowingCount);
      } else if (state.drawerTargetHandle) {
        const key = state.drawerTargetHandle.replace(/^@+/, "").trim().toLowerCase();
        const prev = state.cadetSocialCounts[key] || { followersCount: 0, followingCount: 0 };
        state.cadetSocialCounts[key] = {
          ...prev,
          followersCount: action.payload.followersCount,
          followingCount: action.payload.followingCount || prev.followingCount,
        };
      }
    });
    builder.addCase(fetchFollowersThunk.rejected, (state, action) => {
      state.loadingList = false;
      state.error = action.payload as string;
    });

    // Following List
    builder.addCase(fetchFollowingThunk.pending, (state) => {
      state.loadingList = true;
      state.error = null;
    });
    builder.addCase(fetchFollowingThunk.fulfilled, (state, action) => {
      state.loadingList = false;
      state.studentsList = action.payload.students;
      state.followingCount = action.payload.followingCount;
      if (typeof action.payload.followersCount === "number") {
        state.followersCount = action.payload.followersCount;
      }
      if (state.drawerTargetIsSelf) {
        state.myFollowingCount = action.payload.followingCount;
        if (typeof action.payload.followersCount === "number" && action.payload.followersCount > 0) {
          state.myFollowersCount = action.payload.followersCount;
        }
        state.hasSyncedMyCounts = true;
        persistSocialCounts(state.myFollowersCount, state.myFollowingCount);
      } else if (state.drawerTargetHandle) {
        const key = state.drawerTargetHandle.replace(/^@+/, "").trim().toLowerCase();
        const prev = state.cadetSocialCounts[key] || { followersCount: 0, followingCount: 0 };
        state.cadetSocialCounts[key] = {
          ...prev,
          followersCount: action.payload.followersCount || prev.followersCount,
          followingCount: action.payload.followingCount,
        };
      }
    });
    builder.addCase(fetchFollowingThunk.rejected, (state, action) => {
      state.loadingList = false;
      state.error = action.payload as string;
    });

    // Toggle Follow: Optimistic
    builder.addCase(toggleFollowThunk.pending, (state, action) => {
      state.hasFetchedFollowing = true;
      const arg = action.meta.arg;
      const targetId = typeof arg === "object" ? arg.targetId?.trim() : undefined;
      const targetHandle =
        typeof arg === "object"
          ? arg.targetHandle?.replace(/^@+/, "").trim()
          : typeof arg === "string"
            ? arg.replace(/^@+/, "").trim()
            : "";
      const cleanKey = targetId || targetHandle || "";
      state.actionPendingId = cleanKey;

      const isCurrentlyFollowing = Boolean(
        (targetId && state.followingIds.includes(targetId)) ||
        (targetHandle && state.followingIds.includes(targetHandle))
      );

      if (isCurrentlyFollowing) {
        state.followingIds = state.followingIds.filter(
          (id) => id !== targetId && id !== targetHandle && id !== cleanKey
        );
      } else {
        if (targetId) {
          state.followingIds = Array.from(new Set([...state.followingIds, targetId]));
        } else if (cleanKey) {
          state.followingIds = Array.from(new Set([...state.followingIds, cleanKey]));
        }
      }

      // Update in currently open list if present
      const item = state.studentsList.find(
        (s) =>
          (targetId && s.id === targetId) ||
          (targetHandle && (s.handle || "").toLowerCase() === (targetHandle || "").toLowerCase())
      );
      if (item) {
        item.is_following = !isCurrentlyFollowing;
      }
    });
    builder.addCase(toggleFollowThunk.fulfilled, (state, action) => {
      state.hasFetchedFollowing = true;
      state.actionPendingId = null;
      const { targetId, targetHandle, isFollowing, followersCount, followingCount } = action.payload;

      const cleanHandle = (targetHandle || "").replace(/^@+/, "").trim();
      const cleanId = (targetId || "").trim();

      if (isFollowing) {
        if (cleanId) {
          state.followingIds = Array.from(new Set([...state.followingIds, cleanId]));
        }
        // I just followed someone — my own following count goes up
        if (state.hasSyncedMyCounts) state.myFollowingCount = Math.max(0, state.myFollowingCount + 1);
      } else {
        state.followingIds = state.followingIds.filter(
          (id) => id !== cleanId && id !== cleanHandle
        );
        // I just unfollowed someone — my own following count goes down
        if (state.hasSyncedMyCounts) state.myFollowingCount = Math.max(0, state.myFollowingCount - 1);
      }

      // Override with authoritative server counts when available
      if (typeof followingCount === "number" && state.hasSyncedMyCounts) {
        state.myFollowingCount = followingCount;
      }
      persistSocialCounts(state.myFollowersCount, state.myFollowingCount);

      if (cleanHandle) {
        const key = cleanHandle.toLowerCase();
        const prev = state.cadetSocialCounts[key] || { followersCount: 0, followingCount: 0 };
        state.cadetSocialCounts[key] = {
          ...prev,
          followersCount: typeof followersCount === "number" ? followersCount : (isFollowing ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1)),
          isFollowing: isFollowing,
        };
      }

      // Update in active modal list
      const item = state.studentsList.find(
        (s) => (cleanId && s.id === cleanId) || (cleanHandle && (s.handle || "").toLowerCase() === cleanHandle.toLowerCase())
      );
      if (item) {
        item.is_following = isFollowing;
      }

      // If drawer is currently focused on this student, update followers count
      if (
        state.drawerTargetHandle &&
        ((state.drawerTargetHandle || "").toLowerCase() === cleanHandle.toLowerCase() ||
          (cleanId && state.drawerTargetId === cleanId))
      ) {
        state.followersCount = followersCount;
      }
    });
    builder.addCase(toggleFollowThunk.rejected, (state, action) => {
      state.hasFetchedFollowing = true;
      state.actionPendingId = null;
      const arg = action.meta.arg;
      const targetId = typeof arg === "object" ? arg.targetId?.trim() : undefined;
      const targetHandle =
        typeof arg === "object"
          ? arg.targetHandle?.replace(/^@+/, "").trim()
          : typeof arg === "string"
            ? arg.replace(/^@+/, "").trim()
            : "";
      const cleanKey = targetId || targetHandle || "";

      // Roll back
      const isCurrentlyInStore = Boolean(
        (targetId && state.followingIds.includes(targetId)) ||
        (targetHandle && state.followingIds.includes(targetHandle))
      );

      if (isCurrentlyInStore) {
        state.followingIds = state.followingIds.filter(
          (id) => id !== targetId && id !== targetHandle && id !== cleanKey
        );
      } else {
        if (targetId) {
          state.followingIds = Array.from(new Set([...state.followingIds, targetId]));
        } else if (cleanKey) {
          state.followingIds = Array.from(new Set([...state.followingIds, cleanKey]));
        }
      }
      const item = state.studentsList.find(
        (s) =>
          (targetId && s.id === targetId) ||
          (targetHandle && (s.handle || "").toLowerCase() === (targetHandle || "").toLowerCase())
      );
      if (item) {
        item.is_following = !item.is_following;
      }
    });
  },
});

export const {
  openSocialDrawer,
  closeSocialDrawer,
  setDrawerType,
  setSocialSearchQuery,
  updateFollowingIdsDirectly,
  syncSocialCounts,
  syncCadetSocialCounts,
} = socialSlice.actions;

export default socialSlice.reducer;

