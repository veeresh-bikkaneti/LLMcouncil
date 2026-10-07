import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Chamber } from "./components/council/chamber";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Chamber />
    </StrictMode>,
  );
}
