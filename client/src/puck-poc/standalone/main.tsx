import React from "react";
import { createRoot } from "react-dom/client";
import { PuckPocPage } from "../PuckPocPage";
import "@measured/puck/puck.css";
import "../blocks.css";
import "../editor.css";

createRoot(document.getElementById("root")!).render(<PuckPocPage />);
