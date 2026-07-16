// Bill calculation engine — single source of truth for line + bill totals.
// Updated for Grocery Store billing

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  gstPercent: number;
  discount?: number; // absolute rupee discount on this line
  notes?: string;
  weight?: number; // Optional weight for grocery items sold by weight
};

export type BillExtras = {
  packingCharge?: number;
  serviceCharge?: number; // Kept for compatibility, but set to 0 for grocery
  deliveryCharge?: number;
  billDiscount?: number;          // absolute rupees
  billDiscountPercent?: number;   // percent applied to subtotal
  couponDiscount?: number;        // absolute ₹ deduction from a validated coupon
  loyaltyRedeemValue?: number; 
     // absolute ₹ deduction from points redemption
};

export type ComputedLine = CartLine & {
  itemTotal: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
};

export type ComputedBill = {
  lines: ComputedLine[];
  subtotal: number;       // sum of taxable amounts
  itemDiscount: number;   // sum of per-line discounts
  totalGst: number;
  cgst: number;
  sgst: number;
  packingCharge: number;
  serviceCharge: number;  // Kept for compatibility
  deliveryCharge: number;
  billDiscount: number;
  couponDiscount: number;
  loyaltyRedeemValue: number;
  grandTotalBeforeRound: number;
  roundOff: number;
  grandTotal: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeBill(cart: CartLine[], extras: BillExtras = {}): ComputedBill {
  const lines: ComputedLine[] = cart.map((l) => {
    // For grocery items, price is per unit (kg, pcs, packet, etc.)
    const itemTotal = r2(l.price * l.quantity);
    const discount = Math.max(0, Math.min(l.discount ?? 0, itemTotal));
    const taxableAmount = r2(itemTotal - discount);
    const gstAmount = r2((taxableAmount * (l.gstPercent || 0)) / 100);
    return {
      ...l,
      itemTotal,
      taxableAmount,
      gstAmount,
      lineTotal: r2(taxableAmount + gstAmount),
    };
  });

  const subtotal = r2(lines.reduce((s, l) => s + l.taxableAmount, 0));
  const itemDiscount = r2(
    lines.reduce((s, l) => s + (l.discount ?? 0), 0)
  );
  const totalGst = r2(lines.reduce((s, l) => s + l.gstAmount, 0));
  const cgst = r2(totalGst / 2);
  const sgst = r2(totalGst - cgst);

  const packingCharge = r2(extras.packingCharge ?? 0);
  const serviceCharge = r2(extras.serviceCharge ?? 0); // Usually 0 for grocery
  const deliveryCharge = r2(extras.deliveryCharge ?? 0);

  // Bill-level discount: explicit absolute wins, else percent of subtotal.
  let billDiscount = 0;
  if (extras.billDiscount && extras.billDiscount > 0) {
    billDiscount = r2(Math.min(extras.billDiscount, subtotal));
  } else if (extras.billDiscountPercent && extras.billDiscountPercent > 0) {
    billDiscount = r2((subtotal * extras.billDiscountPercent) / 100);
  }

  const couponDiscount = r2(Math.max(0, extras.couponDiscount ?? 0));
  const loyaltyRedeemValue = r2(Math.max(0, extras.loyaltyRedeemValue ?? 0));

  const before = r2(
    subtotal + totalGst + packingCharge + serviceCharge + deliveryCharge
    - billDiscount - couponDiscount - loyaltyRedeemValue
  );
  const grandTotal = Math.max(0, Math.round(before));
  const roundOff = r2(grandTotal - before);

  return {
    lines,
    subtotal,
    itemDiscount,
    totalGst,
    cgst,
    sgst,
    packingCharge,
    serviceCharge,
    deliveryCharge,
    billDiscount,
    couponDiscount,
    loyaltyRedeemValue,
    grandTotalBeforeRound: before,
    roundOff,
    grandTotal,
  };
}

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

// Helper function to calculate total weight of grocery items
export function getTotalWeight(cart: CartLine[]): number {
  return cart.reduce((total, line) => {
    return total + (line.weight || 0) * line.quantity;
  }, 0);
}

// Helper function to get item count (for bills)
export function getItemCount(cart: CartLine[]): number {
  return cart.reduce((total, line) => total + line.quantity, 0);
}

// Helper to calculate discount percentage
export function getDiscountPercent(originalPrice: number, discountedPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

// // Bill calculation engine — single source of truth for line + bill totals.
// // Mirrors the rules listed in section 7 of the requirements.

// export type CartLine = {
//   menuItemId: string;
//   name: string;
//   price: number;
//   quantity: number;
//   gstPercent: number;
//   discount?: number; // absolute rupee discount on this line
//   notes?: string;
// };

// export type BillExtras = {
//   packingCharge?: number;
//   serviceCharge?: number;
//   deliveryCharge?: number;
//   billDiscount?: number;          // absolute rupees
//   billDiscountPercent?: number;   // percent applied to subtotal
//   couponDiscount?: number;        // absolute ₹ deduction from a validated coupon
//   loyaltyRedeemValue?: number;    // absolute ₹ deduction from points redemption
// };

// export type ComputedLine = CartLine & {
//   itemTotal: number;
//   taxableAmount: number;
//   gstAmount: number;
//   lineTotal: number;
// };

// export type ComputedBill = {
//   lines: ComputedLine[];
//   subtotal: number;       // sum of taxable amounts
//   itemDiscount: number;   // sum of per-line discounts
//   totalGst: number;
//   cgst: number;
//   sgst: number;
//   packingCharge: number;
//   serviceCharge: number;
//   deliveryCharge: number;
//   billDiscount: number;
//   couponDiscount: number;
//   loyaltyRedeemValue: number;
//   grandTotalBeforeRound: number;
//   roundOff: number;
//   grandTotal: number;
// };

// const r2 = (n: number) => Math.round(n * 100) / 100;

// export function computeBill(cart: CartLine[], extras: BillExtras = {}): ComputedBill {
//   const lines: ComputedLine[] = cart.map((l) => {
//     const itemTotal = r2(l.price * l.quantity);
//     const discount = Math.max(0, Math.min(l.discount ?? 0, itemTotal));
//     const taxableAmount = r2(itemTotal - discount);
//     const gstAmount = r2((taxableAmount * (l.gstPercent || 0)) / 100);
//     return {
//       ...l,
//       itemTotal,
//       taxableAmount,
//       gstAmount,
//       lineTotal: r2(taxableAmount + gstAmount),
//     };
//   });

//   const subtotal = r2(lines.reduce((s, l) => s + l.taxableAmount, 0));
//   const itemDiscount = r2(
//     lines.reduce((s, l) => s + (l.discount ?? 0), 0)
//   );
//   const totalGst = r2(lines.reduce((s, l) => s + l.gstAmount, 0));
//   const cgst = r2(totalGst / 2);
//   const sgst = r2(totalGst - cgst);

//   const packingCharge = r2(extras.packingCharge ?? 0);
//   const serviceCharge = r2(extras.serviceCharge ?? 0);
//   const deliveryCharge = r2(extras.deliveryCharge ?? 0);

//   // Bill-level discount: explicit absolute wins, else percent of subtotal.
//   let billDiscount = 0;
//   if (extras.billDiscount && extras.billDiscount > 0) {
//     billDiscount = r2(Math.min(extras.billDiscount, subtotal));
//   } else if (extras.billDiscountPercent && extras.billDiscountPercent > 0) {
//     billDiscount = r2((subtotal * extras.billDiscountPercent) / 100);
//   }

//   const couponDiscount = r2(Math.max(0, extras.couponDiscount ?? 0));
//   const loyaltyRedeemValue = r2(Math.max(0, extras.loyaltyRedeemValue ?? 0));

//   const before = r2(
//     subtotal + totalGst + packingCharge + serviceCharge + deliveryCharge
//     - billDiscount - couponDiscount - loyaltyRedeemValue
//   );
//   const grandTotal = Math.max(0, Math.round(before));
//   const roundOff = r2(grandTotal - before);

//   return {
//     lines,
//     subtotal,
//     itemDiscount,
//     totalGst,
//     cgst,
//     sgst,
//     packingCharge,
//     serviceCharge,
//     deliveryCharge,
//     billDiscount,
//     couponDiscount,
//     loyaltyRedeemValue,
//     grandTotalBeforeRound: before,
//     roundOff,
//     grandTotal,
//   };
// }

// export const formatINR = (n: number) =>
//   new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency: "INR",
//     maximumFractionDigits: 2,
//   }).format(Number.isFinite(n) ? n : 0);
