"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Plus, Settings2, Trash2, Edit2, X, Check } from "lucide-react";
import Link from "next/link";

interface LeaveType {
  id: string;
  name: string; // legacy fallback
  nameEn: string;
  nameTh: string;
  maxDays: number;
}

export default function AdminSettings() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTypeNameEn, setNewTypeNameEn] = useState("");
  const [newTypeNameTh, setNewTypeNameTh] = useState("");
  const [newTypeMaxDays, setNewTypeMaxDays] = useState(0);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameEn, setEditNameEn] = useState("");
  const [editNameTh, setEditNameTh] = useState("");
  const [editMaxDays, setEditMaxDays] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "leaveTypes"), (snap) => {
      setLeaveTypes(snap.docs.map(d => ({ id: d.id, ...d.data() }) as LeaveType));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeNameEn.trim() || !newTypeNameTh.trim()) return;
    try {
      await addDoc(collection(db, "leaveTypes"), {
        name: newTypeNameEn.trim(), 
        nameEn: newTypeNameEn.trim(),
        nameTh: newTypeNameTh.trim(),
        maxDays: Number(newTypeMaxDays)
      });
      setNewTypeNameEn("");
      setNewTypeNameTh("");
      setNewTypeMaxDays(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEdit = (type: LeaveType) => {
    setEditingId(type.id);
    setEditNameEn(type.nameEn || type.name || "");
    setEditNameTh(type.nameTh || type.name || "");
    setEditMaxDays(type.maxDays);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editNameEn.trim() || !editNameTh.trim()) return;
    try {
      await updateDoc(doc(db, "leaveTypes", id), {
        name: editNameEn.trim(), // keep legacy field updated too
        nameEn: editNameEn.trim(),
        nameTh: editNameTh.trim(),
        maxDays: Number(editMaxDays)
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this leave type?")) {
      await deleteDoc(doc(db, "leaveTypes", id));
    }
  };

  return (
    <ProtectedRoute allowedRoles={["Admin"]}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t.backToDashboard}
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t.sysSettingsTitle}</h1>
              <p className="text-sm text-gray-500">{t.manageLeaveTypesDesc}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 border border-gray-100 bg-white rounded-2xl shadow-sm p-6 max-h-fit">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-gray-400" />
              {t.addLeaveType}
            </h2>
            <form onSubmit={handleAddType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="nameEn">Type Name (English)</label>
                <input
                  id="nameEn"
                  required
                  value={newTypeNameEn}
                  onChange={(e) => setNewTypeNameEn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Sick Leave"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="nameTh">Type Name (Thai)</label>
                <input
                  id="nameTh"
                  required
                  value={newTypeNameTh}
                  onChange={(e) => setNewTypeNameTh(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., ลาป่วย"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="maxDays">{t.maxDays}</label>
                <input
                  id="maxDays"
                  type="number"
                  required
                  min={1}
                  value={newTypeMaxDays}
                  onChange={(e) => setNewTypeMaxDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                {t.addTypeBtn}
              </button>
            </form>
          </div>

          <div className="md:col-span-2 border border-gray-100 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">{t.configuredTypes}</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {loading && <li className="p-6 text-center text-gray-500">{t.loading}</li>}
              {!loading && leaveTypes.length === 0 && <li className="p-6 text-center text-gray-500">{t.noTypesConfigured}</li>}
              {leaveTypes.map((type) => (
                <li key={type.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors">
                  {editingId === type.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">English</label>
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={(e) => setEditNameEn(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Thai</label>
                          <input
                            type="text"
                            value={editNameTh}
                            onChange={(e) => setEditNameTh(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t.maxDays}</label>
                          <input
                            type="number"
                            min={1}
                            value={editMaxDays}
                            onChange={(e) => setEditMaxDays(Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <X className="w-4 h-4" /> {t.cancel}
                        </button>
                        <button
                          onClick={() => handleSaveEdit(type.id)}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" /> {t.save}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {language === 'th' ? (type.nameTh || type.name) : (type.nameEn || type.name)}
                        </p>
                        <p className="text-sm text-gray-500">Max {type.maxDays} days</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(type)}
                          className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t.edit}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(type.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
