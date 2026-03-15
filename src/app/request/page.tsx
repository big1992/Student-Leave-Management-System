"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { CalendarIcon, Paperclip, ArrowLeft, Send, Clock, FilePlus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";

// Define the form inputs
type LeaveRequestForm = {
  typeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  file: FileList;
};

export default function RequestFormPage() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();
  
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "leaveTypes"), (snap) => {
      setLeaveTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors }, watch } = useForm<LeaveRequestForm>();

  const onSubmit = async (data: LeaveRequestForm) => {
    if (!profile) return;
    setIsSubmitting(true);
    setError("");

    try {
      let attachmentUrl = null;

      // Ensure we have a valid file
      if (data.file && data.file.length > 0) {
        const file = data.file[0];
        
        // Very basic validation matching PDPA ideas — only image/pdf & size limit
        if (file.size > 5 * 1024 * 1024) throw new Error("File size must be less than 5MB");
        
        const storageRef = ref(storage, `attachments/${profile.id}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        attachmentUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, "leaveRequests"), {
        studentId: profile.id,
        typeId: data.typeId, // E.g. "sick", "personal"
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        attachmentUrl,
        status: "pending", // pending, approved, rejected
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/?success=true");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while submitting the request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["Student"]}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToDashboard}
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 text-white relative overflow-hidden">
            {/* Background design */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative z-10 flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-inner">
                <CalendarIcon className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t.newLeaveRequest}</h1>
                <p className="text-blue-100 text-sm mt-1">{t.submitLeaveApp}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="typeId">
                  {t.leaveType} <span className="text-red-500">*</span>
                </label>
                <select
                  id="typeId"
                  {...register("typeId", { required: "Please select a leave type" })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-900"
                >
                  <option value="">{t.selectLeaveType}</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {language === 'th' ? (type.nameTh || type.name) : (type.nameEn || type.name)}
                  </option>
                ))}
              </select>
              {errors.typeId && <p className="mt-1 text-sm text-red-600">{errors.typeId.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="startDate">
                    {t.startDate} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    {...register("startDate", { required: "Start date is required" })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-900"
                  />
                  {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="endDate">
                    {t.endDate} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    {...register("endDate", { required: "End date is required" })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-900"
                  />
                  {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="reason">
                  {t.reasonForLeave} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  rows={4}
                  {...register("reason", { 
                    required: "Please provide a detailed reason",
                    minLength: { value: 10, message: "Reason must be at least 10 characters long" }
                  })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-900 resize-none"
                  placeholder={t.reasonPlaceholder}
                ></textarea>
                {errors.reason && <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>}
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t.supportingDoc}
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="space-y-1 text-center">
                    <Paperclip className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex justify-center text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-transparent rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>{t.uploadFile}</span>
                        <input id="file-upload" type="file" className="sr-only" {...register("file")} accept=".jpg,.jpeg,.png,.pdf" />
                      </label>
                      <p className="pl-1">{t.dragAndDrop}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {t.fileGuidelines}
                    </p>
                    {watch("file") && watch("file").length > 0 && (
                      <p className="text-sm font-medium text-green-600 mt-2 bg-green-50 py-1 px-3 rounded-full inline-block">
                        {watch("file")[0].name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-xl shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t.submitRequest}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
