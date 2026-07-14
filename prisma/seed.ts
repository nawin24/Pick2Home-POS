import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PW = process.env.SEED_PASSWORD || "admin123";

// Helper function to generate SKU
function generateSKU(category: string, name: string): string {
  const prefix = category.substring(0, 3).toUpperCase();
  const namePart = name.substring(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${namePart}${random}`;
}

// Helper function to generate barcode
function generateBarcode(): string {
  return `890${Math.random().toString().substring(2, 11)}`;
}

// Helper function to generate batch number
function generateBatchNumber(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BATCH-${year}${month}-${random}`;
}

async function main() {
  const hash = await bcrypt.hash(PW, 10);

  // Settings (singleton)
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      storeName: "Pick2Home",
      storeType: "GROCERY",
      address: "12, MG Road, Bengaluru, Karnataka 560001",
      phone: "+91 98765 43210",
      email: "hello@pick2home.com",  // ← Changed from freshmart.in
      gstin: "29ABCDE1234F1Z5",
      fssai: "10019011000123",
      defaultGst: 5,
      packingCharge: 0,
      deliveryCharge: 0,
      printSize: "80mm",
      invoiceFooter: "Thank you for shopping at Pick2Home!",  // ← Changed from FreshMart
      loyaltyEnabled: true,
      loyaltyEarnRupees: 100,
      loyaltyRedeemValue: 1,
      loyaltyMinRedeem: 50,
      allowOnlineOrders: true,
      allowDelivery: true,
      allowCashierDiscount: true,
      allowCashierCancel: false,
      allowStockAdjustment: false,
      lowStockThreshold: 10,
      autoReorderQty: 50,
    },
  });

  // Sample coupons
  const coupons = [
    { code: "WELCOME10", type: "PERCENT", value: 10, minOrder: 500, maxDiscount: 200, description: "10% off first order (up to ₹200)" },
    { code: "PICK2HOME50", type: "FLAT", value: 50, minOrder: 300, description: "₹50 off on orders above ₹300" },  // ← Changed coupon name
    { code: "WEEKEND15", type: "PERCENT", value: 15, minOrder: 1000, maxDiscount: 300, description: "15% weekend special" },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: c as any,
    });
  }

  // Users - Multiple Cashiers, NO Store Keeper
  const users = [
    { name: "Admin", email: "admin@pick2home.com", role: "ADMIN", phone: "9000000001" },  // ← Changed
    { name: "Manager", email: "manager@pick2home.com", role: "MANAGER", phone: "9000000002" },  // ← Changed
    { name: "Cashier 1", email: "cashier1@pick2home.com", role: "CASHIER", phone: "9000000003" },  // ← Changed
    { name: "Cashier 2", email: "cashier2@pick2home.com", role: "CASHIER", phone: "9000000004" },  // ← NEW
    { name: "Cashier 3", email: "cashier3@pick2home.com", role: "CASHIER", phone: "9000000005" },  // ← NEW
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash: hash },
    });
  }
  const admin = await prisma.user.findUnique({ where: { email: "admin@pick2home.com" } });
  const manager = await prisma.user.findUnique({ where: { email: "manager@pick2home.com" } });
  const cashier1 = await prisma.user.findUnique({ where: { email: "cashier1@pick2home.com" } });

  // Categories with icons and manufacturing flag
  const categories = [
    { name: "Fruits & Vegetables", icon: "🥬", requiresManufacturing: false },
    { name: "Dairy & Eggs", icon: "🥛", requiresManufacturing: false },
    { name: "Bakery & Bread", icon: "🍞", requiresManufacturing: true },
    { name: "Meat & Poultry", icon: "🍗", requiresManufacturing: false },
    { name: "Grains & Rice", icon: "🌾", requiresManufacturing: false },
    { name: "Oils & Ghee", icon: "🫒", requiresManufacturing: true },
    { name: "Spices & Masalas", icon: "🌶️", requiresManufacturing: true },
    { name: "Beverages", icon: "🧃", requiresManufacturing: true },
    { name: "Snacks & Packaged", icon: "🍿", requiresManufacturing: true },
    { name: "Household Essentials", icon: "🧹", requiresManufacturing: false },
    { name: "Personal Care", icon: "🧴", requiresManufacturing: true },
  ];

  const cats = await Promise.all(
    categories.map((cat, i) =>
      prisma.category.upsert({ 
        where: { name: cat.name }, 
        update: { 
          sortOrder: i,
          icon: cat.icon,
          requiresManufacturing: cat.requiresManufacturing
        }, 
        create: { 
          name: cat.name, 
          icon: cat.icon, 
          sortOrder: i,
          requiresManufacturing: cat.requiresManufacturing
        } 
      })
    )
  );
  const C = Object.fromEntries(cats.map((c) => [c.name, c.id])) as Record<string, string>;

  // Grocery items with manufacturing details
  const items: Array<{
    name: string; category: string; price: number; mrp: number;
    gst: number; unit: string; stock: number; minStock: number;
    brand?: string; packaging?: string; isPerishable?: boolean;
    isManufactured?: boolean; expiryDays?: number;
  }> = [
    // Fruits & Vegetables
    { name: "Apple - Fresh", category: "Fruits & Vegetables", price: 120, mrp: 150, gst: 5, unit: "kg", stock: 50, minStock: 10, brand: "FreshFarm", packaging: "loose", isManufactured: false },
    { name: "Banana - Organic", category: "Fruits & Vegetables", price: 40, mrp: 50, gst: 5, unit: "dozen", stock: 30, minStock: 5, brand: "OrganicValley", packaging: "bunch", isManufactured: false },
    { name: "Orange - Sweet", category: "Fruits & Vegetables", price: 80, mrp: 100, gst: 5, unit: "kg", stock: 25, minStock: 5, brand: "FreshFarm", packaging: "loose", isManufactured: false },
    { name: "Tomato - Ripe", category: "Fruits & Vegetables", price: 30, mrp: 40, gst: 5, unit: "kg", stock: 20, minStock: 5, brand: "FreshFarm", packaging: "loose", isManufactured: false },
    { name: "Onion - Red", category: "Fruits & Vegetables", price: 25, mrp: 35, gst: 5, unit: "kg", stock: 40, minStock: 10, brand: "FreshFarm", packaging: "loose", isManufactured: false },
    { name: "Potato - Fresh", category: "Fruits & Vegetables", price: 20, mrp: 30, gst: 5, unit: "kg", stock: 60, minStock: 15, brand: "FreshFarm", packaging: "loose", isManufactured: false },
    { name: "Spinach - Fresh", category: "Fruits & Vegetables", price: 15, mrp: 20, gst: 5, unit: "bunch", stock: 15, minStock: 3, brand: "GreenLeaf", packaging: "bunch", isPerishable: true, isManufactured: false },
    { name: "Lemon", category: "Fruits & Vegetables", price: 5, mrp: 8, gst: 5, unit: "pcs", stock: 100, minStock: 20, brand: "FreshFarm", packaging: "loose", isManufactured: false },

    // Dairy & Eggs
    { name: "Milk (1L)", category: "Dairy & Eggs", price: 60, mrp: 65, gst: 5, unit: "packet", stock: 50, minStock: 10, brand: "Amul", packaging: "packet", isPerishable: true, isManufactured: false },
    { name: "Eggs (6 pcs)", category: "Dairy & Eggs", price: 45, mrp: 50, gst: 5, unit: "packet", stock: 40, minStock: 10, brand: "Happy Hens", packaging: "box", isPerishable: true, isManufactured: false },
    { name: "Butter (500g)", category: "Dairy & Eggs", price: 180, mrp: 200, gst: 12, unit: "packet", stock: 20, minStock: 5, brand: "Amul", packaging: "packet", isPerishable: true, isManufactured: false },
    { name: "Paneer (500g)", category: "Dairy & Eggs", price: 150, mrp: 170, gst: 5, unit: "packet", stock: 15, minStock: 5, brand: "Amul", packaging: "packet", isPerishable: true, isManufactured: false },
    { name: "Cheese (200g)", category: "Dairy & Eggs", price: 120, mrp: 140, gst: 12, unit: "packet", stock: 20, minStock: 5, brand: "Amul", packaging: "packet", isPerishable: true, isManufactured: false },

    // Bakery & Bread
    { name: "Bread (Whole Wheat)", category: "Bakery & Bread", price: 35, mrp: 40, gst: 5, unit: "packet", stock: 30, minStock: 10, brand: "Britannia", packaging: "packet", isPerishable: true, isManufactured: true, expiryDays: 7 },
    { name: "Bread (White)", category: "Bakery & Bread", price: 30, mrp: 35, gst: 5, unit: "packet", stock: 30, minStock: 10, brand: "Britannia", packaging: "packet", isPerishable: true, isManufactured: true, expiryDays: 7 },

    // Grains & Rice
    { name: "Basmati Rice (1kg)", category: "Grains & Rice", price: 120, mrp: 140, gst: 5, unit: "kg", stock: 100, minStock: 20, brand: "India Gate", packaging: "packet", isManufactured: false },
    { name: "Wheat Flour (1kg)", category: "Grains & Rice", price: 35, mrp: 40, gst: 5, unit: "kg", stock: 80, minStock: 20, brand: "Ashirvad", packaging: "packet", isManufactured: false },
    { name: "Toor Dal (1kg)", category: "Grains & Rice", price: 100, mrp: 120, gst: 5, unit: "kg", stock: 60, minStock: 15, brand: "Fortune", packaging: "packet", isManufactured: false },
    { name: "Pasta (500g)", category: "Grains & Rice", price: 50, mrp: 60, gst: 5, unit: "packet", stock: 40, minStock: 10, brand: "Barilla", packaging: "packet", isManufactured: false },

    // Oils & Ghee
    { name: "Cooking Oil (1L)", category: "Oils & Ghee", price: 160, mrp: 180, gst: 5, unit: "bottle", stock: 40, minStock: 10, brand: "Fortune", packaging: "bottle", isManufactured: true, expiryDays: 365 },
    { name: "Ghee (500ml)", category: "Oils & Ghee", price: 350, mrp: 400, gst: 12, unit: "bottle", stock: 20, minStock: 5, brand: "Amul", packaging: "bottle", isManufactured: true, expiryDays: 365 },

    // Spices & Masalas
    { name: "Salt (1kg)", category: "Spices & Masalas", price: 20, mrp: 25, gst: 5, unit: "packet", stock: 100, minStock: 20, brand: "Tata", packaging: "packet", isManufactured: true, expiryDays: 730 },
    { name: "Turmeric Powder (100g)", category: "Spices & Masalas", price: 80, mrp: 100, gst: 5, unit: "packet", stock: 40, minStock: 10, brand: "Everest", packaging: "packet", isManufactured: true, expiryDays: 365 },
    { name: "Red Chili Powder (100g)", category: "Spices & Masalas", price: 90, mrp: 110, gst: 5, unit: "packet", stock: 35, minStock: 8, brand: "Everest", packaging: "packet", isManufactured: true, expiryDays: 365 },
    { name: "Cumin Seeds (100g)", category: "Spices & Masalas", price: 70, mrp: 85, gst: 5, unit: "packet", stock: 30, minStock: 8, brand: "Everest", packaging: "packet", isManufactured: true, expiryDays: 365 },
    { name: "Garam Masala (50g)", category: "Spices & Masalas", price: 60, mrp: 75, gst: 5, unit: "packet", stock: 25, minStock: 5, brand: "Everest", packaging: "packet", isManufactured: true, expiryDays: 365 },

    // Beverages
    { name: "Tea (100g)", category: "Beverages", price: 80, mrp: 100, gst: 5, unit: "packet", stock: 40, minStock: 10, brand: "Tata", packaging: "packet", isManufactured: true, expiryDays: 730 },
    { name: "Coffee (100g)", category: "Beverages", price: 150, mrp: 180, gst: 5, unit: "packet", stock: 30, minStock: 5, brand: "Nescafe", packaging: "packet", isManufactured: true, expiryDays: 730 },
    { name: "Soft Drink (2L)", category: "Beverages", price: 80, mrp: 90, gst: 12, unit: "bottle", stock: 50, minStock: 10, brand: "Coca-Cola", packaging: "bottle", isManufactured: true, expiryDays: 180 },
    { name: "Mineral Water (1L)", category: "Beverages", price: 20, mrp: 25, gst: 12, unit: "bottle", stock: 100, minStock: 20, brand: "Bisleri", packaging: "bottle", isManufactured: true, expiryDays: 365 },

    // Snacks & Packaged
    { name: "Potato Chips (50g)", category: "Snacks & Packaged", price: 20, mrp: 25, gst: 12, unit: "packet", stock: 80, minStock: 20, brand: "Lays", packaging: "packet", isManufactured: true, expiryDays: 90 },
    { name: "Biscuits (200g)", category: "Snacks & Packaged", price: 30, mrp: 35, gst: 12, unit: "packet", stock: 60, minStock: 15, brand: "Parle", packaging: "packet", isManufactured: true, expiryDays: 180 },
    { name: "Noodles (100g)", category: "Snacks & Packaged", price: 15, mrp: 20, gst: 12, unit: "packet", stock: 50, minStock: 10, brand: "Maggi", packaging: "packet", isManufactured: true, expiryDays: 365 },
    { name: "Cereal (500g)", category: "Snacks & Packaged", price: 200, mrp: 240, gst: 12, unit: "box", stock: 20, minStock: 5, brand: "Kellogg's", packaging: "box", isManufactured: true, expiryDays: 365 },
    { name: "Honey (500g)", category: "Snacks & Packaged", price: 250, mrp: 300, gst: 12, unit: "bottle", stock: 15, minStock: 3, brand: "Dabur", packaging: "bottle", isManufactured: true, expiryDays: 730 },

    // Household Essentials
    { name: "Detergent Powder (1kg)", category: "Household Essentials", price: 120, mrp: 140, gst: 18, unit: "packet", stock: 40, minStock: 10, brand: "Tide", packaging: "packet", isManufactured: false },
    { name: "Dishwash Liquid (500ml)", category: "Household Essentials", price: 80, mrp: 100, gst: 18, unit: "bottle", stock: 30, minStock: 8, brand: "Vim", packaging: "bottle", isManufactured: false },
    { name: "Toilet Paper (6 rolls)", category: "Household Essentials", price: 120, mrp: 140, gst: 18, unit: "packet", stock: 50, minStock: 15, brand: "Premium", packaging: "packet", isManufactured: false },

    // Personal Care
    { name: "Shampoo (200ml)", category: "Personal Care", price: 180, mrp: 220, gst: 18, unit: "bottle", stock: 30, minStock: 8, brand: "Dove", packaging: "bottle", isManufactured: true, expiryDays: 730 },
    { name: "Bathing Soap (100g)", category: "Personal Care", price: 40, mrp: 50, gst: 18, unit: "pcs", stock: 80, minStock: 20, brand: "Lux", packaging: "loose", isManufactured: true, expiryDays: 365 },
    { name: "Toothpaste (100g)", category: "Personal Care", price: 60, mrp: 75, gst: 18, unit: "tube", stock: 40, minStock: 10, brand: "Colgate", packaging: "tube", isManufactured: true, expiryDays: 730 },
  ];

  // Create grocery items with manufacturing details
  for (const it of items) {
    const cId = C[it.category];
    if (!cId) continue;
    
    const sku = generateSKU(it.category, it.name);
    const barcode = generateBarcode();
    const batchNumber = it.isManufactured ? generateBatchNumber() : null;
    
    const existing = await prisma.groceryItem.findFirst({ where: { name: it.name } });
    if (existing) continue;
    
    const manufacturedDate = it.isManufactured ? new Date() : null;
    const expiryDate = it.isManufactured && it.expiryDays 
      ? new Date(Date.now() + it.expiryDays * 24 * 60 * 60 * 1000) 
      : null;
    
    await prisma.groceryItem.create({
      data: {
        name: it.name,
        sku: sku,
        barcode: barcode,
        categoryId: cId,
        price: it.price,
        mrp: it.mrp,
        gstPercent: it.gst,
        unit: it.unit,
        stockQuantity: it.stock,
        minStock: it.minStock,
        reorderPoint: Math.round(it.minStock * 0.6),
        brand: it.brand || "Pick2Home",  // ← Changed from FreshMart
        packaging: it.packaging || "standard",
        isPerishable: it.isPerishable || false,
        available: true,
        discountEligible: true,
        description: `${it.name} - ${it.unit}`,
        isManufactured: it.isManufactured || false,
        manufacturedDate: manufacturedDate,
        expiryDate: expiryDate,
        batchNumber: batchNumber,
      },
    });
  }

  // Pickup Counters
  for (let i = 1; i <= 5; i++) {
    await prisma.pickupCounter.upsert({
      where: { number: `PICKUP-${i}` },
      update: {},
      create: { number: `PICKUP-${i}`, status: "AVAILABLE" },
    });
  }

  // Supplier - Updated to Pick2Home
  const existingSupplier = await prisma.supplier.findFirst({
    where: { name: "Pick2Home Wholesale Supplier" }  // ← Changed
  });

  if (!existingSupplier) {
    await prisma.supplier.create({
      data: {
        name: "Pick2Home Wholesale Supplier",  // ← Changed
        phone: "+91 98765 43210",
        email: "wholesale@pick2home.com",  // ← Changed
        address: "Wholesale Market, Bengaluru",
        gstNumber: "29ABCDE1234F1Z5",
        contactPerson: "Rajesh Kumar",
        rating: 4,
        active: true,
      },
    });
  }

  // Inventory
  const inv = [
    { name: "Apple - Fresh", unit: "kg", openingStock: 50, minStock: 10 },
    { name: "Basmati Rice (1kg)", unit: "kg", openingStock: 100, minStock: 20 },
    { name: "Cooking Oil (1L)", unit: "ltr", openingStock: 40, minStock: 10 },
    { name: "Milk (1L)", unit: "packet", openingStock: 50, minStock: 10 },
    { name: "Bread (Whole Wheat)", unit: "packet", openingStock: 30, minStock: 10 },
    { name: "Salt (1kg)", unit: "packet", openingStock: 100, minStock: 20 },
    { name: "Tea (100g)", unit: "packet", openingStock: 40, minStock: 10 },
    { name: "Detergent Powder (1kg)", unit: "packet", openingStock: 40, minStock: 10 },
    { name: "Shampoo (200ml)", unit: "bottle", openingStock: 30, minStock: 8 },
    { name: "Toilet Paper (6 rolls)", unit: "packet", openingStock: 50, minStock: 15 },
  ];
  
  for (const i of inv) {
    const groceryItem = await prisma.groceryItem.findFirst({
      where: { name: i.name }
    });
    
    await prisma.inventoryItem.upsert({
      where: { name: i.name },
      update: { 
        groceryItemId: groceryItem?.id,
        openingStock: i.openingStock,
        minStock: i.minStock,
      },
      create: { 
        name: i.name, 
        groceryItemId: groceryItem?.id,
        unit: i.unit, 
        openingStock: i.openingStock, 
        minStock: i.minStock 
      },
    });
  }

  // Sample expenses - Use manager instead of storeKeeper
  if (manager) {  // ← Changed from admin to manager for expenses
    const existing = await prisma.expense.count();
    if (existing === 0) {
      await prisma.expense.createMany({
        data: [
          { title: "Shop Rent June",  category: "RENT",       amount: 25000, paymentMethod: "BANK", addedById: manager.id },
          { title: "Staff Salaries", category: "SALARY",     amount: 42000, paymentMethod: "BANK", addedById: manager.id },
          { title: "Electricity Bill", category: "ELECTRICITY", amount: 4500, paymentMethod: "CASH", addedById: manager.id },
          { title: "Store Maintenance", category: "MAINTENANCE", amount: 2000, paymentMethod: "CASH", addedById: manager.id },
        ],
      });
    }
  }

  // Sample bill - Use cashier1
  if (cashier1) {
    const billCount = await prisma.bill.count();
    if (billCount === 0) {
      const sampleItems = await prisma.groceryItem.findMany({ take: 3 });
      const order = await prisma.order.create({
        data: {
          orderNumber: "ORD-SAMPLE-0001",
          orderType: "WALKIN",
          orderStatus: "COMPLETED",
          items: {
            create: sampleItems.map((i) => ({
              groceryItemId: i.id, 
              name: i.name, 
              price: i.price, 
              quantity: 2,
              gstPercent: i.gstPercent, 
              discount: 0,
            })),
          },
        },
      });
      const subtotal = sampleItems.reduce((s, i) => s + (i.price * 2), 0);
      const gst = sampleItems.reduce((s, i) => s + ((i.price * 2 * i.gstPercent) / 100), 0);
      const grand = Math.round(subtotal + gst);
      await prisma.bill.create({
        data: {
          billNumber: "GROCERY-SAMPLE-0001",
          orderId: order.id,
          cashierId: cashier1.id,
          orderType: "WALKIN",
          subtotal, 
          cgst: gst / 2, 
          sgst: gst / 2, 
          totalGst: gst,
          grandTotal: grand,
          paymentMethod: "CASH", 
          paymentCash: grand,
          roundOff: grand - (subtotal + gst),
          itemCount: sampleItems.length,
        },
      });
    }
  }

  console.log("✅ Seeded successfully!");
  console.log("\n🔑 Sample logins (password: " + PW + "):");
  for (const u of users) console.log(`  ${u.role.padEnd(12)} → ${u.email}`);
  console.log("\n🛒 Pick2Home grocery store is ready!");
  
  const manufacturedCount = await prisma.groceryItem.count({
    where: { isManufactured: true }
  });
  console.log(`\n📦 ${manufacturedCount} products with manufacturing/expiry tracking`);
}

