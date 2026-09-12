import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  getToken,
  setToken as persistToken,
  clearToken as removePersistedToken,
  sendOTP,
  verifyOTP,
  getMe,
  completeOnboarding,
  type Member,
  type AuthResult,
} from "@/lib/auth";

export interface AuthState {
  member: Member | null;
  token: string | null;
  isAuthenticated: boolean;
  step: "email" | "otp" | "onboarding";
  email: string;
  transactionId: string | null;
  otp: string;
  name: string;
  handle: string;
  prn: string;
  department: string;
  batch: string;
  pending: boolean;
  message: string | null;
  devOtp: string | null;
}

const initialToken = typeof window !== "undefined" ? getToken() : null;

const initialState: AuthState = {
  member: null,
  token: initialToken,
  isAuthenticated: Boolean(initialToken),
  step: "email",
  email: "",
  transactionId: null,
  otp: "",
  name: "",
  handle: "",
  prn: "",
  department: "CSE",
  batch: "2023-27",
  pending: false,
  message: null,
  devOtp: null,
};

// Async Thunks
export const sendOtpThunk = createAsyncThunk<
  { sent: boolean; email: string; transaction_id?: string; dev_otp?: string },
  string,
  { rejectValue: string }
>("auth/sendOtp", async (email, { rejectWithValue }) => {
  try {
    return await sendOTP(email.trim().toLowerCase());
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to send verification code.");
  }
});

export const verifyOtpThunk = createAsyncThunk<
  AuthResult,
  { email: string; code: string; transaction_id?: string },
  { rejectValue: string }
>("auth/verifyOtp", async ({ email, code, transaction_id }, { rejectWithValue }) => {
  try {
    const res = await verifyOTP(email.trim().toLowerCase(), code.trim(), transaction_id);
    persistToken(res.access_token);
    return res;
  } catch (err: any) {
    return rejectWithValue(err?.message || "Invalid or expired code. Please check and try again.");
  }
});

export const fetchCurrentUserThunk = createAsyncThunk<
  Member,
  void,
  { rejectValue: string }
>("auth/fetchCurrentUser", async (_, { rejectWithValue }) => {
  try {
    const res = await getMe();
    return res.member;
  } catch (err: any) {
    removePersistedToken();
    return rejectWithValue(err?.message || "Session expired.");
  }
});

export const completeOnboardingThunk = createAsyncThunk<
  Member,
  { handle: string; full_name: string; prn: string; department: string; batch: string },
  { rejectValue: string }
>("auth/completeOnboarding", async (data, { rejectWithValue }) => {
  try {
    const res = await completeOnboarding(data);
    return res.member;
  } catch (err: any) {
    return rejectWithValue(err?.message || "Failed to complete onboarding.");
  }
});

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setEmail(state, action: PayloadAction<string>) {
      state.email = action.payload;
    },
    setOtp(state, action: PayloadAction<string>) {
      state.otp = action.payload;
    },
    setName(state, action: PayloadAction<string>) {
      state.name = action.payload;
    },
    setHandle(state, action: PayloadAction<string>) {
      state.handle = action.payload;
    },
    setPrn(state, action: PayloadAction<string>) {
      state.prn = action.payload;
    },
    setDepartment(state, action: PayloadAction<string>) {
      state.department = action.payload;
    },
    setBatch(state, action: PayloadAction<string>) {
      state.batch = action.payload;
    },
    setStep(state, action: PayloadAction<"email" | "otp" | "onboarding">) {
      state.step = action.payload;
    },
    setMessage(state, action: PayloadAction<string | null>) {
      state.message = action.payload;
    },
    setDevOtp(state, action: PayloadAction<string | null>) {
      state.devOtp = action.payload;
    },
    setTokenDirect(state, action: PayloadAction<string>) {
      state.token = action.payload;
      state.isAuthenticated = true;
      persistToken(action.payload);
    },
    logout(state) {
      removePersistedToken();
      state.token = null;
      state.member = null;
      state.isAuthenticated = false;
      state.step = "email";
      state.email = "";
      state.otp = "";
      state.message = null;
      state.devOtp = null;
    },
  },
  extraReducers: (builder) => {
    // sendOtpThunk
    builder.addCase(sendOtpThunk.pending, (state) => {
      state.pending = true;
      state.message = null;
    });
    builder.addCase(sendOtpThunk.fulfilled, (state, action) => {
      state.pending = false;
      state.step = "otp";
      if (action.payload.transaction_id) {
        state.transactionId = action.payload.transaction_id;
      }
      if (action.payload.dev_otp) {
        state.devOtp = action.payload.dev_otp;
      }
      state.message = null;
    });
    builder.addCase(sendOtpThunk.rejected, (state, action) => {
      state.pending = false;
      state.message = action.payload || "Failed to send code.";
    });

    // verifyOtpThunk
    builder.addCase(verifyOtpThunk.pending, (state) => {
      state.pending = true;
      state.message = null;
    });
    builder.addCase(verifyOtpThunk.fulfilled, (state, action) => {
      state.pending = false;
      state.token = action.payload.access_token;
      state.isAuthenticated = true;
      state.member = action.payload.member;
      if (action.payload.member) {
        if (action.payload.member.full_name) state.name = action.payload.member.full_name;
        if (action.payload.member.handle) state.handle = action.payload.member.handle;
      }
      if (action.payload.is_new_user || !action.payload.member?.is_onboarded) {
        state.step = "onboarding";
      }
      state.message = null;
    });
    builder.addCase(verifyOtpThunk.rejected, (state, action) => {
      state.pending = false;
      state.message = action.payload || "Verification failed.";
    });

    // fetchCurrentUserThunk
    builder.addCase(fetchCurrentUserThunk.fulfilled, (state, action) => {
      state.member = action.payload;
      state.isAuthenticated = true;
      if (action.payload.full_name) state.name = action.payload.full_name;
      if (action.payload.handle) state.handle = action.payload.handle;
      if (!action.payload.is_onboarded) {
        state.step = "onboarding";
      }
    });
    builder.addCase(fetchCurrentUserThunk.rejected, (state) => {
      state.member = null;
      state.token = null;
      state.isAuthenticated = false;
    });

    // completeOnboardingThunk
    builder.addCase(completeOnboardingThunk.pending, (state) => {
      state.pending = true;
      state.message = null;
    });
    builder.addCase(completeOnboardingThunk.fulfilled, (state, action) => {
      state.pending = false;
      state.member = action.payload;
      state.message = null;
    });
    builder.addCase(completeOnboardingThunk.rejected, (state, action) => {
      state.pending = false;
      state.message = action.payload || "Onboarding failed.";
    });
  },
});

export const {
  setEmail,
  setOtp,
  setName,
  setHandle,
  setPrn,
  setDepartment,
  setBatch,
  setStep,
  setMessage,
  setDevOtp,
  setTokenDirect,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
