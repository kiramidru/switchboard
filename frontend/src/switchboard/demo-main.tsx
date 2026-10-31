import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import DemoApp from "./DemoApp";
import { mountSwitchboard } from "./mount";
import "./demo.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DemoApp onLaunch={() => mountSwitchboard("demo")} />
  </React.StrictMode>,
);
