import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Mail, Lock, User, Phone, Briefcase, BookOpen, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [roleName, setRoleName] = useState('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Student specific
  const [studentId, setStudentId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [program, setProgram] = useState('B.Tech');
  const [courseName, setCourseName] = useState('Computer Science Engineering');

  // Staff specific
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload = {
      email,
      password,
      full_name: fullName,
      phone: phone || null,
      role_name: roleName,
    };

    if (roleName === 'student') {
      payload.student_id = studentId || undefined;
      payload.roll_number = rollNumber || undefined;
      payload.program = program;
      payload.course_name = courseName;
    } else if (roleName === 'staff' || roleName === 'hod') {
      payload.employee_id = employeeId || undefined;
      payload.designation = designation;
    }

    try {
      await register(payload);
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error.message);
      } else {
        setError('Registration failed. Please check your inputs and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-xl shadow-indigo-500/25 mb-3">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Join the KRMU Campus Intelligence Platform
          </p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection Tabs */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                {['student', 'staff', 'hod', 'admin'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleName(role)}
                    className={`py-2 text-xs font-semibold rounded-lg uppercase tracking-wider transition-all ${
                      roleName === role
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Sunny Sharma"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@krmu.edu.in"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl py-2.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Role-Specific Fields */}
            {roleName === 'student' && (
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-emerald-400 flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Student Profile Details</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Student ID (Optional)</label>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Roll Number</label>
                    <input
                      type="text"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      placeholder="2026CSE099"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Program</label>
                    <input
                      type="text"
                      value={program}
                      onChange={(e) => setProgram(e.target.value)}
                      placeholder="B.Tech"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Course Name</label>
                    <input
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="Computer Science Engineering"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {(roleName === 'staff' || roleName === 'hod') && (
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                <div className="text-xs font-semibold text-sky-400 flex items-center space-x-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Staff / HOD Details</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Employee ID (Optional)</label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="EMP-1001"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Designation</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="Assistant Professor"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition-all mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
