"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, User, Lock, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  
  // Profile State
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [faculty, setFaculty] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [approvers, setApprovers] = useState<{id: string, name: string, department: string}[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{type: 'success'|'error', msg: string} | null>(null);

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{type: 'success'|'error', msg: string} | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setDepartment(profile.department || "");
      setFaculty(profile.faculty || "");
      setAdvisorId(profile.advisorId || "");
    }
  }, [profile]);

  useEffect(() => {
    async function fetchApprovers() {
      if (profile?.role === "Student") {
        try {
          // Fetch any active user with role "Approver" or "Admin"
          const q = query(collection(db, "users"), where("role", "==", "Approver"));
          const snap = await getDocs(q);
          const list = snap.docs.map(d => ({
            id: d.id,
            name: d.data().name,
            department: d.data().department
          }));
          setApprovers(list);
        } catch (e) {
          console.error("Failed to fetch Approvers", e);
        }
      }
    }
    fetchApprovers();
  }, [profile?.role]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setProfileSaving(true);
    setProfileStatus(null);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name,
        department,
        faculty,
        ...(profile?.role === "Student" ? { advisorId } : {})
      });
      setProfileStatus({ type: 'success', msg: t.updateProfileSuccess || "Profile updated!" });
    } catch (error: any) {
      console.error(error);
      setProfileStatus({ type: 'error', msg: error.message });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', msg: t.passwordMismatch || "Passwords do not match." });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', msg: "Password should be at least 6 characters." });
      return;
    }

    setPasswordSaving(true);
    setPasswordStatus(null);

    try {
      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      
      setPasswordStatus({ type: 'success', msg: t.updateProfileSuccess || "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
         setPasswordStatus({ type: 'error', msg: "Incorrect current password." });
      } else {
         setPasswordStatus({ type: 'error', msg: error.message });
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToDashboard || "Back to Dashboard"}
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.profileSettings || "Profile Settings"}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Profile Details Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <User className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">{t.updateProfile || "Update Profile"}</h2>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              {profileStatus && (
                <div className={`p-4 rounded-xl text-sm flex items-center gap-2 ${profileStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {profileStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {profileStatus.msg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.emailAddress || "Email Address"}</label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ""}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  disabled
                  value={profile?.role || ""}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed outline-none uppercase text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.fullName || "Full Name"}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.faculty || "Faculty"}</label>
                <input
                  type="text"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.department || "Department"}</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>

              {profile?.role === "Student" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.advisor || "Advisor"}</label>
                  <select
                    value={advisorId}
                    onChange={(e) => setAdvisorId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow bg-white"
                  >
                    <option value="">{t.selectAdvisor || "-- Select Advisor --"}</option>
                    {approvers.map(app => (
                      <option key={app.id} value={app.id}>
                        {app.name} ({app.department || "Unknown Dept"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {profileSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="w-4 h-4" /> {t.save || "Save"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
              <Lock className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">{t.changePassword || "Change Password"}</h2>
            </div>
            
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passwordStatus && (
                <div className={`p-4 rounded-xl text-sm flex items-center gap-2 ${passwordStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {passwordStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {passwordStatus.msg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.currentPassword || "New Password"}</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.confirmPassword || "Confirm New Password"}</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
                >
                  {passwordSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    <span>{t.changePassword || "Change Password"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
