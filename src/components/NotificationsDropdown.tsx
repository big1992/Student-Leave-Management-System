"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, orderBy, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Bell, Check, Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  userId: string;
  type: "request_submitted" | "request_approved" | "request_rejected";
  messageEn: string;
  messageTh: string;
  requestId: string;
  isRead: boolean;
  createdAt: any;
}

export default function NotificationsDropdown() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", profile.id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      let unread = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data() as Notification;
        notifs.push({ id: doc.id, ...data });
        if (!data.isRead) unread++;
      });
      
      setNotifications(notifs);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        const batch = writeBatch(db);
        const ref = doc(db, "notifications", notification.id);
        batch.update(ref, { isRead: true });
        await batch.commit();
      } catch (err) {
        console.error("Failed to mark as read", err);
      }
    }
    setIsOpen(false);
    router.push(`/request/${notification.requestId}`);
  };

  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.isRead) {
          const ref = doc(db, "notifications", n.id);
          batch.update(ref, { isRead: true });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "";
    return formatDistanceToNow(timestamp.toDate(), { 
      addSuffix: true,
      locale: language === 'th' ? th : enUS 
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 transform origin-top-right transition-all">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              {language === 'th' ? "การแจ้งเตือน" : "Notifications"}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {language === 'th' ? "อ่านทั้งหมด" : "Mark all as read"}
              </button>
            )}
          </div>

          <div className="max-h-[min(500px,80vh)] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 flex flex-col items-center">
                <Bell className="w-8 h-8 text-gray-300 mb-2" />
                {language === 'th' ? "ไม่มีการแจ้งเตือน" : "No notifications yet"}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleMarkAsRead(notification)}
                    className={`px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex gap-3 ${
                      !notification.isRead ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {notification.type === 'request_approved' && (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                      {notification.type === 'request_rejected' && (
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </div>
                      )}
                      {notification.type === 'request_submitted' && (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <Clock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-gray-900 whitespace-pre-wrap ${!notification.isRead ? "font-semibold" : "font-medium"}`}>
                        {language === 'th' ? notification.messageTh : notification.messageEn}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-600 self-center flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-500">
              {language === 'th' ? "การแจ้งเตือนล่าสุด" : "Recent Notifications"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
