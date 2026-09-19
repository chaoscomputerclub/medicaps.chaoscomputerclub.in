/**
 * Chaos Computer Club India — Social Redux Slice
 * Real-Time peer following/followers state management, drawer UI, and optimistic sync.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getApiBase, getToken } from "@/lib/auth";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { invalidateFullProfileCache } from "@/organization/data/queries";
import type { StudentFollowItem } from "@/organization/data/types";

export interface SocialState {
  followingIds: string[];
  hasFetchedFollowing: boolean;
  drawerOpen: boolean;
  drawerType: "followers" | "following";
  drawerTargetHandle: string | null;
  drawerTargetName: string | null;
  drawerTargetId: string | null;
  followersCount: number;
  followingCount: number;
  studentsList: StudentFollowItem[];
  loadingList: boolean;
  actionPendingId: string | null;
  searchQuery: string;
  error: string | null;
}

const initialState: SocialState = {
  followingIds: [],
  hasFetchedFollowing: false,
  drawerOpen: false,
  drawerType: "followers",
  drawerTargetHandle: null,
  drawerTargetName: null,
  drawerTargetId: null,
  followersCount: 0,
  followingCount: 0,
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
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/social/my-following-ids`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.following_ids) ? Array.from(new Set(data.following_ids)) : [];
    } catch {
      return rejectWithValue("Failed to load following list.");
    }
  },
);

// 2. Fetch followers list for a student
export const fetchFollowersThunk = createAsyncThunk<
  { students: StudentFollowItem[]; followersCount: number; followingCount: number },
  string
>("social/fetchFollowers", async (target, { rejectWithValue }) => {
  try {
    const cleanTarget = target.replace(/^@+/, "").trim();
    if (!cleanTarget) return { students: [], followersCount: 0, followingCount: 0 };
    const token = getToken();
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/social/${encodeURIComponent(cleanTarget)}/followers`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error("Failed to fetch followers");
    const data = await res.json();
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
    const token = getToken();
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/social/${encodeURIComponent(cleanTarget)}/following`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error("Failed to fetch following");
    const data = await res.json();
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
      window.location.href = "/auth";
      return rejectWithValue("Authentication required");
    }
    const target = typeof arg === "string" ? arg : (arg.targetId || arg.targetHandle || "");
    const cleanTarget = target.replace(/^@+/, "").trim();
    if (!cleanTarget) return rejectWithValue("Target student handle is required.");

    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/social/toggle/${encodeURIComponent(cleanTarget)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Action failed" }));
      return rejectWithValue(err.detail || "Action failed");
    }

    const data = await res.json();
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
  },
  extraReducers: (builder) => {
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
      const { targetId, targetHandle, isFollowing, followersCount } = action.payload;

      const cleanHandle = (targetHandle || "").replace(/^@+/, "").trim();
      const cleanId = (targetId || "").trim();

      if (isFollowing) {
        if (cleanId) {
          state.followingIds = Array.from(new Set([...state.followingIds, cleanId]));
        }
      } else {
        state.followingIds = state.followingIds.filter(
          (id) => id !== cleanId && id !== cleanHandle
        );
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
} = socialSlice.actions;

export default socialSlice.reducer;