main()
  .catch((e) => { 
    console.error("❌ Seeding failed:", e); 
    process.exit(1); 
  })
  .finally(async () => { 
    await prisma.$disconnect(); 
  });











  
// import { PrismaClient } from "@prisma/client";
// import bcrypt from "bcryptjs";

// const prisma = new PrismaClient();
// const PW = process.env.SEED_PASSWORD || "admin123";

// async function main() {
//   const hash = await bcrypt.hash(PW, 10);

//   // Settings (singleton)
//   await prisma.settings.upsert({
//     where: { id: "singleton" },
//     update: {},
//     create: {
//       id: "singleton",
//       storeName: "Pick2Home",
//       address: "12, MG Road, Bengaluru, Karnataka 560001",
//       phone: "+91 98765 43210",
//       email: "hello@spicegarden.in",
//       gstin: "29ABCDE1234F1Z5",
//       fssai: "10019011000123",
//       defaultGst: 5,
//       packingCharge: 10,
//       serviceCharge: 0,
//       printSize: "80mm",
//       invoiceFooter: "Thank you for dining with us! Visit again.",
//       loyaltyEnabled: true,
//       loyaltyEarnRupees: 100,
//       loyaltyRedeemValue: 1,
//       loyaltyMinRedeem: 50,
//     },
//   });

