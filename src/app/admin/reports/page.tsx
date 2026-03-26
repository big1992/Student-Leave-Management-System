"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { ArrowLeft, Download, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [leaveTypes, setLeaveTypes] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Users
        const userSnap = await getDocs(collection(db, "users"));
        const userMap: Record<string, any> = {};
        userSnap.docs.forEach(doc => {
          userMap[doc.id] = doc.data();
        });
        setUsers(userMap);

        // Fetch Leave Types
        const typeSnap = await getDocs(collection(db, "leaveTypes"));
        const typeMap: Record<string, string> = {};
        typeSnap.docs.forEach(doc => {
          typeMap[doc.id] = doc.data().nameEn || doc.data().name; // default to EN for CSV internal format, we can map later
        });
        setLeaveTypes(typeMap);

        // Fetch Leave Requests
        const reqSnap = await getDocs(collection(db, "leaveRequests"));
        const reqs = reqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort by date created desc
        reqs.sort((a: any, b: any) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });
        
        setRequests(reqs);
      } catch (err) {
        console.error("Error fetching report data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalReqs = requests.length;
  const approvedReqs = requests.filter(r => r.status === "approved").length;
  const rejectedReqs = requests.filter(r => r.status === "rejected").length;
  const pendingReqs = requests.filter(r => r.status === "pending").length;
  const cancelledReqs = requests.filter(r => r.status === "cancelled").length;

  const handleDownloadCSV = () => {
    if (requests.length === 0) return;

    const headers = ["Request ID", "Student Name", "Department", "Leave Type", "Start Date", "End Date", "Status", "Submitted At"];
    const rows = requests.map(r => {
      const student = users[r.studentId] || { name: "Unknown", department: "Unknown" };
      const typeName = leaveTypes[r.typeId] || r.typeId;
      const createdAt = r.createdAt ? new Date(r.createdAt.toMillis()).toLocaleString() : "Unknown";
      
      return [
        r.id,
        `"${student.name}"`,
        `"${student.department}"`,
        `"${typeName}"`,
        r.startDate,
        r.endDate,
        r.status,
        `"${createdAt}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leave_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ProtectedRoute allowedRoles={["Admin"]}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToDashboard || "Back to Dashboard"}
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t.reports || "Reports & Statistics"}</h1>
              <p className="text-sm text-gray-500">{t.reportsDesc || "Export leave statistics and logs."}</p>
            </div>
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={loading || requests.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export to CSV
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading statistics...</div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{totalReqs}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">{approvedReqs}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-gray-900">{rejectedReqs}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingReqs}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Cancelled</p>
                  <p className="text-2xl font-bold text-gray-900">{cancelledReqs}</p>
                </div>
              </div>
            </div>

            {/* Recent Requests Table preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-semibold text-gray-900">Recent Leave Requests Preview</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {requests.slice(0, 10).map((req) => (
                      <tr key={req.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {users[req.studentId]?.name || "Unknown"}
                          <div className="text-xs text-gray-500 font-normal">{users[req.studentId]?.department}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {leaveTypes[req.typeId] || req.typeId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {req.startDate} to {req.endDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                            req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                            req.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {requests.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          No leave requests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {requests.length > 10 && (
              <p className="text-center text-sm text-gray-500 mt-4">Showing top 10 recent requests. Export to CSV to see all {requests.length} records.</p>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
