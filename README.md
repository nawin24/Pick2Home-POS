# 🛒 Pick2Home Grocery POS

A production-grade grocery and household essentials POS system — dine-in, takeaway, delivery, kitchen order ticket (KOT), GST invoicing, table management, customers, expenses, inventory, reports, role-based auth, **loyalty points, coupons, captain (waiter) app, QR ordering, Swiggy/Zomato webhook, reservations, USB weighing scale integration, bulk CSV/Excel import** — built on Next.js 14, TypeScript, Tailwind, Prisma.

Positioned between low-end POS (PosEase / POS Easy) and the high-end SaaS POS (Petpooja). Self-hosted, no per-outlet license, all features included.

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Core Features](#core-features)
- [Advanced Features](#advanced-features)
- [USB Weighing Scale Integration](#usb-weighing-scale-integration)
- [Bulk Import (1000+ Products)](#bulk-import-1000-products)
- [Quick Start](#quick-start)
- [Scripts](#scripts)
- [Image Uploads](#image-uploads)
- [Database Setup](#database-setup)
- [Folder Structure](#folder-structure)
- [Deployment](#deployment)
- [Comparison](#comparison)
- [Roadmap](#roadmap)
- [License](#license)

## 🚀 Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Backend:** Next.js API routes (REST)
- **Database:** SQLite via Prisma by default (zero setup). One-line swap to PostgreSQL.
- **Auth:** JWT cookies + bcrypt + role middleware (`ADMIN`, `MANAGER`, `CASHIER`, `KITCHEN`)
- **File Handling:** ExcelJS for bulk imports, Firebase Storage with local fallback for images
- **Charts:** Recharts · **Icons:** Lucide
- **Weighing Scale:** USB serial communication with baud rate 9600

## 🎯 Core Features

### Role-Based Access Control

- Admin - Full system access
- Manager - Operational management
- Cashier - POS billing only
- Kitchen - KOT management only
- Route + API guards for all endpoints

### Dashboard

- Real-time sales statistics
- Payment mix visualization
- Top selling items
- Recent bills with source breakdown
- Daily/Monthly revenue charts

### POS Billing

- Fast billing with search and categories
- Cart management with quantity adjustments
- Line item discounts
- Bill-level discounts (₹ or %)
- Packing, service, delivery charges
- Auto round-off
- Split payments (Cash/UPI/Card/Digital Wallet)
- Hold and recall orders
- **USB weighing scale integration** for weight-based products

### Kitchen Management

- Kitchen Order Ticket (KOT) board
- Status flow: New → Preparing → Ready → Served
- Auto-refresh for real-time updates
- Source tracking (Dine-in/Takeaway/Delivery/QR/Captain)

### Menu Management

- Categories with icons
- Items with GST %, veg/non-veg/egg indicators
- Preparation time tracking
- Availability toggles
- Manufacturing/expiry tracking
- Bulk import via Excel/CSV

### Table Management

- Visual table grid
- Status tracking (Available/Occupied/Reserved/Cleaning)
- Auto-assign bills to tables
- Table merging for large groups

### Customer Management

- Auto-attach customers to bills
- Visit count tracking
- Lifetime spend analysis
- Loyalty points balance
- Customer search and history

### Billing & Invoices

- Bills list with filters
- Detail view with payment breakdown
- Multiple print layouts (58mm, 80mm, A4)
- GST-compliant invoices
- Bill cancellation with audit trail
- Unique bill numbering: `REST-YYYYMMDD-0001`

### Expenses & Inventory

- Expense tracking with categories
- Low-stock alerts
- Opening stock management
- Purchase tracking
- Inventory valuation

### Reports & Analytics

- Gross/Net sales reports
- GST summary
- Discount analysis
- Expense reports
- Profit/Loss statements
- Cashier performance
- Item-wise sales
- Source-wise breakdown
- CSV export for all reports

### Settings

- Restaurant profile management
- Tax & charges configuration
- Print size preferences
- Loyalty program configuration
- User permissions
- Audit logs for all actions

## 🚀 Advanced Features

### Loyalty Points System

- Configurable earn rate (₹100 → 1 pt)
- Configurable redeem value
- Minimum redeem threshold
- Auto-accrues on every bill
- One-tap redeem at POS
- Customer dashboard with balance

### Coupons & Discounts

- `PERCENT` or `FLAT` discount types
- Minimum order value
- Maximum discount cap
- Expiry dates
- Usage limits
- Sample coupons: `WELCOME10`, `FLAT50`, `WEEKEND15`

### Captain (Waiter) App

- Mobile-first `/captain` route
- Waiters take dine-in orders
- Orders go straight to kitchen
- `source=CAPTAIN` tracking
- Cashier finalizes payment later

### QR Menu Ordering

- Public `/qr/[tableNumber]` page
- Guests scan table QR
- Browse live menu
- Send orders to kitchen (`source=QR`)
- No login required

### Online Order Integration

- `POST /api/integrations/online` endpoint
- Accepts normalized payload from Swiggy/Zomato
- Secured by `x-integration-token` header
- Orders land on kitchen tagged by source

### Reservations

- Table bookings with party size
- Scheduled time management
- Status flow: BOOKED → SEATED → CANCELLED → NOSHOW
- Auto-flips table status when seated

## 📦 USB Weighing Scale Integration

### Features

- Real-time weight reading from USB scale
- Automatic price calculation based on weight
- Support for multiple units (kg/gm)
- Tare/Zero functionality
- USB serial communication (baud rate 9600)
- Compatible with most standard USB weighing scales

### Configuration

1. **Scale Setup:**
   ```env
   # .env
   USB_SCALE_PORT=COM3  # Windows
   USB_SCALE_PORT=/dev/ttyUSB0  # Linux/Mac
   USB_SCALE_BAUD=9600
   USB_SCALE_PARITY=none
   USB_SCALE_DATA_BITS=8
   USB_SCALE_STOP_BITS=1
   ```