//   // Sample coupons.
//   const coupons = [
//     { code: "WELCOME10", type: "PERCENT", value: 10, minOrder: 200, maxDiscount: 100, description: "10% off first order (up to ₹100)" },
//     { code: "FLAT50",    type: "FLAT",    value: 50, minOrder: 300, description: "₹50 off on orders above ₹300" },
//     { code: "WEEKEND15", type: "PERCENT", value: 15, minOrder: 500, maxDiscount: 200, description: "15% weekend special" },
//   ];
//   for (const c of coupons) {
//     await prisma.coupon.upsert({
//       where: { code: c.code },
//       update: {},
//       create: c as any,
//     });
//   }

//   // Users
//   const users = [
//     { name: "Admin",   email: "admin@restaurant.com",   role: "ADMIN",   phone: "9000000001" },
//     { name: "Manager", email: "manager@restaurant.com", role: "MANAGER", phone: "9000000002" },
//     { name: "Cashier", email: "cashier@restaurant.com", role: "CASHIER", phone: "9000000003" },
//     { name: "Kitchen", email: "kitchen@restaurant.com", role: "KITCHEN", phone: "9000000004" },
//   ];
//   for (const u of users) {
//     await prisma.user.upsert({
//       where: { email: u.email },
//       update: {},
//       create: { ...u, passwordHash: hash },
//     });
//   }
//   const admin = await prisma.user.findUnique({ where: { email: "admin@restaurant.com" } });
//   const cashier = await prisma.user.findUnique({ where: { email: "cashier@restaurant.com" } });

