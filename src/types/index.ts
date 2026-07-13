export type Role = "ADMIN" | "MANAGER" | "CASHIER" | "KITCHEN";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
