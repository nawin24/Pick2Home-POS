import "./globals.css";


import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "P2H",
  description: "Pick2Home - Sales & Management System",
  icons: {
    icon: "/P2H.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/P2H.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/P2H.ico" type="image/x-icon" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}







// import "./globals.css";
// import type { Metadata } from "next";

// export const metadata: Metadata = {
//   title: "P2H",
//   description: "Pick2Home - Sales & Management System",
//   icons: {
//     icon: "/P2H.ico",
//   },
// };

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <head>
//         <link rel="icon" href="/P2H.ico" type="image/x-icon" />
//         <link rel="shortcut icon" href="/P2H.ico" type="image/x-icon" />
//       </head>
//       <body className="min-h-screen antialiased">{children}</body>
//     </html>
//   );
// }