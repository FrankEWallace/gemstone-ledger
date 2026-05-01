import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@fontsource-variable/geist";
import { initFontPreference } from "./hooks/useFontPreference";

initFontPreference();

createRoot(document.getElementById("root")!).render(<App />);
