"use client";
import { useEffect, useState } from "react";
import { 
  Plus, Pencil, Power, KeyRound, Trash2, History, 
  LogIn, LogOut, User as UserIcon, Mail, Phone,
  Shield, Calendar, X, CheckCircle, AlertCircle, Clock 
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { format, formatDistanceToNow } from "date-fns";

type User = { 
  id: string; 
  name: string; 
  email: string; 
  phone?: string | null; 
  role: string; 
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type LoginHistory = {
  id: string;
  userId: string;
  loginTime: string;
  logoutTime: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

const ROLES = ["ADMIN", "MANAGER", "CASHIER"];

// Helper function to get role badge color
const getRoleColor = (role: string) => {
  switch(role) {
    case "ADMIN": return "bg-purple-100 text-purple-700 border-purple-200";
    case "MANAGER": return "bg-blue-100 text-blue-700 border-blue-200";
    case "CASHIER": return "bg-green-100 text-green-700 border-green-200";
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ name: "", email: "", phone: "", role: "CASHIER", password: "" });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pwOpen, setPwOpen] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error loading users:", error);
      setError("Failed to load users");
    }
  }

  async function loadHistory(userId?: string) {
    try {
      const url = userId ? `/api/auth/login-history?userId=${userId}` : "/api/auth/login-history";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setLoginHistory(data.history || []);
    } catch (error) {
      console.error("Error loading history:", error);
      setError("Failed to load login history");
    }
  }

  async function loadCurrentUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  }

  useEffect(() => { 
    load();
    loadCurrentUser();
  }, []);

  // Show success/error messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Create User
  async function save() {
    if (!form.name || !form.email || !form.password) { 
      setError("Name, email, and password are required");
      return; 
    }
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/users", { 
        method: "POST", 
        headers: { "content-type": "application/json" }, 
        body: JSON.stringify(form) 
      });
      const data = await r.json();
      if (!r.ok) { 
        setError(data.error || "Failed to create user"); 
        return; 
      }
      setOpen(false); 
      setForm({ name: "", email: "", phone: "", role: "CASHIER", password: "" }); 
      setSuccess("User created successfully!");
      await load();
    } catch (error) {
      setError("Failed to create user");
    } finally {
      setIsLoading(false);
    }
  }

  // Update User
  async function updateUser() {
    if (!editingUser) return;
    if (!editingUser.name || !editingUser.email) { 
      setError("Name and email are required"); 
      return; 
    }
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/users/${editingUser.id}`, { 
        method: "PATCH", 
        headers: { "content-type": "application/json" }, 
        body: JSON.stringify({ 
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone,
          role: editingUser.role,
        }) 
      });
      const data = await r.json();
      if (!r.ok) { 
        setError(data.error || "Failed to update user"); 
        return; 
      }
      setEditOpen(false); 
      setEditingUser(null); 
      setSuccess("User updated successfully!");
      await load();
    } catch (error) {
      setError("Failed to update user");
    } finally {
      setIsLoading(false);
    }
  }

  // Delete User
  async function deleteUser(id: string) {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/users/${id}`, { 
        method: "DELETE",
        headers: { "content-type": "application/json" }
      });
      const data = await r.json();
      if (!r.ok) { 
        setError(data.error || "Failed to delete user"); 
        return; 
      }
      setDeleteConfirm(null);
      setSuccess("User deleted successfully!");
      await load();
    } catch (error: any) {
      setError(error.message || "Failed to delete user");
    } finally {
      setIsLoading(false);
    }
  }

  // Toggle Active Status
  async function toggle(u: User) {
    try {
      const r = await fetch(`/api/users/${u.id}`, { 
        method: "PATCH", 
        headers: { "content-type": "application/json" }, 
        body: JSON.stringify({ active: !u.active }) 
      });
      if (!r.ok) throw new Error("Failed to update status");
      await load();
    } catch (error) {
      setError("Failed to update user status");
    }
  }

  // Change Role
  async function changeRole(u: User, role: string) {
    try {
      const r = await fetch(`/api/users/${u.id}`, { 
        method: "PATCH", 
        headers: { "content-type": "application/json" }, 
        body: JSON.stringify({ role }) 
      });
      if (!r.ok) throw new Error("Failed to update role");
      await load();
    } catch (error) {
      setError("Failed to update role");
    }
  }

  // Reset Password
  async function resetPw() {
    if (!pwOpen || !newPw) return;
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/users/${pwOpen}`, { 
        method: "PATCH", 
        headers: { "content-type": "application/json" }, 
        body: JSON.stringify({ password: newPw }) 
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }
      setPwOpen(null); 
      setNewPw("");
      setSuccess("Password reset successfully!");
    } catch (error) {
      setError("Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  }

  // Open History
  function openHistory(userId: string) {
    setSelectedUserId(userId);
    loadHistory(userId);
    setHistoryOpen(true);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss");
    } catch {
      return dateStr;
    }
  }

  // Get user's current login status (active session)
  function getUserLoginStatus(userId: string): { isLoggedIn: boolean; loginTime?: string } {
    const activeSession = loginHistory.find(h => h.userId === userId && h.logoutTime === null);
    if (activeSession) {
      return { 
        isLoggedIn: true, 
        loginTime: activeSession.loginTime 
      };
    }
    return { isLoggedIn: false };
  }

  // Get session duration
  function getSessionDuration(loginTime: string): string {
    try {
      return formatDistanceToNow(new Date(loginTime), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <UserIcon size={24} className="text-brand-600" />
          Users Management
        </h1>
        <button className="btn btn-primary" onClick={() => setOpen(true)} disabled={isLoading}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-emerald-700">
          <CheckCircle size={18} />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Login Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const { isLoggedIn, loginTime } = getUserLoginStatus(u.id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{u.name}</div>
                          {u.id === currentUserId && (
                            <span className="text-[10px] text-brand-600 font-medium">(You)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{u.email}</td>
                    <td className="text-sm">{u.phone || "-"}</td>
                    <td>
                      <select 
                        className="select py-1 text-xs" 
                        value={u.role} 
                        onChange={(e) => changeRole(u, e.target.value)}
                        disabled={u.id === currentUserId}
                      >
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <button 
                        onClick={() => toggle(u)} 
                        className={`badge ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"} cursor-pointer hover:opacity-80`}
                      >
                        <Power size={11} className="inline mr-1" /> 
                        {u.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>
                      {isLoggedIn ? (
                        <div className="flex flex-col">
                          <span className="badge bg-green-100 text-green-700">
                            <LogIn size={11} className="inline mr-1" /> Logged In
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            since {getSessionDuration(loginTime!)}
                          </span>
                        </div>
                      ) : (
                        <span className="badge bg-slate-200 text-slate-600">
                          <LogOut size={11} className="inline mr-1" /> Logged Out
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-slate-500">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit Button */}
                        <button 
                          className="btn btn-ghost p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" 
                          onClick={() => {
                            setEditingUser(u);
                            setEditOpen(true);
                          }}
                          disabled={isLoading}
                          title="Edit user"
                        >
                          <Pencil size={14} />
                        </button>
                        
                        {/* History Button */}
                        <button 
                          className="btn btn-ghost p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg" 
                          onClick={() => openHistory(u.id)}
                          disabled={isLoading}
                          title="View login history"
                        >
                          <History size={14} />
                        </button>
                        
                        {/* Reset Password Button */}
                        <button 
                          className="btn btn-ghost p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" 
                          onClick={() => setPwOpen(u.id)}
                          disabled={isLoading}
                          title="Reset password"
                        >
                          <KeyRound size={14} />
                        </button>
                        
                        {/* Delete Button */}
                        <button 
                          className="btn btn-ghost p-1.5 text-red-600 hover:bg-red-50 rounded-lg" 
                          onClick={() => setDeleteConfirm(u.id)}
                          disabled={isLoading || u.id === currentUserId}
                          title={u.id === currentUserId ? "Cannot delete your own account" : "Delete user"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-8">
                    <UserIcon size={32} className="mx-auto mb-2 text-slate-300" />
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add New User"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create User"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label><span className="label">Full Name *</span>
            <input className="input" placeholder="Enter full name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
          </label>
          <label><span className="label">Email Address *</span>
            <input className="input" type="email" placeholder="Enter email address" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
          </label>
          <label><span className="label">Phone Number</span>
            <input className="input" placeholder="Enter phone number" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
          </label>
          <label><span className="label">Role</span>
            <select className="select" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label><span className="label">Password *</span>
            <input type="password" className="input" placeholder="Enter password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
          </label>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit User"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={updateUser} disabled={isLoading}>
              {isLoading ? "Updating..." : "Update User"}
            </button>
          </>
        }
      >
        {editingUser && (
          <div className="space-y-3">
            <label><span className="label">Full Name *</span>
              <input className="input" value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} />
            </label>
            <label><span className="label">Email Address *</span>
              <input className="input" type="email" value={editingUser.email} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} />
            </label>
            <label><span className="label">Phone Number</span>
              <input className="input" value={editingUser.phone || ""} onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})} />
            </label>
            <label><span className="label">Role</span>
              <select className="select" value={editingUser.role} onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
              <div className="flex items-center gap-2">
                <Calendar size={12} /> Created: {formatDate(editingUser.createdAt)}
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} /> Last Updated: {formatDate(editingUser.updatedAt)}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!pwOpen} onClose={() => setPwOpen(null)} title="Reset Password"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPwOpen(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={resetPw} disabled={isLoading}>
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Enter a new password for this user.</p>
          <label><span className="label">New Password</span>
            <input type="password" className="input" placeholder="Enter new password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          </label>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete User"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={() => deleteUser(deleteConfirm!)} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete Permanently"}
            </button>
          </>
        }
      >
        <div className="py-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={32} className="text-red-600" />
          </div>
          <p className="text-slate-700 font-medium">Are you sure you want to delete this user?</p>
          <p className="text-sm text-slate-500 mt-2">This action cannot be undone. All associated data will be removed.</p>
        </div>
      </Modal>

      {/* Login History Modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Login History" size="lg"
        footer={
          <button className="btn btn-secondary" onClick={() => setHistoryOpen(false)}>Close</button>
        }
      >
        <div className="max-h-[450px] overflow-y-auto">
          {selectedUserId && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
              <span className="font-semibold">User:</span> {loginHistory.length > 0 ? loginHistory[0]?.user?.name || "Unknown" : "Loading..."}
            </div>
          )}
          
          {loginHistory.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <History size={48} className="mx-auto mb-3 text-slate-300" />
              No login history found for this user.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Login Time</th>
                  <th>Logout Time</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map((h) => {
                  const duration = h.logoutTime 
                    ? formatDistanceToNow(new Date(h.logoutTime), { addSuffix: true })
                    : "Active Session";
                  return (
                    <tr key={h.id}>
                      <td className="text-sm">
                        <div className="flex items-center gap-1">
                          <LogIn size={12} className="text-green-600" />
                          {formatDate(h.loginTime)}
                        </div>
                      </td>
                      <td className="text-sm">
                        {h.logoutTime ? (
                          <div className="flex items-center gap-1">
                            <LogOut size={12} className="text-red-600" />
                            {formatDate(h.logoutTime)}
                          </div>
                        ) : (
                          <span className="text-amber-600 font-medium">● Active</span>
                        )}
                      </td>
                      <td>
                        {h.logoutTime ? (
                          <span className="badge bg-green-100 text-green-700">Completed</span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-700">Active</span>
                        )}
                      </td>
                      <td className="text-sm text-slate-500">{duration}</td>
                      <td className="text-sm text-slate-500 max-w-[150px] truncate" title={h.userAgent || ""}>
                        {h.deviceInfo || h.userAgent || "Unknown Device"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
}






// "use client";
// import { useEffect, useState } from "react";
// import { Plus, Pencil, Power, KeyRound } from "lucide-react";
// import Modal from "@/components/ui/Modal";

// type User = { id: string; name: string; email: string; phone?: string | null; role: string; active: boolean };

// const ROLES = ["ADMIN","MANAGER","CASHIER","KITCHEN"];

// export default function UsersPage() {
//   const [users, setUsers] = useState<User[]>([]);
//   const [open, setOpen] = useState(false);
//   const [form, setForm] = useState<any>({ name: "", email: "", phone: "", role: "CASHIER", password: "" });
//   const [pwOpen, setPwOpen] = useState<string | null>(null);
//   const [newPw, setNewPw] = useState("");

//   async function load() { setUsers((await (await fetch("/api/users")).json()).users); }
//   useEffect(() => { load(); }, []);

//   async function save() {
//     if (!form.name || !form.email || !form.password) { alert("Name, email, password required"); return; }
//     const r = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
//     if (!r.ok) { alert((await r.json()).error || "Failed"); return; }
//     setOpen(false); setForm({ name: "", email: "", phone: "", role: "CASHIER", password: "" }); load();
//   }
//   async function toggle(u: User) {
//     await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !u.active }) });
//     load();
//   }
//   async function changeRole(u: User, role: string) {
//     await fetch(`/api/users/${u.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
//     load();
//   }
//   async function resetPw() {
//     if (!pwOpen || !newPw) return;
//     await fetch(`/api/users/${pwOpen}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: newPw }) });
//     setPwOpen(null); setNewPw("");
//   }

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <h1 className="text-2xl font-bold text-slate-800">Users</h1>
//         <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add User</button>
//       </div>
//       <div className="card overflow-hidden">
//         <table className="table">
//           <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr></thead>
//           <tbody>
//             {users.map((u) => (
//               <tr key={u.id} className="hover:bg-slate-50">
//                 <td className="font-medium">{u.name}</td>
//                 <td className="text-sm">{u.email}</td>
//                 <td className="text-sm">{u.phone}</td>
//                 <td>
//                   <select className="select py-1 text-xs" value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
//                     {ROLES.map((r) => <option key={r}>{r}</option>)}
//                   </select>
//                 </td>
//                 <td>
//                   <button onClick={() => toggle(u)} className={`badge ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
//                     <Power size={11} /> {u.active ? "Active" : "Inactive"}
//                   </button>
//                 </td>
//                 <td className="text-right">
//                   <button className="btn btn-ghost p-1.5" onClick={() => setPwOpen(u.id)}><KeyRound size={14} /></button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>

//       <Modal open={open} onClose={() => setOpen(false)} title="Add User"
//         footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
//                   <button className="btn btn-primary" onClick={save}>Create</button></>}>
//         <div className="space-y-2">
//           <label><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></label>
//           <label><span className="label">Email</span><input className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></label>
//           <label><span className="label">Phone</span><input className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></label>
//           <label><span className="label">Role</span>
//             <select className="select" value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
//               {ROLES.map((r) => <option key={r}>{r}</option>)}
//             </select>
//           </label>
//           <label><span className="label">Password</span><input type="password" className="input" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} /></label>
//         </div>
//       </Modal>

//       <Modal open={!!pwOpen} onClose={() => setPwOpen(null)} title="Reset Password"
//         footer={<><button className="btn btn-secondary" onClick={() => setPwOpen(null)}>Cancel</button>
//                   <button className="btn btn-primary" onClick={resetPw}>Reset</button></>}>
//         <label><span className="label">New password</span><input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></label>
//       </Modal>
//     </div>
//   );
// }
