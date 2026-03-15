"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Plus, Clock, CheckCircle, XCircle, FileText, ChevronRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, differenceInDays } from "date-fns";
import { useRouter } from "next/navigation";

interface LeaveRequest {
  id: string;
  typeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
  studentId: string;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Added state for leave balances
  const [leaveBalances, setLeaveBalances] = useState<Record<string, Record<string, { used: number; max: number; name: string }>>>({});

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  useEffect(() => {
    if (!profile) return;

    // Fetch Leave Types
    const unsubTypes = onSnapshot(collection(db, "leaveTypes"), (snap) => {
      setLeaveTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    let q;
    if (profile.role === "Student") {
      q = query(
        collection(db, "leaveRequests"),
        where("studentId", "==", profile.id)
      );
    } else {
      // For Admin (all) and Approver (we fetch all and filter client side to avoid index necessity)
      q = collection(db, "leaveRequests");
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      })) as LeaveRequest[];

      // Sort client-side to avoid requiring multiple composite indexes in Firestore
      data.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        
        if (profile.role === "Approver") {
          return timeA - timeB; // Oldest first (asc)
        } else {
          return timeB - timeA; // Newest first (desc)
        }
      });

      setRequests(data);
      
      // Fetch names for unique student IDs
      const uniqueStudentIds = Array.from(new Set(data.map(req => req.studentId)));
      const fetchedNames: Record<string, string> = {};
      let needsUpdate = false;
      
      for (const sId of uniqueStudentIds) {
        // We only fetch if it's not already in state
        try {
          const userDoc = await getDoc(doc(db, "users", sId));
          if (userDoc.exists()) {
            fetchedNames[sId] = userDoc.data().name || sId;
            needsUpdate = true;
          }
        } catch (e) {
          console.error("Error fetching user name:", e);
        }
      }
      
      if (needsUpdate) {
        setUserNames(prev => ({ ...prev, ...fetchedNames }));
      }

