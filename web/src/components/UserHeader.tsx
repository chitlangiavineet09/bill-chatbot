"use client";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Shield, ChevronDown, Settings } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function UserHeader() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
        <div className="animate-pulse bg-gray-300 dark:bg-gray-600 h-4 w-20 rounded"></div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex items-center space-x-2">
        <a
          href="/login"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Sign In
        </a>
      </div>
    );
  }

  const user = session.user;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <div className="flex items-center space-x-2">
          {user.role === "Admin" ? (
            <Shield className="w-5 h-5 text-red-600" />
          ) : (
            <User className="w-5 h-5" />
          )}
          <div className="text-left">
            <div className="text-sm font-medium">{user.name || user.email}</div>
            <div className="text-xs text-gray-500">{user.role || "User"}</div>
          </div>
        </div>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              <div className="font-medium">{user.name || user.email}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            
            {user.role === "Admin" && (
              <a
                href="/settings"
                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </a>
            )}
            
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                handleLogout();
              }}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