//   // Categories
//   const categories = [
//     "Starters","Main Course","Rice","Biryani","Fried Rice",
//     "Noodles","Pizza","Burger","Beverages","Desserts",
//   ];
//   const cats = await Promise.all(
//     categories.map((name, i) =>
//       prisma.category.upsert({ where: { name }, update: {}, create: { name, sortOrder: i } })
//     )
//   );
//   const C = Object.fromEntries(cats.map((c) => [c.name, c.id])) as Record<string, string>;

//   // Menu items (40+)
//   const items: Array<{
//     name: string; category: string; price: number; gst: number;
//     type: "VEG" | "NONVEG" | "EGG"; prep: number;
//   }> = [
//     // Starters
//     { name: "Paneer Tikka",         category: "Starters", price: 220, gst: 5,  type: "VEG",    prep: 12 },
//     { name: "Chicken 65",           category: "Starters", price: 260, gst: 5,  type: "NONVEG", prep: 15 },
//     { name: "Veg Manchurian",       category: "Starters", price: 180, gst: 5,  type: "VEG",    prep: 10 },
//     { name: "Crispy Corn",          category: "Starters", price: 160, gst: 5,  type: "VEG",    prep: 8  },
//     { name: "Mutton Seekh Kebab",   category: "Starters", price: 320, gst: 5,  type: "NONVEG", prep: 18 },

