import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import {ContentProvider} from './Content.jsx';
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ContentProvider><App /></ContentProvider>
  </React.StrictMode>,
);
