"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Store, Mail, Lock, Eye, EyeOff, ShoppingBag, Leaf } from "lucide-react";
import Image from "next/image";

// Sample logins for Pick2Home - all roles included
const SAMPLES = [
  { label: "Admin",   email: "admin@pick2home.com",   pw: "admin123", role: "ADMIN" },
  { label: "Manager", email: "manager@pick2home.com", pw: "admin123", role: "MANAGER" },
  { label: "Cashier 1", email: "cashier1@pick2home.com", pw: "admin123", role: "CASHIER" },
  { label: "Cashier 2", email: "cashier2@pick2home.com", pw: "admin123", role: "CASHIER" },
  { label: "Cashier 3", email: "cashier3@pick2home.com", pw: "admin123", role: "CASHIER" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@pick2home.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); 
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Login failed");
      
      // All users (Admin, Manager, Cashier) will be redirected to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-600 via-emerald-500 to-amber-500 p-4 relative overflow-hidden">
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>

      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large Shadow Logo Behind Login */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-10">
          <div className="relative w-full h-full">
            <Image
              src="logo.jpeg"
              alt=""
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Floating grocery items */}
        <div className="absolute top-10 left-10 text-7xl opacity-20 animate-float" style={{ animationDuration: '8s' }}>
          🛒
        </div>
        <div className="absolute top-20 right-20 text-6xl opacity-20 animate-float" style={{ animationDuration: '10s', animationDelay: '1s' }}>
          🥬
        </div>
        <div className="absolute bottom-20 left-20 text-7xl opacity-20 animate-float" style={{ animationDuration: '9s', animationDelay: '2s' }}>
          🍎
        </div>
        <div className="absolute bottom-10 right-10 text-6xl opacity-20 animate-float" style={{ animationDuration: '7s', animationDelay: '0.5s' }}>
          🥛
        </div>
        <div className="absolute top-1/2 left-5 text-5xl opacity-15 animate-float" style={{ animationDuration: '11s', animationDelay: '3s' }}>
          🧃
        </div>
        <div className="absolute top-1/3 right-5 text-5xl opacity-15 animate-float" style={{ animationDuration: '12s', animationDelay: '1.5s' }}>
          🍞
        </div>
        <div className="absolute top-5 left-1/3 text-5xl opacity-10 animate-float" style={{ animationDuration: '10s', animationDelay: '2.5s' }}>
          🥚
        </div>
        <div className="absolute bottom-1/3 right-10 text-5xl opacity-10 animate-float" style={{ animationDuration: '9s', animationDelay: '3.5s' }}>
          🧈
        </div>
        
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white rounded-full opacity-5 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Store Name */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative w-28 h-28 rounded-full overflow-hidden bg-white/95 shadow-2xl p-2 ring-4 ring-white/50 backdrop-blur-sm">
            <Image
              src="logo.jpeg"
              alt="Pick2Home Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <div className="font-bold text-3xl text-white drop-shadow-lg flex items-center gap-2">
              <span className="text-amber-200">Pick</span>
              <span className="text-white">2</span>
              <span className="text-amber-200">Home</span>
            </div>
            <div className="text-sm text-white/80 flex items-center justify-center gap-2 mt-1 drop-shadow">
              <Leaf size={14} className="text-amber-200" />
              <span>Fresh Grocery Store</span>
              <Leaf size={14} className="text-amber-200" />
            </div>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={submit} className="bg-white/95 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-2xl border border-white/30">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold text-slate-700">Welcome Back!</h2>
            <p className="text-sm text-slate-500">Sign in to manage your grocery store</p>
          </div>

          <div>
            <label className="label flex items-center gap-2 text-slate-600">
              <Mail size={16} className="text-emerald-500" />
              <span>Email</span>
            </label>
            <input 
              className="input pl-10 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400 bg-white/80" 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="label flex items-center gap-2 text-slate-600">
              <Lock size={16} className="text-emerald-500" />
              <span>Password</span>
            </label>
            <div className="relative">
              <input 
                className="input pl-10 pr-10 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400 bg-white/80" 
                type={showPassword ? "text" : "password"} 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
              {error}
            </div>
          )}
          
          <button className="btn btn-primary w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 border-0 shadow-lg shadow-emerald-200/50" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Signing in...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <LogIn size={16} />
                Sign in
              </span>
            )}
          </button>
        </form>

        {/* Sample Logins */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl mt-4 p-4 shadow-2xl border border-white/30">
          <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-2">
            <ShoppingBag size={14} className="text-emerald-500" />
            Quick Login (password: admin123)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLES.map((s) => (
              <button
                key={s.email}
                onClick={() => { setEmail(s.email); setPassword(s.pw); }}
                className="text-left text-sm px-3 py-2 rounded-lg bg-slate-50/80 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-100 transition-all hover:shadow-md backdrop-blur-sm"
              >
                <div className="font-medium text-slate-700">{s.label}</div>
                <div className="text-xs text-slate-500 truncate">{s.email}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 text-xs text-white/60 drop-shadow">
          &copy; {new Date().getFullYear()} Pick2Home. Fresh groceries delivered with ❤️
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}


// normal login




// "use client";
// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { LogIn, Store, Mail, Lock, Eye, EyeOff } from "lucide-react";
// import Image from "next/image";

// // Updated sample logins for Pick2Home
// const SAMPLES = [
//   { label: "Admin",   email: "admin@pick2home.com",   pw: "admin123" },
//   { label: "Manager", email: "manager@pick2home.com", pw: "admin123" },
//   { label: "Cashier 1", email: "cashier1@pick2home.com", pw: "admin123" },
//   { label: "Cashier 2", email: "cashier2@pick2home.com", pw: "admin123" },
// ];

// export default function LoginPage() {
//   const router = useRouter();
//   const [email, setEmail] = useState("admin@pick2home.com");
//   const [password, setPassword] = useState("admin123");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [showPassword, setShowPassword] = useState(false);

//   async function submit(e: React.FormEvent) {
//     e.preventDefault();
//     setError(""); 
//     setLoading(true);
//     try {
//       const r = await fetch("/api/auth/login", {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });
//       const json = await r.json();
//       if (!r.ok) throw new Error(json.error || "Login failed");
//       router.push("/dashboard");
//       router.refresh();
//     } catch (err: any) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-50 p-4">
//       <div className="w-full max-w-md">
//         {/* Logo and Store Name */}
//         <div className="flex flex-col items-center gap-2 mb-6">
//           <div className="relative w-28 h-28 rounded-full overflow-hidden bg-white shadow-lg p-1">
//             <Image
//               src="logo.jpeg"
//               alt="Pick2Home Logo"
//               fill
//               className="object-contain"
//               priority
//             />
//           </div>
//           <div className="text-center">
//             <div className="font-bold text-2xl text-slate-800">Pick2Home</div>
//             <div className="text-xs text-slate-500">Grocery Store Management</div>
//           </div>
//         </div>

//         {/* Login Form */}
//         <form onSubmit={submit} className="card p-6 space-y-4 shadow-lg">
//           <div>
//             <label className="label flex items-center gap-2">
//               <Mail size={16} className="text-slate-400" />
//               <span>Email</span>
//             </label>
//             <input 
//               className="input pl-10" 
//               type="email" 
//               required 
//               value={email} 
//               onChange={(e) => setEmail(e.target.value)} 
//               placeholder="Enter your email"
//             />
//           </div>
//           <div>
//             <label className="label flex items-center gap-2">
//               <Lock size={16} className="text-slate-400" />
//               <span>Password</span>
//             </label>
//             <div className="relative">
//               <input 
//                 className="input pl-10 pr-10" 
//                 type={showPassword ? "text" : "password"} 
//                 required 
//                 value={password} 
//                 onChange={(e) => setPassword(e.target.value)} 
//                 placeholder="Enter your password"
//               />
//               <button
//                 type="button"
//                 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
//                 onClick={() => setShowPassword(!showPassword)}
//               >
//                 {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//               </button>
//             </div>
//           </div>
          
//           {error && (
//             <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-100">
//               {error}
//             </div>
//           )}
          
//           <button className="btn btn-primary w-full py-2.5" disabled={loading}>
//             {loading ? (
//               <span className="flex items-center gap-2">
//                 <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
//                 Signing in...
//               </span>
//             ) : (
//               <span className="flex items-center gap-2">
//                 <LogIn size={16} />
//                 Sign in
//               </span>
//             )}
//           </button>
//         </form>

//         {/* Sample Logins */}
//         <div className="card mt-4 p-4 shadow-lg">
//           <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-2">
//             <Store size={14} />
//             Quick Login (password: admin123)
//           </div>
//           <div className="grid grid-cols-2 gap-2">
//             {SAMPLES.map((s) => (
//               <button
//                 key={s.email}
//                 onClick={() => { setEmail(s.email); setPassword(s.pw); }}
//                 className="text-left text-sm px-3 py-2 rounded-md bg-slate-50 hover:bg-brand-50 hover:border-brand-200 border border-slate-100 transition"
//               >
//                 <div className="font-medium text-slate-700">{s.label}</div>
//                 <div className="text-xs text-slate-500 truncate">{s.email}</div>
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="text-center mt-4 text-xs text-slate-400">
//           &copy; {new Date().getFullYear()} Pick2Home. All rights reserved.
//         </div>
//       </div>
//     </div>
//   );
// }

























// "use client";
// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { LogIn, UtensilsCrossed } from "lucide-react";

// const SAMPLES = [
//   { label: "Admin",   email: "admin@restaurant.com",   pw: "admin123" },
//   { label: "Manager", email: "manager@restaurant.com", pw: "admin123" },
//   { label: "Cashier", email: "cashier@restaurant.com", pw: "admin123" },
//   { label: "Kitchen", email: "kitchen@restaurant.com", pw: "admin123" },
// ];

// export default function LoginPage() {
//   const router = useRouter();
//   const [email, setEmail] = useState("admin@restaurant.com");
//   const [password, setPassword] = useState("admin123");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   async function submit(e: React.FormEvent) {
//     e.preventDefault();
//     setError(""); setLoading(true);
//     try {
//       const r = await fetch("/api/auth/login", {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });
//       const json = await r.json();
//       if (!r.ok) throw new Error(json.error || "Login failed");
//       router.push(json.user.role === "KITCHEN" ? "/kitchen" : "/dashboard");
//       router.refresh();
//     } catch (err: any) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-50 p-4">
//       <div className="w-full max-w-md">
//         <div className="flex items-center gap-2 justify-center mb-6">
//           <div className="h-11 w-11 rounded-xl bg-brand-600 text-white flex items-center justify-center">
//             <UtensilsCrossed size={22} />
//           </div>
//           <div>
//             <div className="font-bold text-xl leading-tight">Hores POS</div>
//             <div className="text-xs text-slate-500">Restaurant Billing System</div>
//           </div>
//         </div>

//         <form onSubmit={submit} className="card p-6 space-y-4">
//           <div>
//             <label className="label">Email</label>
//             <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
//           </div>
//           <div>
//             <label className="label">Password</label>
//             <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
//           </div>
//           {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}
//           <button className="btn btn-primary w-full" disabled={loading}>
//             <LogIn size={16} />
//             {loading ? "Signing in..." : "Sign in"}
//           </button>
//         </form>

//         <div className="card mt-4 p-4">
//           <div className="text-xs font-semibold text-slate-500 mb-2">SAMPLE LOGINS (password: admin123)</div>
//           <div className="grid grid-cols-2 gap-2">
//             {SAMPLES.map((s) => (
//               <button
//                 key={s.email}
//                 onClick={() => { setEmail(s.email); setPassword(s.pw); }}
//                 className="text-left text-sm px-3 py-2 rounded-md bg-slate-50 hover:bg-brand-50 border border-slate-100"
//               >
//                 <div className="font-medium">{s.label}</div>
//                 <div className="text-xs text-slate-500 truncate">{s.email}</div>
//               </button>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
