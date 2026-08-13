import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap, User, Mail, Phone, BookOpen, Building, CheckCircle2,
  Edit3, Save, Loader2, AlertCircle, Sparkles, Hash, Home
} from 'lucide-react';

export const StudentProfile = () => {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [semester, setSemester] = useState(1);
  const [program, setProgram] = useState('');
  const [courseName, setCourseName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/students/me');
      const data = res.data;
      setProfile(data);
      setFullName(data.user?.full_name || '');
      setPhone(data.user?.phone || '');
      setRollNumber(data.roll_number || '');
      setSemester(data.semester || 1);
      setProgram(data.program || '');
      setCourseName(data.course_name || '');
      setRoomNumber(data.room_number || '');
    } catch (err) {
      console.error('Failed to load student profile:', err);
      setError(err.response?.data?.error?.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res = await api.put('/students/me', {
        full_name: fullName,
        phone: phone || null,
        roll_number: rollNumber || null,
        semester: parseInt(semester),
        program,
        course_name: courseName,
        room_number: roomNumber || null,
      });

      setProfile(res.data);
      if (user) {
        const updatedUser = { ...user, full_name: fullName, phone };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      setMessage('Profile details updated successfully!');
      setIsEditing(false);
    } catch (err) {
      console.error('Save profile error:', err);
      setError(err.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center space-x-3 text-slate-400">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span>Loading Student Credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Profile Card Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950/40 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-emerald-500/20">
                <GraduationCap className="w-9 h-9" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    {profile?.student_id}
                  </span>
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified Student</span>
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold text-white mt-1">{profile?.user?.full_name}</h1>
                <p className="text-slate-400 text-xs">{profile?.user?.email}</p>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-2 transition-all self-start sm:self-auto"
            >
              <Edit3 className="w-4 h-4 text-indigo-400" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <span>{error}</span>
          </div>
        )}

        {/* Profile Details Form / Grid */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <h2 className="text-base font-bold text-slate-200 flex items-center space-x-2 border-b border-slate-800 pb-3">
              <User className="w-5 h-5 text-indigo-400" />
              <span>Academic & Personal Credentials</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Permanent ID */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Student ID (Issued)</label>
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 font-mono text-xs font-bold text-emerald-400">
                  {profile?.student_id}
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</label>
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-medium text-slate-200">
                  {profile?.department_name} ({profile?.department_code})
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100"
                  />
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200">
                    {profile?.user?.full_name}
                  </div>
                )}
              </div>

              {/* Roll Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Roll Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100 font-mono"
                  />
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs font-mono text-slate-200">
                    {profile?.roll_number || 'N/A'}
                  </div>
                )}
              </div>

              {/* Program */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Program</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100"
                  />
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200">
                    {profile?.program}
                  </div>
                )}
              </div>

              {/* Course Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Course Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100"
                  />
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200">
                    {profile?.course_name}
                  </div>
                )}
              </div>

              {/* Semester */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Semester</label>
                {isEditing ? (
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100"
                  />
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200">
                    Semester {profile?.semester}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100"
                  />
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200">
                    {profile?.user?.phone || 'Not provided'}
                  </div>
                )}
              </div>

              {/* Room Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hostel Room Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="304-B"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100"
                  />
                ) : (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200">
                    {profile?.room_number || 'Day Scholar'}
                  </div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-indigo-600/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
};