//     // Main Course
//     { name: "Paneer Butter Masala", category: "Main Course", price: 260, gst: 5, type: "VEG",    prep: 15 },
//     { name: "Dal Makhani",          category: "Main Course", price: 220, gst: 5, type: "VEG",    prep: 12 },
//     { name: "Butter Chicken",       category: "Main Course", price: 320, gst: 5, type: "NONVEG", prep: 18 },
//     { name: "Mutton Rogan Josh",    category: "Main Course", price: 380, gst: 5, type: "NONVEG", prep: 22 },
//     { name: "Egg Curry",            category: "Main Course", price: 180, gst: 5, type: "EGG",    prep: 12 },

//     // Rice
//     { name: "Jeera Rice",           category: "Rice", price: 140, gst: 5, type: "VEG", prep: 10 },
//     { name: "Steamed Rice",         category: "Rice", price: 100, gst: 5, type: "VEG", prep: 8  },
//     { name: "Veg Pulao",            category: "Rice", price: 180, gst: 5, type: "VEG", prep: 12 },

//     // Biryani
//     { name: "Chicken Biryani",      category: "Biryani", price: 280, gst: 5, type: "NONVEG", prep: 20 },
//     { name: "Mutton Biryani",       category: "Biryani", price: 360, gst: 5, type: "NONVEG", prep: 25 },
//     { name: "Veg Biryani",          category: "Biryani", price: 220, gst: 5, type: "VEG",    prep: 18 },
//     { name: "Egg Biryani",          category: "Biryani", price: 240, gst: 5, type: "EGG",    prep: 18 },

