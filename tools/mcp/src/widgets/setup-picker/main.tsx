import "../styles.css";
import { createRoot } from "react-dom/client";
import { SetupPicker } from "./setup-picker";

const root = document.getElementById("root");
if (root) createRoot(root).render(<SetupPicker />);
