"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { ArrowLeft, Check, X, Paperclip, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LeaveRequest {
  id: string;
  studentId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
}

interface Log {
  id: string;
  action: string;
  comment: string;
  timestamp: any;
  actorId: string;
}

export default function RequestDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [student, setStudent] = useState<any>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Listen to leave types
    const unsubTypes = onSnapshot(collection(db, "leaveTypes"), (snap) => {
      setLeaveTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    if (!profile || !unwrappedParams.id) return () => unsubTypes();

    const fetchDetails = async () => {
      try {
        const querySnapshot = await getDoc(doc(db, "leaveRequests", unwrappedParams.id));
        if (querySnapshot.exists()) {
          const reqData = { id: querySnapshot.id, ...querySnapshot.data() } as LeaveRequest;
          setRequest(reqData);

          // Fetch student details
          const stDoc = await getDoc(doc(db, "users", reqData.studentId));
          if (stDoc.exists()) setStudent(stDoc.data());
        }
      } catch (err) {
        console.error("Error fetching request:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();

    // Listen to logs
    const qLogs = query(collection(db, "logs"), where("requestId", "==", unwrappedParams.id), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Log));
    });

    return () => {
      unsubLogs();
      unsubTypes();
    };
  }, [unwrappedParams.id, profile]);

  const handleAction = async (actionType: "approved" | "rejected") => {
    if (!profile || !request) return;
    if (actionType === "rejected" && !comment.trim()) {
      setError(t.commentPlaceholder);
      return;
    }
    
    setProcessing(true);
    setError("");

    try {
      // 1. Update Request Status
      await updateDoc(doc(db, "leaveRequests", request.id), {
        status: actionType,
        updatedAt: serverTimestamp(),
        approverId: profile.id
      });

      // 2. Add Action Log
      await addDoc(collection(db, "logs"), {
        requestId: request.id,
        approverId: profile.id,
        action: actionType,
        comment: comment.trim() || "No comment provided.",
        timestamp: serverTimestamp()
      });

      // Redirect to Dashboard after action
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setError("Failed to process action. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const getLeaveTypeName = (typeId: string) => {
    const typeObj = leaveTypes.find(tObj => tObj.id === typeId);
    if (!typeObj) {
      const types: Record<string, string> = { 
        sick: t.sickLeave, 
        personal: t.personalLeave, 
        activity: t.activityLeave 
      };
      return types[typeId] || typeId;
    }
    return language === 'th' ? (typeObj.nameTh || typeObj.name) : (typeObj.nameEn || typeObj.name);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!request) {
    return (
      <ProtectedRoute>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center text-gray-500">
          {t.reqNotFound}
        </div>
      </ProtectedRoute>
    );
  }

  // Access control
  if (profile?.role === "Student" && request.studentId !== profile.id) {
    return (
      <ProtectedRoute>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center text-red-500 font-medium">
          {t.noPermission}
        </div>
      </ProtectedRoute>
    );
  }

  const isPending = request.status === "pending";
  const canApprove = profile?.role === "Approver" || profile?.role === "Admin";

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToDashboard}
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{getLeaveTypeName(request.typeId)}</h1>
                <p className="text-sm text-gray-500">
                  {request.createdAt ? format(request.createdAt.toDate(), "MMM d, yyyy") : "Unknown"}
                </p>
              </div>
            </div>
            <div>
              {request.status === "approved" && <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200"><CheckCircleIcon className="w-4 h-4 mr-1"/> {t.approve}</span>}
              {request.status === "rejected" && <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200"><XCircleIcon className="w-4 h-4 mr-1"/> {t.reject}</span>}
              {request.status === "pending" && <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-200"><Clock className="w-4 h-4 mr-1"/> {t.pendingReview}</span>}
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.applicantInfo}</h3>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="font-medium text-gray-900">{student?.name || "Unknown Student"}</p>
                  <p className="text-sm text-gray-500">{student?.department || "N/A"}</p>
                  <p className="text-sm text-gray-500">{student?.email}</p>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.leaveDetails}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">{t.startDate}</p>
                      <p className="font-medium text-gray-900">{format(new Date(request.startDate), "MMM d, yyyy")}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">{t.endDate}</p>
                      <p className="font-medium text-gray-900">{format(new Date(request.endDate), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">{t.reasonForLeave}</p>
                    <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{request.reason}</p>
                  </div>
                  {request.attachmentUrl && (
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Paperclip className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.supportingDoc}</span>
                      </div>
                      <a href={request.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 pr-2">
                        {t.viewFile}
                      </a>
                    </div>
                  )}
                </div>
              </section>

              {!isPending && logs.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.approverFeedback}</h3>
                  <div className={`rounded-xl p-4 border ${request.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <p className={`text-sm ${request.status === 'approved' ? 'text-green-800' : 'text-red-800'} whitespace-pre-wrap leading-relaxed`}>
                      {logs[0].comment || "No comment provided."}
                    </p>
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              {/* Approver Action Panel */}
              {isPending && canApprove && (
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-900">{t.reviewAction}</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5" htmlFor="comment">
                        {t.commentFeedback}
                      </label>
                      <textarea
                        id="comment"
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm text-gray-900 resize-none"
                        placeholder={t.commentPlaceholder}
                      ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleAction("rejected")}
                        disabled={processing}
                        className="flex items-center justify-center gap-1 px-4 py-2 bg-white border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> {t.reject}
                      </button>
                      <button
                        onClick={() => handleAction("approved")}
                        disabled={processing}
                        className="flex items-center justify-center gap-1 px-4 py-2 bg-green-600 border border-transparent text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> {t.approve}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Action History / Logs */}
              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{t.activityTimeline}</h3>
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">{t.noActivityYet}</p>
                ) : (
                  <div className="space-y-4">
                    {logs.map((log) => (
                      <div key={log.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className={`flex flex-shrink-0 items-center justify-center w-10 h-10 rounded-full ${log.action === 'approved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {log.action === 'approved' ? <Check className="w-5 h-5"/> : <X className="w-5 h-5"/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 text-sm">{log.action === 'approved' ? t.approve : t.reject}</span>
                            <time className="text-xs font-medium text-gray-500 whitespace-nowrap">
                              {log.timestamp ? format(log.timestamp.toDate(), "MMM d, HH:mm") : 'Now'}
                            </time>
                          </div>
                          <p className="text-sm text-gray-600 break-words">{log.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

const CheckCircleIcon = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
const XCircleIcon = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
