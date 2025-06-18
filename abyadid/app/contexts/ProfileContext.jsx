"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const ProfileContext = createContext();

const EMPTY_PROFILE = {
  did: null,
  firstName: "",
  secondName: "",
  dateOfBirth: "",
  gender: "",
  email: "",
  countryOfResidence: "",
  preferredLanguages: "",
};

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("profile");
    return saved ? JSON.parse(saved) : EMPTY_PROFILE;
  });

  useEffect(() => {
    localStorage.setItem("profile", JSON.stringify(profile));
  }, [profile]);

  // new helper to wipe everything out
  const clearProfile = () => {
    setProfile(EMPTY_PROFILE);
    localStorage.removeItem("profile");
  };

  return (
    <ProfileContext.Provider value={{ profile, setProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
