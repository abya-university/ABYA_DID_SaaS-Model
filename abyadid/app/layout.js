"use client";

import "./globals.css";
import Providers from "./providers/provider";
import { BrowserRouter } from "react-router-dom";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <BrowserRouter>
        <Providers>
          {children}
        </Providers>
      </BrowserRouter>
    </html>
  );
}