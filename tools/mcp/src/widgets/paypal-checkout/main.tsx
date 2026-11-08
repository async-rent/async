import "../styles.css";
import { createRoot } from "react-dom/client";
import { PayPalCheckout } from "./paypal-checkout";

const root = document.getElementById("root");
if (root) createRoot(root).render(<PayPalCheckout />);
