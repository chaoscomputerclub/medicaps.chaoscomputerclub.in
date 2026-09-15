import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "@/store";
import { Toaster } from "@/components/ui/sonner";
import { AppRoutes } from "./AppRoutes";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster theme="dark" />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
