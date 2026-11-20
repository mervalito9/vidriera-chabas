import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

// Sin esto, Safari del iPhone no muestra el efecto al tocar botones (:active).
document.addEventListener("touchstart", () => {}, { passive: true });

const raiz = document.getElementById("root");
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