//     // Fried Rice
//     { name: "Veg Fried Rice",       category: "Fried Rice", price: 180, gst: 5, type: "VEG",    prep: 10 },
//     { name: "Chicken Fried Rice",   category: "Fried Rice", price: 220, gst: 5, type: "NONVEG", prep: 12 },
//     { name: "Schezwan Fried Rice",  category: "Fried Rice", price: 200, gst: 5, type: "VEG",    prep: 12 },

//     // Noodles
//     { name: "Veg Hakka Noodles",    category: "Noodles", price: 180, gst: 5, type: "VEG",    prep: 10 },
//     { name: "Chicken Hakka Noodles",category: "Noodles", price: 220, gst: 5, type: "NONVEG", prep: 12 },
//     { name: "Schezwan Noodles",     category: "Noodles", price: 200, gst: 5, type: "VEG",    prep: 11 },

//     // Pizza
//     { name: "Margherita Pizza",     category: "Pizza", price: 260, gst: 5, type: "VEG",    prep: 14 },
//     { name: "Farmhouse Pizza",      category: "Pizza", price: 340, gst: 5, type: "VEG",    prep: 16 },
//     { name: "Chicken Tikka Pizza",  category: "Pizza", price: 380, gst: 5, type: "NONVEG", prep: 18 },