      setLoading(false);
    }, (error) => {
      console.error("Error fetching requests:", error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubTypes();
    };
  }, [profile]);

  // Calculate leave balances whenever requests or leave types change
  useEffect(() => {
    if (!requests.length || !leaveTypes.length) return;

    const balances: Record<string, Record<string, { used: number; max: number; name: string }>> = {};

    // Only count approved data for balance
    const approvedRequests = requests.filter(req => req.status === "approved");

    // Initialize all student balances or at least the current profile's balances
    const studentIds = profile?.role === "Student" ? [profile.id] : Array.from(new Set(requests.map(r => r.studentId)));

    studentIds.forEach(sId => {
      balances[sId] = {};
      leaveTypes.forEach(type => {
        balances[sId][type.id] = {
          used: 0,
          max: type.maxDays || 0,
          name: language === 'th' ? (type.nameTh || type.name) : (type.nameEn || type.name)
        };
      });
    });

    approvedRequests.forEach(req => {
      if (!balances[req.studentId] || !balances[req.studentId][req.typeId]) return;
      
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      // add 1 because same day start and end is 1 day of leave
      const days = differenceInDays(end, start) + 1;
      
      balances[req.studentId][req.typeId].used += days;
    });

    setLeaveBalances(balances);
  }, [requests, leaveTypes, language, profile]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pending</span>;
    }
  };

  const getLeaveTypeName = (typeId: string) => {
    const typeObj = leaveTypes.find(tObj => tObj.id === typeId);
    if (!typeObj) {
      // Fallback for hardcoded types during early dev
      const types: Record<string, string> = { 
        sick: t.sickLeave, 
        personal: t.personalLeave, 
        activity: t.activityLeave 
      };
      return types[typeId] || typeId;
    }
    
    // Dynamic type using the language value from the component scope
    return language === 'th' ? (typeObj.nameTh || typeObj.name) : (typeObj.nameEn || typeObj.name);
  };

  const renderStudentDashboard = () => {
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.myLeaveRequests}</h1>
            <p className="text-gray-500 text-sm">{t.trackManage}</p>
          </div>
          <Link 
            href="/request" 
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-blue-200"
          >
            <Plus className="w-5 h-5" />
            {t.newRequest}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{t.pending}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? "-" : pending}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{t.approved}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? "-" : approved}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{t.rejected}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? "-" : rejected}</p>
            </div>
          </div>
        </div>

        {/* Leave Balances Section */}
        {profile?.id && leaveBalances[profile.id] && Object.keys(leaveBalances[profile.id]).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6">
            <div className="px-6 py-5 border-b border-gray-50 bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                {t.leaveBalance}
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(leaveBalances[profile.id]).map(([typeId, balance]) => {
                const remaining = Math.max(0, balance.max - balance.used);
                const percentage = balance.max > 0 ? Math.min(100, Math.round((balance.used / balance.max) * 100)) : 0;
                let colorClass = "bg-blue-600";
                if (percentage >= 80) colorClass = "bg-red-500";
                else if (percentage >= 50) colorClass = "bg-amber-500";
                
                return (
                  <div key={typeId} className="border border-gray-100 rounded-xl p-4 bg-gray-50/30">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{balance.name}</span>
                      <span className="text-sm font-semibold text-gray-600">{remaining} / {balance.max}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-right">{balance.used} used</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              {t.recentApplications}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.type}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.duration}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.submitted}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.status}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading requests...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No leave requests found.</td></tr>
                ) : (
                  requests.map((request) => (
                    <tr 
                      key={request.id} 
                      onClick={() => router.push(`/request/${request.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{getLeaveTypeName(request.typeId)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {request.createdAt ? format(request.createdAt.toDate(), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderApproverDashboard = () => {
    const filteredRequests = requests.filter(req => {
      if (activeTab === "pending") return req.status === "pending";
      return req.status !== "pending"; // History shows approved/rejected
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.pendingApprovals}</h1>
            <p className="text-gray-500 text-sm">{t.reviewRequests}</p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "pending"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t.pendingTab}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "history"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {t.historyTab}
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.studentName}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.leaveInfo}</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.leaveBalance}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.date}</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.action}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">{t.loading}</td></tr>
                ) : filteredRequests.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">{t.allCaughtUp}</td></tr>
                ) : (
                  filteredRequests.map((request) => {
                    const studentBalance = leaveBalances[request.studentId]?.[request.typeId];
                    const remaining = studentBalance ? Math.max(0, studentBalance.max - studentBalance.used) : 0;
                    const balanceText = studentBalance ? `${remaining} / ${studentBalance.max}` : "-";

                    return (
                      <tr 
                        key={request.id} 
                        onClick={() => router.push(`/request/${request.id}`)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{userNames[request.studentId] || "Loading..."}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{getLeaveTypeName(request.typeId)}</div>
                          <div className="text-xs text-gray-500 line-clamp-1 mt-0.5 max-w-xs">{request.reason}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            {balanceText}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {activeTab === 'history' && getStatusBadge(request.status)}
                            <Link href={`/request/${request.id}`} className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 w-fit" onClick={(e) => e.stopPropagation()}>
                              {t.review} <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminDashboard = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.sysAdmin}</h1>
        <p className="text-gray-500 text-sm">{t.manageAdmin}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Manage Users Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between items-start h-full">
          <div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{t.manageUsers}</h3>
            <p className="text-sm text-gray-500 mb-6">{t.manageUsersDesc}</p>
          </div>
          <Link href="/admin/add-user" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50/50 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors w-full justify-center">
            {t.addNewUser}
          </Link>
        </div>

        {/* Leave Types Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between items-start h-full">
          <div>
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
              <Settings2 className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{t.leaveTypes}</h3>
            <p className="text-sm text-gray-500 mb-6">{t.leaveTypesDesc}</p>
          </div>
          <Link href="/admin" className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-800 bg-purple-50/50 hover:bg-purple-50 px-4 py-2 rounded-lg transition-colors w-full justify-center">
            {t.sysSettings}
          </Link>
        </div>

        {/* Reports Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between items-start h-full opacity-60">
          <div>
            <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{t.reports}</h3>
            <p className="text-sm text-gray-500 mb-6">{t.reportsDesc}</p>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <ProtectedRoute>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!profile ? (
          <div className="flex justify-center p-12">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="w-32 h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : (
          <>
            {profile.role === "Student" && renderStudentDashboard()}
            {profile.role === "Approver" && renderApproverDashboard()}
            {profile.role === "Admin" && renderAdminDashboard()}
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
