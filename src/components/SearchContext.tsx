import React, { createContext, useState, ReactNode, useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SearchContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  placeholder: string;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [placeholder, setPlaceholder] = useState("Search...");
  const location = useLocation();

  // Dynamically change placeholder based on current route
  useEffect(() => {
    if (location.pathname.includes("/doctors")) {
      setPlaceholder("Search doctors...");
    } else if (location.pathname.includes("/appointments")) {
      setPlaceholder("Search appointments...");
    } else if (location.pathname.includes("/patients")) {
      setPlaceholder("Search patients...");
    } else if (location.pathname.includes("/dashboard")) {
      setPlaceholder("Search dashboard...");
    } else {
      setPlaceholder("Search...");
    }
  }, [location.pathname]);

  return (
    <SearchContext.Provider value={{ searchTerm, setSearchTerm, placeholder }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) throw new Error("useSearch must be used within SearchProvider");
  return context;
};
