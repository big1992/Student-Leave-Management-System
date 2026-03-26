"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { ArrowLeft, Search, Plus, Edit2, Check, X, Shield, Lock, Power } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  faculty?: string;
  advisorId?: string;
  createdAt: any;
  isActive?: boolean;
};

export default function UsersManagementPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", department: "", faculty: "", advisorId: "", role: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [approvers, setApprovers] = useState<{id: string, name: string}[]>([]);

  // Password Reset State
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<{type: 'success'|'error', msg: string} | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const data = snap.docs.map(d => {
        const docData = d.data();
        return { 
          id: d.id, 
          ...docData,
          isActive: docData.isActive !== false // Defaults to true if undefined
        } as User;
      });
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setUsers(data);
      
      // Store Approvers list
      const fetchApprovers = data.filter(u => u.role === "Approver").map(u => ({ id: u.id, name: u.name }));
      setApprovers(fetchApprovers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                          (u.email?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "All" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      department: user.department || "",
      faculty: user.faculty || "",
      advisorId: user.advisorId || "",
      role: user.role || "Student",
      isActive: user.isActive !== false
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        name: editForm.name,
        department: editForm.department,
        faculty: editForm.faculty,
        role: editForm.role,
        isActive: editForm.isActive,
        ...(editForm.role === "Student" ? { advisorId: editForm.advisorId } : {})
      });
      
      setUsers(users.map(u => 
        u.id === editingUser.id 
          ? { ...u, name: editForm.name, department: editForm.department, faculty: editForm.faculty, advisorId: editForm.advisorId, role: editForm.role, isActive: editForm.isActive } 
          : u
      ));
      setEditingUser(null);
    } catch (err) {
      console.error("Failed to update user", err);
      alert("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user: User) => {
    const newStatus = !(user.isActive !== false);
    if (!confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} ${user.name}?`)) return;
    
    try {
      await updateDoc(doc(db, "users", user.id), { isActive: newStatus });
      setUsers(users.map(u => u.id === user.id ? { ...u, isActive: newStatus } : u));
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  const handleResetPassword = async () => {
    if (!resettingUser || !newPassword) return;
    if (newPassword.length < 6) {
      setResetStatus({ type: 'error', msg: "Password must be at least 6 characters" });
      return;
    }

    setSaving(true);
    setResetStatus(null);
    try {
      const response = await fetch("/api/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: resettingUser.id, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to reset password");

      setResetStatus({ type: 'success', msg: "Password successfully reset!" });
      setTimeout(() => {
        setResettingUser(null);
        setNewPassword("");
        setResetStatus(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setResetStatus({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["Admin"]}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToDashboard || "Back to Dashboard"}
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t.manageUsers || "Manage Users"}</h1>
              <p className="text-sm text-gray-500">{t.manageUsersDesc || "View, edit, or deactivate user accounts."}</p>
            </div>
          </div>
          
          <Link
            href="/admin/add-user"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.addNewUser || "Add New User"}
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="flex-shrink-0 h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-48 bg-gray-50"
          >
            <option value="All">All Roles</option>
            <option value="Student">Student</option>
            <option value="Approver">Approver</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No users found.</td></tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold">
                            {(user.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'Approver' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.department || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive !== false ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setResettingUser(user);
                              setNewPassword("");
                              setResetStatus(null);
                            }}
                            className="text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg transition-colors"
                            title="Reset Password"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditClick(user)}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => toggleUserStatus(user)}
                            className={`${user.isActive !== false ? 'text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100' : 'text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100'} p-2 rounded-lg transition-colors`}
                            title={user.isActive !== false ? "Deactivate User" : "Activate User"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-semibold text-gray-900">Edit User Details</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Read Only)</label>
                <input
                  type="email"
                  disabled
                  value={editingUser.email}
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
                <input
                  type="text"
                  value={editForm.faculty}
                  onChange={(e) => setEditForm({...editForm, faculty: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                />
              </div>
              {editForm.role === "Student" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Advisor</label>
                  <select
                    value={editForm.advisorId}
                    onChange={(e) => setEditForm({...editForm, advisorId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">-- No Advisor Assigned --</option>
                    {approvers.map(app => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="Student">Student</option>
                  <option value="Approver">Approver</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="isActiveToggle" className="text-sm font-medium text-gray-700">
                  Account is Active
                </label>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center min-w-[80px]"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-amber-50/50">
              <h3 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-600" />
                Reset Password
              </h3>
              <button onClick={() => setResettingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {resetStatus && (
                <div className={`p-4 rounded-xl text-sm ${resetStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {resetStatus.msg}
                </div>
              )}
              
              <div className="text-sm text-gray-600">
                Setting a new password for <span className="font-semibold text-gray-900">{resettingUser.name}</span> ({resettingUser.email}).
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-shadow"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setResettingUser(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleResetPassword}
                disabled={saving || !newPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center min-w-[80px]"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