//     // Burger
//     { name: "Veg Burger",           category: "Burger", price: 120, gst: 5,  type: "VEG",    prep: 8  },
//     { name: "Cheese Burger",        category: "Burger", price: 160, gst: 5,  type: "VEG",    prep: 9  },
//     { name: "Chicken Burger",       category: "Burger", price: 180, gst: 5,  type: "NONVEG", prep: 10 },

//     // Beverages
//     { name: "Masala Chai",          category: "Beverages", price: 40,  gst: 5,  type: "VEG", prep: 5  },
//     { name: "Filter Coffee",        category: "Beverages", price: 50,  gst: 5,  type: "VEG", prep: 5  },
//     { name: "Fresh Lime Soda",      category: "Beverages", price: 80,  gst: 12, type: "VEG", prep: 4  },
//     { name: "Mango Lassi",          category: "Beverages", price: 120, gst: 12, type: "VEG", prep: 5  },
//     { name: "Cold Coffee",          category: "Beverages", price: 140, gst: 12, type: "VEG", prep: 6  },
//     { name: "Bottled Water",        category: "Beverages", price: 30,  gst: 12, type: "VEG", prep: 1  },

//     // Desserts
//     { name: "Gulab Jamun (2 pcs)",  category: "Desserts", price: 90,  gst: 5,  type: "VEG", prep: 3 },
//     { name: "Rasmalai (2 pcs)",     category: "Desserts", price: 130, gst: 5,  type: "VEG", prep: 3 },
//     { name: "Chocolate Brownie",    category: "Desserts", price: 160, gst: 18, type: "VEG", prep: 5 },
//     { name: "Vanilla Ice Cream",    category: "Desserts", price: 80,  gst: 18, type: "VEG", prep: 2 },
//     { name: "Kulfi",                category: "Desserts", price: 90,  gst: 18, type: "VEG", prep: 2 },
//   ];

