import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { MatterProvider } from "./context/MatterContext.jsx";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <MatterProvider>
        <App />
      </MatterProvider>
    </BrowserRouter>
  </StrictMode>
);