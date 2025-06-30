"use client";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./header";
import Homepage from "../pages/Home";

export default function ClientApp() {
    return (
        <BrowserRouter>
            <Header />
            <Routes>
                <Route path="/" element={<Homepage />} />
            </Routes>
        </BrowserRouter>
    );
}