//   for (const it of items) {
//     const cId = C[it.category];
//     if (!cId) continue;
//     const existing = await prisma.GroceryItem.findFirst({ where: { name: it.name } });
//     if (existing) continue;
//     await prisma.GroceryItem.create({
//       data: {
//         name: it.name,
//         categoryId: cId,
//         price: it.price,
//         gstPercent: it.gst,
//         itemType: it.type,
//         prepTimeMinutes: it.prep,
//         available: true,
//         discountEligible: true,
//       },
//     });
//   }

//   // Tables 1..10
//   for (let i = 1; i <= 10; i++) {
//     await prisma.table.upsert({
//       where: { number: String(i) },
//       update: {},
//       create: { number: String(i), capacity: i <= 4 ? 2 : 4, status: "AVAILABLE" },
//     });
//   }

//   // Inventory
//   const inv = [
//     { name: "Basmati Rice", unit: "kg", openingStock: 50, minStock: 10 },
//     { name: "Sunflower Oil", unit: "ltr", openingStock: 20, minStock: 5 },
//     { name: "Chicken", unit: "kg", openingStock: 15, minStock: 4 },
//     { name: "Mutton", unit: "kg", openingStock: 8, minStock: 3 },
//     { name: "Onion", unit: "kg", openingStock: 25, minStock: 8 },
//     { name: "Tomato", unit: "kg", openingStock: 18, minStock: 6 },
//     { name: "Paneer", unit: "kg", openingStock: 6, minStock: 2 },
//     { name: "Milk", unit: "ltr", openingStock: 30, minStock: 5 },
//     { name: "Cheese", unit: "kg", openingStock: 3, minStock: 1 },
//     { name: "Mixed Masala", unit: "kg", openingStock: 4, minStock: 1 },
//   ];
//   for (const i of inv) {
//     await prisma.inventoryItem.upsert({
//       where: { name: i.name }, update: {}, create: i,
//     });
//   }

//   // A couple of sample expenses
//   if (admin) {
//     const existing = await prisma.expense.count();
//     if (existing === 0) {
//       await prisma.expense.createMany({
//         data: [
//           { title: "Shop Rent April",  category: "RENT",       amount: 25000, paymentMethod: "BANK", addedById: admin.id },
//           { title: "Salaries — Staff", category: "SALARY",     amount: 42000, paymentMethod: "BANK", addedById: admin.id },
//           { title: "Vegetables",       category: "VEGETABLES", amount: 1800,  paymentMethod: "CASH", addedById: admin.id },
//           { title: "Gas cylinder",     category: "GAS",        amount: 1100,  paymentMethod: "CASH", addedById: admin.id },
//         ],
//       });
//     }
//   }

//   // A sample completed bill so dashboard isn't empty
//   if (cashier) {
//     const billCount = await prisma.bill.count();
//     if (billCount === 0) {
//       const sampleItems = await prisma.GroceryItem.findMany({ take: 3 });
//       const order = await prisma.order.create({
//         data: {
//           orderNumber: "ORD-SAMPLE-0001",
//           orderType: "DINEIN",
//           kotStatus: "SERVED",
//           items: {
//             create: sampleItems.map((i) => ({
//               menuItemId: i.id, name: i.name, price: i.price, quantity: 1,
//               gstPercent: i.gstPercent, discount: 0,
//             })),
//           },
//         },
//       });
//       const subtotal = sampleItems.reduce((s, i) => s + i.price, 0);
//       const gst = sampleItems.reduce((s, i) => s + (i.price * i.gstPercent) / 100, 0);
//       const grand = Math.round(subtotal + gst);
//       await prisma.bill.create({
//         data: {
//           billNumber: "REST-SAMPLE-0001",
//           orderId: order.id,
//           cashierId: cashier.id,
//           orderType: "DINEIN",
//           subtotal, cgst: gst / 2, sgst: gst / 2, totalGst: gst,
//           grandTotal: grand,
//           paymentMethod: "CASH", paymentCash: grand,
//           roundOff: grand - (subtotal + gst),
//         },
//       });
//     }
//   }

//   console.log("Seeded successfully.");
//   console.log("\nSample logins (password: " + PW + "):");
//   for (const u of users) console.log(`  ${u.role.padEnd(8)} → ${u.email}`);
// }

// main()
//   .catch((e) => { console.error(e); process.exit(1); })
//   .finally(async () => { await prisma.$disconnect(); });
