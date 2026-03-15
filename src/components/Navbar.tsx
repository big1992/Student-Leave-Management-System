"use client";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X, User, Languages } from "lucide-react";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";

export default function Navbar() {
  const { user, profile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "th" : "en");
  };

  const getRoleTranslation = (role?: string) => {
    if (role === "Student") return t.roleStudent;
    if (role === "Approver") return t.roleApprover;
    if (role === "Admin") return t.roleAdmin;
    return role || "User";
  };

  if (!user) return null; // Don't show navbar before login

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">
                {t.appTitle}
              </span>
            </Link>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-100 rounded-full transition-colors"
              title="Change Language"
            >
              <Languages className="w-4 h-4" />
              {language === "th" ? "TH" : "EN"}
            </button>

            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
              <User className="w-4 h-4 text-gray-500" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 line-clamp-1">{profile?.name || user.email}</span>
                <span className="text-xs text-blue-600 font-semibold">{getRoleTranslation(profile?.role)}</span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title={t.logout}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center sm:hidden gap-2">
            <button
              onClick={toggleLanguage}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            >
              <span className="text-sm font-bold">{language === "th" ? "TH" : "EN"}</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white">
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800">
                  {profile?.name || "Student User"}
                </div>
                <div className="text-sm font-medium text-blue-600">
                  {profile?.role || "Student"}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
