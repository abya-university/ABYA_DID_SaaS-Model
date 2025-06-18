"use client";

import { Routes, Route } from "react-router-dom";
import Header from "./components/header";
import Homepage from "./pages/Home";

export default function Home() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Homepage />} />
      </Routes>

    </>
  );
}
