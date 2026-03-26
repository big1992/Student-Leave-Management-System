"use client";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X, User, Languages, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function Navbar() {
  const { user, profile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string, link: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      if (link) {
        setNotificationsOpen(false);
        router.push(link);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      updateDoc(doc(db, "notifications", n.id), { read: true }).catch(console.error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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

            {/* Notifications */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-full transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:underline">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => markAsRead(n.id, n.link)}
                          className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}
                        >
                          <p className="text-sm text-gray-800 font-medium">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{formatDistanceToNow(n.createdAt?.toDate?.() || new Date(), {addSuffix: true})}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link href="/profile" className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-full border border-gray-100 transition-colors cursor-pointer">
              <User className="w-4 h-4 text-gray-500" />
              <div className="flex flex-col text-left">
                <span className="text-sm font-medium text-gray-900 line-clamp-1">{profile?.name || user.email}</span>
                <span className="text-xs text-blue-600 font-semibold">{getRoleTranslation(profile?.role)}</span>
              </div>
            </Link>
            
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
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
                </span>
              )}
            </button>
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

      {notificationsOpen && (
        <div className="sm:hidden absolute top-16 left-0 right-0 bg-white shadow-xl border-t border-gray-100 z-50">
          <div className="px-4 py-3 flex justify-between items-center border-b border-gray-50 bg-gray-50/50">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-blue-600 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => markAsRead(n.id, n.link)}
                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer active:bg-gray-50 ${!n.read ? 'bg-blue-50/30' : ''}`}
                >
                  <p className="text-sm text-gray-800 font-medium">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1.5">{formatDistanceToNow(n.createdAt?.toDate?.() || new Date(), {addSuffix: true})}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white">
          <div className="pt-4 pb-3 border-t border-gray-200">
            <Link href="/profile" className="flex items-center px-4 hover:bg-gray-50 py-2 rounded-lg transition-colors cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
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
                  {getRoleTranslation(profile?.role)}
                </div>
              </div>
            </Link>
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
