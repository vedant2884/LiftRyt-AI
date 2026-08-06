import axios from "axios";

// Centralized axios instance. Auth token attachment and refresh-on-401
// interceptors will be added here in the auth step (step 3) rather than
// scattered across call sites.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});
