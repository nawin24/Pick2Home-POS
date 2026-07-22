"use client";
import { useEffect, useState } from "react";
import { 
  Plus, Pencil, Trash2, Search, Calendar, Package, AlertTriangle, 
  Upload, RefreshCw
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import ImageUploader from "@/components/ui/ImageUploader";
import ProductImport from "@/components/ProductImport/ProductImport";
import { formatINR } from "@/lib/calc";

// Category type with icon and manufacturing flag
type Cat = { 
  id: string; 
  name: string; 
  icon?: string | null;
  requiresManufacturing?: boolean;
};

// GroceryItem with manufacturing fields
type GroceryItem = {
  id: string;
  name: string;
  price: number;
  mrp: number;               
  gstPercent: number;
  unit: string;             
  stockQuantity: number;    
  minStock: number;         
  brand: string | null;     
  packaging: string | null; 
  isPerishable: boolean;    
  available: boolean;
  description?: string | null;
  imageUrl?: string | null;
  discountEligible: boolean;
  discountPercent: number;  
  categoryId: string;
  category: Cat;
  sku: string;              
  barcode: string | null;   
  hsnCode: string | null;   
  reorderPoint: number;
  isManufactured: boolean;
  manufacturedDate: string | null;
  expiryDate: string | null;
  batchNumber: string | null;
  featured?: boolean;
};

// Empty state with manufacturing fields
const empty: Partial<GroceryItem> = {
  name: "",
  price: 0,
  mrp: 0,
  gstPercent: 5,
  unit: "pcs",
  stockQuantity: 0,
  minStock: 0,
  brand: "",
  packaging: "standard",
  isPerishable: false,
  available: true,
  discountEligible: true,
  discountPercent: 0,
  isManufactured: false,
  manufacturedDate: null,
  expiryDate: null,
  batchNumber: null,
};

export default function MenuPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<GroceryItem>>(empty);
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [newCat, setNewCat] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Delete modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [productNameToDelete, setProductNameToDelete] = useState<string>("");

  async function load() {
    setIsLoading(true);
    try {
      const [m, c] = await Promise.all([
        fetch("/api/menu").then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
      ]);
      setItems(m.items || m);
      setCats(c.categories || c);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const method = editing.id ? "PATCH" : "POST";
    const url = editing.id ? `/api/menu/${editing.id}` : "/api/menu";
    
    if (!editing.name?.trim()) {
      alert("Product name is required");
      return;
    }
    if (editing.price === undefined || editing.price <= 0) {
      alert("Please enter a valid price");
      return;
    }

    if (editing.isManufactured) {
      if (!editing.manufacturedDate) {
        alert("Please select a manufactured date");
        return;
      }
      if (!editing.expiryDate) {
        alert("Please select an expiry date");
        return;
      }
      if (new Date(editing.expiryDate) <= new Date(editing.manufacturedDate)) {
        alert("Expiry date must be after manufactured date");
        return;
      }
    }

    setIsLoading(true);
    try {
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (!r.ok) {
        const error = await r.json();
        alert(error.error || "Failed to save product");
        return;
      }
      setOpen(false);
      setEditing(empty);
      await load();
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save product");
    } finally {
      setIsLoading(false);
    }
  }

  // Open delete confirmation modal
  function remove(id: string, name: string) {
    setProductToDelete(id);
    setProductNameToDelete(name);
    setDeleteModalOpen(true);
  }

  // Confirm and execute delete
  async function confirmDelete() {
    if (!productToDelete) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/menu/${productToDelete}`, { 
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const responseText = await response.text();
      console.log("Response text:", responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(responseText || "Server returned an invalid response");
      }
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete product");
      }
      
      if (result.action === "marked_unavailable") {
        alert("Product has associated orders. It has been marked as unavailable instead.");
      } else if (result.action === "deleted") {
        console.log("Product deleted successfully");
      }
      
      setDeleteModalOpen(false);
      setProductToDelete(null);
      setProductNameToDelete("");
      await load();
      
    } catch (error: any) {
      console.error("Delete error:", error);
      alert(error.message || "Failed to delete product");
    } finally {
      setIsLoading(false);
    }
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    setIsLoading(true);
    try {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCat }),
      });
      setNewCat("");
      await load();
    } catch (error) {
      console.error("Add category error:", error);
      alert("Failed to add category");
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleAvailability(id: string, currentAvailable: boolean) {
    setIsLoading(true);
    try {
      await fetch(`/api/menu/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ available: !currentAvailable }),
      });
      await load();
    } catch (error) {
      console.error("Toggle availability error:", error);
      alert("Failed to update product availability");
    } finally {
      setIsLoading(false);
    }
  }

  // Function to get expiry status
  function getExpiryStatus(item: GroceryItem): { label: string; color: string; bg: string; type: 'expired' | 'expiring' | 'valid' | null } | null {
    if (!item.isManufactured || !item.expiryDate) return null;
    
    const today = new Date();
    const expiryDate = new Date(item.expiryDate);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { 
        label: "Expired", 
        color: "text-red-700",
        bg: "bg-red-100",
        type: 'expired'
      };
    } else if (daysUntilExpiry <= 30) {
      return { 
        label: `Expires in ${daysUntilExpiry}d`, 
        color: "text-orange-700",
        bg: "bg-orange-100",
        type: 'expiring'
      };
    }
    return { 
      label: `${daysUntilExpiry}d left`, 
      color: "text-emerald-700",
      bg: "bg-emerald-100",
      type: 'valid'
    };
  }

  // Filter products
  const filtered = items.filter((i) => {
    const matchesCategory = catFilter ? i.categoryId === catFilter : true;
    const matchesSearch = filter ? i.name.toLowerCase().includes(filter.toLowerCase()) : true;
    
    let matchesStock = true;
    if (stockFilter === "low") {
      matchesStock = i.stockQuantity <= i.minStock && i.stockQuantity > 0;
    } else if (stockFilter === "out") {
      matchesStock = i.stockQuantity <= 0;
    } else if (stockFilter === "in") {
      matchesStock = i.stockQuantity > 0;
    }
    
    let matchesExpiry = true;
    if (expiryFilter === "expiring") {
      const today = new Date();
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      matchesExpiry = i.isManufactured && 
        i.expiryDate !== null &&
        new Date(i.expiryDate) <= thirtyDaysLater &&
        new Date(i.expiryDate) >= today;
    } else if (expiryFilter === "expired") {
      const today = new Date();
      matchesExpiry = i.isManufactured && 
        i.expiryDate !== null &&
        new Date(i.expiryDate) < today;
    }
    
    return matchesCategory && matchesSearch && matchesStock && matchesExpiry;
  });

  function getStockStatus(item: GroceryItem): { label: string; color: string; bg: string } {
    if (item.stockQuantity <= 0) {
      return { 
        label: "Out of Stock", 
        color: "text-red-700",
        bg: "bg-red-100"
      };
    }
    if (item.stockQuantity <= item.minStock) {
      return { 
        label: "Low Stock", 
        color: "text-yellow-700",
        bg: "bg-yellow-100"
      };
    }
    return { 
      label: `${item.stockQuantity} ${item.unit}`, 
      color: "text-emerald-700",
      bg: "bg-emerald-100"
    };
  }

  // Statistics - Separate expired and expiring
  const totalProducts = items.length;
  const inStockCount = items.filter(i => i.stockQuantity > 0).length;
  const lowStockCount = items.filter(i => i.stockQuantity <= i.minStock && i.stockQuantity > 0).length;
  const outOfStockCount = items.filter(i => i.stockQuantity <= 0).length;
  
  const expiringCount = items.filter(i => {
    if (!i.isManufactured || !i.expiryDate) return false;
    const today = new Date();
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const expiryDate = new Date(i.expiryDate);
    return expiryDate <= thirtyDaysLater && expiryDate >= today;
  }).length;
  
  const expiredCount = items.filter(i => {
    if (!i.isManufactured || !i.expiryDate) return false;
    return new Date(i.expiryDate) < new Date();
  }).length;

  // Statistics click handlers
  const handleStatClick = (type: string) => {
    setFilter("");
    setCatFilter("");
    setStockFilter("");
    setExpiryFilter("");
    
    switch(type) {
      case 'all':
        // Clear all filters
        break;
      case 'instock':
        setStockFilter('in');
        break;
      case 'lowstock':
        setStockFilter('low');
        break;
      case 'outofstock':
        setStockFilter('out');
        break;
      case 'expiring':
        setExpiryFilter('expiring');
        break;
      case 'expired':
        setExpiryFilter('expired');
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your inventory and product details</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
          >
            <Upload size={16} className="mr-2" /> Import
          </button>
          <button
            onClick={() => {
              setEditing({ ...empty, categoryId: cats[0]?.id });
              setOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus size={16} className="mr-2" /> Add Product
          </button>
        </div>
      </div>

      {/* Statistics Cards - Clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-emerald-400"
          onClick={() => handleStatClick('all')}
        >
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
        </div>
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-emerald-400"
          onClick={() => handleStatClick('instock')}
        >
          <p className="text-sm text-gray-500">In Stock</p>
          <p className="text-2xl font-bold text-emerald-600">{inStockCount}</p>
        </div>
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-yellow-400"
          onClick={() => handleStatClick('lowstock')}
        >
          <p className="text-sm text-gray-500">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
        </div>
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-red-400"
          onClick={() => handleStatClick('outofstock')}
        >
          <p className="text-sm text-gray-500">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
        </div>
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-orange-400"
          onClick={() => handleStatClick('expiring')}
        >
          <p className="text-sm text-gray-500">Expiring Soon</p>
          <p className="text-2xl font-bold text-orange-600">{expiringCount}</p>
        </div>
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-red-400"
          onClick={() => handleStatClick('expired')}
        >
          <p className="text-sm text-gray-500">Expired</p>
          <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Search products..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          
          <select
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[160px]"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          
          <select
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[140px]"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="">All stock</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>

          <select
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[150px]"
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value)}
          >
            <option value="">All expiry</option>
            <option value="expiring">Expiring Soon (30 days)</option>
            <option value="expired">Expired</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <input
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-40"
              placeholder="New category…"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
            />
            <button 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              onClick={addCategory}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={32} className="text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((i) => {
                  const stockStatus = getStockStatus(i);
                  const expiryStatus = getExpiryStatus(i);
                  return (
                    <tr key={i.id} className={`hover:bg-gray-50 transition-colors ${
                      expiryStatus?.type === 'expired' ? 'bg-red-50' : 
                      expiryStatus?.type === 'expiring' ? 'bg-orange-50' : ''
                    }`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {i.imageUrl ? (
                            <img
                              src={i.imageUrl}
                              alt={i.name}
                              className="w-10 h-10 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Package size={16} className="text-gray-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{i.name}</div>
                            <div className="text-xs text-gray-500 font-mono">SKU: {i.sku}</div>
                            {i.isManufactured && i.batchNumber && (
                              <div className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                                <Package size={10} /> Batch: {i.batchNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {i.category?.icon} {i.category?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{i.brand || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatINR(i.price)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400 line-through">{formatINR(i.mrp)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{i.unit}</td>
                      <td className="px-4 py-3 text-center">
                        {expiryStatus ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expiryStatus.bg} ${expiryStatus.color}`}>
                            <Calendar size={10} className="mr-1" />
                            {expiryStatus.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <button
                            onClick={() => toggleAvailability(i.id, i.available)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                              i.available
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            {i.available ? "Available" : "Disabled"}
                          </button>
                          {i.isPerishable && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              Perishable
                            </span>
                          )}
                          {i.isManufactured && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                              Manufactured
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            onClick={() => {
                              setEditing(i);
                              setOpen(true);
                            }}
                            title="Edit product"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => remove(i.id, i.name)}
                            disabled={isLoading}
                            title="Delete product"
                          >
                            {isLoading && productToDelete === i.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      {filter || catFilter || stockFilter || expiryFilter ? (
                        <div>
                          <Search size={32} className="mx-auto text-gray-300 mb-2" />
                          <p>No products match your filters</p>
                          <button 
                            className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
                            onClick={() => {
                              setFilter("");
                              setCatFilter("");
                              setStockFilter("");
                              setExpiryFilter("");
                            }}
                          >
                            Clear all filters
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Package size={32} className="mx-auto text-gray-300 mb-2" />
                          <p>No products found</p>
                          <button 
                            className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
                            onClick={() => {
                              setEditing({ ...empty, categoryId: cats[0]?.id });
                              setOpen(true);
                            }}
                          >
                            Add your first product
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Table Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
          <div>
            Showing {filtered.length} of {items.length} products
          </div>
          <div>
            <button 
              className="text-emerald-600 hover:text-emerald-700 font-medium"
              onClick={load}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              {editing.id ? <Pencil size={20} className="text-emerald-600" /> : <Plus size={20} className="text-emerald-600" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{editing.id ? "Edit Product" : "Add Product"}</h2>
              <p className="text-sm text-gray-500">{editing.id ? "Update product details" : "Create a new product"}</p>
            </div>
          </div>
        }
        footer={
          <div className="flex gap-3">
            <button 
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
              onClick={save}
              disabled={isLoading}
            >
              {isLoading && <RefreshCw size={16} className="animate-spin" />}
              {editing.id ? "Update" : "Create"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <label className="col-span-2">
            <span className="text-sm font-medium text-gray-700">Product Name <span className="text-red-500">*</span></span>
            <input
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.name ?? ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Enter product name"
            />
          </label>

          {/* Category & SKU */}
          <label>
            <span className="text-sm font-medium text-gray-700">Category <span className="text-red-500">*</span></span>
            <select
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.categoryId ?? ""}
              onChange={(e) => {
                const selectedCat = cats.find(c => c.id === e.target.value);
                setEditing({ 
                  ...editing, 
                  categoryId: e.target.value,
                  isManufactured: selectedCat?.requiresManufacturing || editing.isManufactured || false
                });
              }}
            >
              <option value="">Select category</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name} {c.requiresManufacturing ? '🏭' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-gray-700">SKU</span>
            <input
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Auto-generated if empty"
              value={editing.sku ?? ""}
              onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
            />
          </label>

          {/* Barcode & Brand */}
          <label>
            <span className="text-sm font-medium text-gray-700">Barcode</span>
            <input
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Scan or enter barcode"
              value={editing.barcode ?? ""}
              onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
            />
          </label>
          <label>
            <span className="text-sm font-medium text-gray-700">Brand</span>
            <input
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.brand ?? ""}
              onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
              placeholder="Enter brand name"
            />
          </label>

          {/* Pricing */}
          <label>
            <span className="text-sm font-medium text-gray-700">Selling Price (₹) <span className="text-red-500">*</span></span>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.price ?? 0}
              onChange={(e) =>
                setEditing({ ...editing, price: Number(e.target.value) })
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-gray-700">MRP (₹)</span>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.mrp ?? 0}
              onChange={(e) =>
                setEditing({ ...editing, mrp: Number(e.target.value) })
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </label>

          {/* Unit & Packaging */}
          <label>
            <span className="text-sm font-medium text-gray-700">Unit <span className="text-red-500">*</span></span>
            <select
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.unit ?? "pcs"}
              onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
            >
              <option value="kg">Kilogram (kg)</option>
              <option value="gm">Gram (gm)</option>
              <option value="ltr">Litre (ltr)</option>
              <option value="ml">Millilitre (ml)</option>
              <option value="pcs">Pieces (pcs)</option>
              <option value="packet">Packet</option>
              <option value="box">Box</option>
              <option value="bottle">Bottle</option>
              <option value="dozen">Dozen</option>
              <option value="bunch">Bunch</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-gray-700">Packaging</span>
            <select
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.packaging ?? "standard"}
              onChange={(e) =>
                setEditing({ ...editing, packaging: e.target.value })
              }
            >
              <option value="loose">Loose</option>
              <option value="packet">Packet</option>
              <option value="box">Box</option>
              <option value="bottle">Bottle</option>
              <option value="can">Can</option>
              <option value="standard">Standard</option>
            </select>
          </label>

          {/* Stock Management */}
          <label>
            <span className="text-sm font-medium text-gray-700">Stock Quantity</span>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.stockQuantity ?? 0}
              onChange={(e) =>
                setEditing({ ...editing, stockQuantity: Number(e.target.value) })
              }
              min="0"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-gray-700">Minimum Stock Alert</span>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.minStock ?? 0}
              onChange={(e) =>
                setEditing({ ...editing, minStock: Number(e.target.value) })
              }
              min="0"
            />
          </label>

          {/* GST & HSN */}
          <label>
            <span className="text-sm font-medium text-gray-700">GST %</span>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={editing.gstPercent ?? 5}
              onChange={(e) =>
                setEditing({ ...editing, gstPercent: Number(e.target.value) })
              }
              min="0"
              max="100"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-gray-700">HSN Code</span>
            <input
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g., 08081000"
              value={editing.hsnCode ?? ""}
              onChange={(e) => setEditing({ ...editing, hsnCode: e.target.value })}
            />
          </label>

          {/* Manufacturing & Expiry Fields */}
          <div className="col-span-2 border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="isManufactured"
                checked={editing.isManufactured ?? false}
                onChange={(e) => {
                  const isManufactured = e.target.checked;
                  setEditing({ 
                    ...editing, 
                    isManufactured,
                    manufacturedDate: isManufactured ? new Date().toISOString().split('T')[0] : null,
                    expiryDate: isManufactured ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
                    batchNumber: isManufactured ? `BATCH-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.random().toString(36).substring(2,6).toUpperCase()}` : null,
                  })
                }}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="isManufactured" className="text-sm font-medium text-gray-700">
                This product has manufacturing/expiry tracking
              </label>
            </div>

            {editing.isManufactured && (
              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="text-sm font-medium text-gray-700">Manufactured Date</span>
                  <input
                    type="date"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={editing.manufacturedDate ? new Date(editing.manufacturedDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditing({ 
                      ...editing, 
                      manufacturedDate: e.target.value ? new Date(e.target.value).toISOString() : null 
                    })}
                  />
                </label>
                <label>
                  <span className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></span>
                  <input
                    type="date"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={editing.expiryDate ? new Date(editing.expiryDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditing({ 
                      ...editing, 
                      expiryDate: e.target.value ? new Date(e.target.value).toISOString() : null 
                    })}
                  />
                </label>
                <label className="col-span-2">
                  <span className="text-sm font-medium text-gray-700">Batch/Lot Number</span>
                  <input
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter batch number (auto-generated if empty)"
                    value={editing.batchNumber ?? ''}
                    onChange={(e) => setEditing({ ...editing, batchNumber: e.target.value })}
                  />
                </label>
                <div className="col-span-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <AlertTriangle size={14} />
                  Products with expiry dates will show alerts when nearing expiration
                </div>
              </div>
            )}
          </div>

          {/* Image */}
          <div className="col-span-2">
            <ImageUploader
              label="Product Image"
              folder="menu"
              value={editing.imageUrl ?? ""}
              onChange={(url) => setEditing({ ...editing, imageUrl: url })}
            />
          </div>

          {/* Description */}
          <label className="col-span-2">
            <span className="text-sm font-medium text-gray-700">Description</span>
            <textarea
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={3}
              value={editing.description ?? ""}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
              placeholder="Enter product description"
            />
          </label>

          {/* Checkboxes */}
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editing.available ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, available: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              Available for sale
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editing.discountEligible ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, discountEligible: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              Discount eligible
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editing.isPerishable ?? false}
                onChange={(e) =>
                  setEditing({ ...editing, isPerishable: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              Perishable item
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editing.featured ?? false}
                onChange={(e) =>
                  setEditing({ ...editing, featured: e.target.checked })
                }
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              Featured product
            </label>
          </div>

          {/* Discount Percent */}
          <label className="col-span-2">
            <span className="text-sm font-medium text-gray-700">Discount Percent</span>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              min="0"
              max="100"
              value={editing.discountPercent ?? 0}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  discountPercent: Number(e.target.value),
                })
              }
              placeholder="0"
            />
          </label>
        </div>
      </Modal>

      {/* Import Modal */}
      <ProductImport
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={load}
        categories={cats}
        existingItems={items}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
          setProductNameToDelete("");
        }}
        size="sm"
        title="Delete Product"
        footer={
          <div className="flex gap-3">
            <button
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              onClick={() => {
                setDeleteModalOpen(false);
                setProductToDelete(null);
                setProductNameToDelete("");
              }}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={confirmDelete}
              disabled={isLoading}
            >
              {isLoading && <RefreshCw size={16} className="animate-spin" />}
              Delete Product
            </button>
          </div>
        }
      >
        <div className="py-4">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertTriangle size={24} />
            <p className="font-medium">Delete this product?</p>
          </div>
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{productNameToDelete}"</span>?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This action cannot be undone. The product will be permanently removed from the system.
          </p>
          {productToDelete && (
            <p className="text-xs text-gray-400 mt-3">
              Product ID: {productToDelete}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
























// "use client";
// import { useEffect, useState } from "react";
// import { 
//   Plus, Pencil, Trash2, Search, Calendar, Package, AlertTriangle, 
//   Upload, RefreshCw
// } from "lucide-react";
// import Modal from "@/components/ui/Modal";
// import ImageUploader from "@/components/ui/ImageUploader";
// import ProductImport from "@/components/ProductImport/ProductImport";
// import { formatINR } from "@/lib/calc";

// // Category type with icon and manufacturing flag
// type Cat = { 
//   id: string; 
//   name: string; 
//   icon?: string | null;
//   requiresManufacturing?: boolean;
// };

// // GroceryItem with manufacturing fields
// type GroceryItem = {
//   id: string;
//   name: string;
//   price: number;
//   mrp: number;               
//   gstPercent: number;
//   unit: string;             
//   stockQuantity: number;    
//   minStock: number;         
//   brand: string | null;     
//   packaging: string | null; 
//   isPerishable: boolean;    
//   available: boolean;
//   description?: string | null;
//   imageUrl?: string | null;
//   discountEligible: boolean;
//   discountPercent: number;  
//   categoryId: string;
//   category: Cat;
//   sku: string;              
//   barcode: string | null;   
//   hsnCode: string | null;   
//   reorderPoint: number;
//   isManufactured: boolean;
//   manufacturedDate: string | null;
//   expiryDate: string | null;
//   batchNumber: string | null;
//   featured?: boolean;
// };

// // Empty state with manufacturing fields
// const empty: Partial<GroceryItem> = {
//   name: "",
//   price: 0,
//   mrp: 0,
//   gstPercent: 5,
//   unit: "pcs",
//   stockQuantity: 0,
//   minStock: 0,
//   brand: "",
//   packaging: "standard",
//   isPerishable: false,
//   available: true,
//   discountEligible: true,
//   discountPercent: 0,
//   isManufactured: false,
//   manufacturedDate: null,
//   expiryDate: null,
//   batchNumber: null,
// };

// export default function MenuPage() {
//   const [items, setItems] = useState<GroceryItem[]>([]);
//   const [cats, setCats] = useState<Cat[]>([]);
//   const [open, setOpen] = useState(false);
//   const [editing, setEditing] = useState<Partial<GroceryItem>>(empty);
//   const [filter, setFilter] = useState("");
//   const [catFilter, setCatFilter] = useState("");
//   const [newCat, setNewCat] = useState("");
//   const [stockFilter, setStockFilter] = useState("");
//   const [expiryFilter, setExpiryFilter] = useState("");
//   const [importModalOpen, setImportModalOpen] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
  
//   // Delete modal states
//   const [deleteModalOpen, setDeleteModalOpen] = useState(false);
//   const [productToDelete, setProductToDelete] = useState<string | null>(null);
//   const [productNameToDelete, setProductNameToDelete] = useState<string>("");

//   async function load() {
//     setIsLoading(true);
//     try {
//       const [m, c] = await Promise.all([
//         fetch("/api/menu").then((r) => r.json()),
//         fetch("/api/categories").then((r) => r.json()),
//       ]);
//       setItems(m.items || m);
//       setCats(c.categories || c);
//     } catch (error) {
//       console.error("Failed to load data:", error);
//     } finally {
//       setIsLoading(false);
//     }
//   }
//   useEffect(() => { load(); }, []);

//   async function save() {
//     const method = editing.id ? "PATCH" : "POST";
//     const url = editing.id ? `/api/menu/${editing.id}` : "/api/menu";
    
//     if (!editing.name?.trim()) {
//       alert("Product name is required");
//       return;
//     }
//     if (editing.price === undefined || editing.price <= 0) {
//       alert("Please enter a valid price");
//       return;
//     }

//     if (editing.isManufactured) {
//       if (!editing.manufacturedDate) {
//         alert("Please select a manufactured date");
//         return;
//       }
//       if (!editing.expiryDate) {
//         alert("Please select an expiry date");
//         return;
//       }
//       if (new Date(editing.expiryDate) <= new Date(editing.manufacturedDate)) {
//         alert("Expiry date must be after manufactured date");
//         return;
//       }
//     }

//     setIsLoading(true);
//     try {
//       const r = await fetch(url, {
//         method,
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify(editing),
//       });
//       if (!r.ok) {
//         const error = await r.json();
//         alert(error.error || "Failed to save product");
//         return;
//       }
//       setOpen(false);
//       setEditing(empty);
//       await load();
//     } catch (error) {
//       console.error("Save error:", error);
//       alert("Failed to save product");
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   // Open delete confirmation modal
//   function remove(id: string, name: string) {
//     setProductToDelete(id);
//     setProductNameToDelete(name);
//     setDeleteModalOpen(true);
//   }

//   // Confirm and execute delete
// // Confirm and execute delete
// async function confirmDelete() {
//   if (!productToDelete) return;
  
//   setIsLoading(true);
//   try {
//     const response = await fetch(`/api/menu/${productToDelete}`, { 
//       method: "DELETE",
//       headers: {
//         'Content-Type': 'application/json',
//       }
//     });
    
//     // First try to get the response as text
//     const responseText = await response.text();
//     console.log("Response text:", responseText);
    
//     let result;
//     try {
//       // Try to parse as JSON
//       result = JSON.parse(responseText);
//     } catch (parseError) {
//       // If not JSON, throw error with the text
//       throw new Error(responseText || "Server returned an invalid response");
//     }
    
//     if (!response.ok) {
//       throw new Error(result.error || "Failed to delete product");
//     }
    
//     // Handle different response actions
//     if (result.action === "marked_unavailable") {
//       alert("Product has associated orders. It has been marked as unavailable instead.");
//     } else if (result.action === "deleted") {
//       console.log("Product deleted successfully");
//     }
    
//     // Close modal and refresh
//     setDeleteModalOpen(false);
//     setProductToDelete(null);
//     setProductNameToDelete("");
//     await load();
    
//   } catch (error: any) {
//     console.error("Delete error:", error);
//     alert(error.message || "Failed to delete product");
//   } finally {
//     setIsLoading(false);
//   }
// }

//   async function addCategory() {
//     if (!newCat.trim()) return;
//     setIsLoading(true);
//     try {
//       await fetch("/api/categories", {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ name: newCat }),
//       });
//       setNewCat("");
//       await load();
//     } catch (error) {
//       console.error("Add category error:", error);
//       alert("Failed to add category");
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   async function toggleAvailability(id: string, currentAvailable: boolean) {
//     setIsLoading(true);
//     try {
//       await fetch(`/api/menu/${id}`, {
//         method: "PATCH",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ available: !currentAvailable }),
//       });
//       await load();
//     } catch (error) {
//       console.error("Toggle availability error:", error);
//       alert("Failed to update product availability");
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   // Filter products
//   const filtered = items.filter((i) => {
//     const matchesCategory = catFilter ? i.categoryId === catFilter : true;
//     const matchesSearch = filter ? i.name.toLowerCase().includes(filter.toLowerCase()) : true;
//     let matchesStock = true;
//     if (stockFilter === "low") {
//       matchesStock = i.stockQuantity <= i.minStock;
//     } else if (stockFilter === "out") {
//       matchesStock = i.stockQuantity <= 0;
//     } else if (stockFilter === "in") {
//       matchesStock = i.stockQuantity > 0;
//     }
    
//     let matchesExpiry = true;
//     if (expiryFilter === "expiring") {
//       const today = new Date();
//       const thirtyDaysLater = new Date(today);
//       thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
//       matchesExpiry = i.isManufactured && 
//         i.expiryDate !== null &&
//         new Date(i.expiryDate) <= thirtyDaysLater &&
//         new Date(i.expiryDate) >= today;
//     } else if (expiryFilter === "expired") {
//       const today = new Date();
//       matchesExpiry = i.isManufactured && 
//         i.expiryDate !== null &&
//         new Date(i.expiryDate) < today;
//     }
    
//     return matchesCategory && matchesSearch && matchesStock && matchesExpiry;
//   });

//   function getStockStatus(item: GroceryItem): { label: string; color: string; bg: string } {
//     if (item.stockQuantity <= 0) {
//       return { 
//         label: "Out of Stock", 
//         color: "text-red-700",
//         bg: "bg-red-100"
//       };
//     }
//     if (item.stockQuantity <= item.minStock) {
//       return { 
//         label: "Low Stock", 
//         color: "text-yellow-700",
//         bg: "bg-yellow-100"
//       };
//     }
//     return { 
//       label: `${item.stockQuantity} ${item.unit}`, 
//       color: "text-emerald-700",
//       bg: "bg-emerald-100"
//     };
//   }

//   function getExpiryStatus(item: GroceryItem): { label: string; color: string; bg: string } | null {
//     if (!item.isManufactured || !item.expiryDate) return null;
    
//     const today = new Date();
//     const expiryDate = new Date(item.expiryDate);
//     const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
//     if (daysUntilExpiry < 0) {
//       return { 
//         label: "Expired", 
//         color: "text-red-700",
//         bg: "bg-red-100"
//       };
//     } else if (daysUntilExpiry <= 7) {
//       return { 
//         label: `Expires in ${daysUntilExpiry}d`, 
//         color: "text-red-700",
//         bg: "bg-red-100"
//       };
//     } else if (daysUntilExpiry <= 30) {
//       return { 
//         label: `Expires in ${daysUntilExpiry}d`, 
//         color: "text-yellow-700",
//         bg: "bg-yellow-100"
//       };
//     }
//     return { 
//       label: `${daysUntilExpiry}d left`, 
//       color: "text-emerald-700",
//       bg: "bg-emerald-100"
//     };
//   }

//   // Statistics
//   const totalProducts = items.length;
//   const lowStockCount = items.filter(i => i.stockQuantity <= i.minStock && i.stockQuantity > 0).length;
//   const outOfStockCount = items.filter(i => i.stockQuantity <= 0).length;
//   const expiringCount = items.filter(i => {
//     if (!i.isManufactured || !i.expiryDate) return false;
//     const today = new Date();
//     const thirtyDaysLater = new Date(today);
//     thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
//     const expiryDate = new Date(i.expiryDate);
//     return expiryDate <= thirtyDaysLater && expiryDate >= today;
//   }).length;
//   const expiredCount = items.filter(i => {
//     if (!i.isManufactured || !i.expiryDate) return false;
//     return new Date(i.expiryDate) < new Date();
//   }).length;

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
//           <p className="text-sm text-gray-500 mt-1">Manage your inventory and product details</p>
//         </div>
//         <div className="flex flex-wrap gap-2">
//           <button
//             onClick={() => setImportModalOpen(true)}
//             className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
//           >
//             <Upload size={16} className="mr-2" /> Import
//           </button>
//           <button
//             onClick={() => {
//               setEditing({ ...empty, categoryId: cats[0]?.id });
//               setOpen(true);
//             }}
//             className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
//           >
//             <Plus size={16} className="mr-2" /> Add Product
//           </button>
//         </div>
//       </div>

//       {/* Statistics Cards */}
//       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Total Products</p>
//           <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">In Stock</p>
//           <p className="text-2xl font-bold text-emerald-600">
//             {items.filter(i => i.stockQuantity > 0).length}
//           </p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Low Stock</p>
//           <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Out of Stock</p>
//           <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Expiring Soon</p>
//           <p className="text-2xl font-bold text-orange-600">{expiringCount + expiredCount}</p>
//         </div>
//       </div>

//       {/* Filters */}
//       <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//         <div className="flex flex-wrap gap-3 items-center">
//           <div className="relative flex-1 min-w-[200px]">
//             <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
//             <input
//               className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="Search products..."
//               value={filter}
//               onChange={(e) => setFilter(e.target.value)}
//             />
//           </div>
          
//           <select
//             className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[160px]"
//             value={catFilter}
//             onChange={(e) => setCatFilter(e.target.value)}
//           >
//             <option value="">All categories</option>
//             {cats.map((c) => (
//               <option key={c.id} value={c.id}>
//                 {c.icon} {c.name}
//               </option>
//             ))}
//           </select>
          
//           <select
//             className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[140px]"
//             value={stockFilter}
//             onChange={(e) => setStockFilter(e.target.value)}
//           >
//             <option value="">All stock</option>
//             <option value="in">In Stock</option>
//             <option value="low">Low Stock</option>
//             <option value="out">Out of Stock</option>
//           </select>

//           <select
//             className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[150px]"
//             value={expiryFilter}
//             onChange={(e) => setExpiryFilter(e.target.value)}
//           >
//             <option value="">All expiry</option>
//             <option value="expiring">Expiring Soon (30 days)</option>
//             <option value="expired">Expired</option>
//           </select>

//           <div className="flex items-center gap-2 ml-auto">
//             <input
//               className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-40"
//               placeholder="New category…"
//               value={newCat}
//               onChange={(e) => setNewCat(e.target.value)}
//               onKeyPress={(e) => e.key === 'Enter' && addCategory()}
//             />
//             <button 
//               className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
//               onClick={addCategory}
//             >
//               Add
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Product Table */}
//       <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
//         {isLoading ? (
//           <div className="flex items-center justify-center py-12">
//             <RefreshCw size={32} className="text-emerald-500 animate-spin" />
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b border-gray-200">
//                 <tr>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
//                   <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
//                   <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
//                   <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-100">
//                 {filtered.map((i) => {
//                   const stockStatus = getStockStatus(i);
//                   const expiryStatus = getExpiryStatus(i);
//                   return (
//                     <tr key={i.id} className="hover:bg-gray-50 transition-colors">
//                       <td className="px-4 py-3">
//                         <div className="flex items-center gap-3">
//                           {i.imageUrl ? (
//                             <img
//                               src={i.imageUrl}
//                               alt={i.name}
//                               className="w-10 h-10 object-cover rounded-lg"
//                             />
//                           ) : (
//                             <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
//                               <Package size={16} className="text-gray-400" />
//                             </div>
//                           )}
//                           <div>
//                             <div className="font-medium text-gray-900">{i.name}</div>
//                             <div className="text-xs text-gray-500 font-mono">SKU: {i.sku}</div>
//                             {i.isManufactured && i.batchNumber && (
//                               <div className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
//                                 <Package size={10} /> Batch: {i.batchNumber}
//                               </div>
//                             )}
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-4 py-3">
//                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
//                           {i.category?.icon} {i.category?.name}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-sm text-gray-600">{i.brand || "-"}</td>
//                       <td className="px-4 py-3 text-right font-medium text-gray-900">{formatINR(i.price)}</td>
//                       <td className="px-4 py-3 text-right text-sm text-gray-400 line-through">{formatINR(i.mrp)}</td>
//                       <td className="px-4 py-3 text-center">
//                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
//                           {stockStatus.label}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-center text-sm text-gray-600">{i.unit}</td>
//                       <td className="px-4 py-3 text-center">
//                         {expiryStatus ? (
//                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expiryStatus.bg} ${expiryStatus.color}`}>
//                             <Calendar size={10} className="mr-1" />
//                             {expiryStatus.label}
//                           </span>
//                         ) : (
//                           <span className="text-xs text-gray-400">N/A</span>
//                         )}
//                       </td>
//                       <td className="px-4 py-3 text-center">
//                         <div className="flex flex-wrap items-center justify-center gap-1">
//                           <button
//                             onClick={() => toggleAvailability(i.id, i.available)}
//                             className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
//                               i.available
//                                 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
//                                 : "bg-gray-200 text-gray-600 hover:bg-gray-300"
//                             }`}
//                           >
//                             {i.available ? "Available" : "Disabled"}
//                           </button>
//                           {i.isPerishable && (
//                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
//                               Perishable
//                             </span>
//                           )}
//                           {i.isManufactured && (
//                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
//                               Manufactured
//                             </span>
//                           )}
//                         </div>
//                       </td>
//                       <td className="px-4 py-3 text-right">
//                         <div className="flex items-center justify-end gap-1">
//                           <button
//                             className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
//                             onClick={() => {
//                               setEditing(i);
//                               setOpen(true);
//                             }}
//                             title="Edit product"
//                           >
//                             <Pencil size={16} />
//                           </button>
//                           <button
//                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                             onClick={() => remove(i.id, i.name)}
//                             disabled={isLoading}
//                             title="Delete product"
//                           >
//                             {isLoading && productToDelete === i.id ? (
//                               <RefreshCw size={16} className="animate-spin" />
//                             ) : (
//                               <Trash2 size={16} />
//                             )}
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//                 {filtered.length === 0 && (
//                   <tr>
//                     <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
//                       {filter || catFilter || stockFilter || expiryFilter ? (
//                         <div>
//                           <Search size={32} className="mx-auto text-gray-300 mb-2" />
//                           <p>No products match your filters</p>
//                           <button 
//                             className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
//                             onClick={() => {
//                               setFilter("");
//                               setCatFilter("");
//                               setStockFilter("");
//                               setExpiryFilter("");
//                             }}
//                           >
//                             Clear all filters
//                           </button>
//                         </div>
//                       ) : (
//                         <div>
//                           <Package size={32} className="mx-auto text-gray-300 mb-2" />
//                           <p>No products found</p>
//                           <button 
//                             className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
//                             onClick={() => {
//                               setEditing({ ...empty, categoryId: cats[0]?.id });
//                               setOpen(true);
//                             }}
//                           >
//                             Add your first product
//                           </button>
//                         </div>
//                       )}
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         )}
        
//         {/* Table Footer */}
//         <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
//           <div>
//             Showing {filtered.length} of {items.length} products
//           </div>
//           <div>
//             <button 
//               className="text-emerald-600 hover:text-emerald-700 font-medium"
//               onClick={load}
//             >
//               Refresh
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Add/Edit Product Modal */}
//       <Modal
//         open={open}
//         onClose={() => setOpen(false)}
//         size="lg"
//         title={
//           <div className="flex items-center gap-3">
//             <div className="p-2 bg-emerald-100 rounded-lg">
//               {editing.id ? <Pencil size={20} className="text-emerald-600" /> : <Plus size={20} className="text-emerald-600" />}
//             </div>
//             <div>
//               <h2 className="text-xl font-bold text-gray-900">{editing.id ? "Edit Product" : "Add Product"}</h2>
//               <p className="text-sm text-gray-500">{editing.id ? "Update product details" : "Create a new product"}</p>
//             </div>
//           </div>
//         }
//         footer={
//           <div className="flex gap-3">
//             <button 
//               className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
//               onClick={() => setOpen(false)}
//               disabled={isLoading}
//             >
//               Cancel
//             </button>
//             <button 
//               className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
//               onClick={save}
//               disabled={isLoading}
//             >
//               {isLoading && <RefreshCw size={16} className="animate-spin" />}
//               {editing.id ? "Update" : "Create"}
//             </button>
//           </div>
//         }
//       >
//         <div className="grid grid-cols-2 gap-4">
//           {/* Name */}
//           <label className="col-span-2">
//             <span className="text-sm font-medium text-gray-700">Product Name <span className="text-red-500">*</span></span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.name ?? ""}
//               onChange={(e) => setEditing({ ...editing, name: e.target.value })}
//               placeholder="Enter product name"
//             />
//           </label>

//           {/* Category & SKU */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Category <span className="text-red-500">*</span></span>
//             <select
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.categoryId ?? ""}
//               onChange={(e) => {
//                 const selectedCat = cats.find(c => c.id === e.target.value);
//                 setEditing({ 
//                   ...editing, 
//                   categoryId: e.target.value,
//                   isManufactured: selectedCat?.requiresManufacturing || editing.isManufactured || false
//                 });
//               }}
//             >
//               <option value="">Select category</option>
//               {cats.map((c) => (
//                 <option key={c.id} value={c.id}>
//                   {c.icon} {c.name} {c.requiresManufacturing ? '🏭' : ''}
//                 </option>
//               ))}
//             </select>
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">SKU</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="Auto-generated if empty"
//               value={editing.sku ?? ""}
//               onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
//             />
//           </label>

//           {/* Barcode & Brand */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Barcode</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="Scan or enter barcode"
//               value={editing.barcode ?? ""}
//               onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">Brand</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.brand ?? ""}
//               onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
//               placeholder="Enter brand name"
//             />
//           </label>

//           {/* Pricing */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Selling Price (₹) <span className="text-red-500">*</span></span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.price ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, price: Number(e.target.value) })
//               }
//               placeholder="0.00"
//               min="0"
//               step="0.01"
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">MRP (₹)</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.mrp ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, mrp: Number(e.target.value) })
//               }
//               placeholder="0.00"
//               min="0"
//               step="0.01"
//             />
//           </label>

//           {/* Unit & Packaging */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Unit <span className="text-red-500">*</span></span>
//             <select
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.unit ?? "pcs"}
//               onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
//             >
//               <option value="kg">Kilogram (kg)</option>
//               <option value="gm">Gram (gm)</option>
//               <option value="ltr">Litre (ltr)</option>
//               <option value="ml">Millilitre (ml)</option>
//               <option value="pcs">Pieces (pcs)</option>
//               <option value="packet">Packet</option>
//               <option value="box">Box</option>
//               <option value="bottle">Bottle</option>
//               <option value="dozen">Dozen</option>
//               <option value="bunch">Bunch</option>
//             </select>
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">Packaging</span>
//             <select
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.packaging ?? "standard"}
//               onChange={(e) =>
//                 setEditing({ ...editing, packaging: e.target.value })
//               }
//             >
//               <option value="loose">Loose</option>
//               <option value="packet">Packet</option>
//               <option value="box">Box</option>
//               <option value="bottle">Bottle</option>
//               <option value="can">Can</option>
//               <option value="standard">Standard</option>
//             </select>
//           </label>

//           {/* Stock Management */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Stock Quantity</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.stockQuantity ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, stockQuantity: Number(e.target.value) })
//               }
//               min="0"
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">Minimum Stock Alert</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.minStock ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, minStock: Number(e.target.value) })
//               }
//               min="0"
//             />
//           </label>

//           {/* GST & HSN */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">GST %</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.gstPercent ?? 5}
//               onChange={(e) =>
//                 setEditing({ ...editing, gstPercent: Number(e.target.value) })
//               }
//               min="0"
//               max="100"
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">HSN Code</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="e.g., 08081000"
//               value={editing.hsnCode ?? ""}
//               onChange={(e) => setEditing({ ...editing, hsnCode: e.target.value })}
//             />
//           </label>

//           {/* Manufacturing & Expiry Fields */}
//           <div className="col-span-2 border border-gray-200 rounded-xl p-4 bg-gray-50">
//             <div className="flex items-center gap-3 mb-4">
//               <input
//                 type="checkbox"
//                 id="isManufactured"
//                 checked={editing.isManufactured ?? false}
//                 onChange={(e) => {
//                   const isManufactured = e.target.checked;
//                   setEditing({ 
//                     ...editing, 
//                     isManufactured,
//                     manufacturedDate: isManufactured ? new Date().toISOString().split('T')[0] : null,
//                     expiryDate: isManufactured ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
//                     batchNumber: isManufactured ? `BATCH-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.random().toString(36).substring(2,6).toUpperCase()}` : null,
//                   })
//                 }}
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               <label htmlFor="isManufactured" className="text-sm font-medium text-gray-700">
//                 This product has manufacturing/expiry tracking
//               </label>
//             </div>

//             {editing.isManufactured && (
//               <div className="grid grid-cols-2 gap-4">
//                 <label>
//                   <span className="text-sm font-medium text-gray-700">Manufactured Date</span>
//                   <input
//                     type="date"
//                     className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//                     value={editing.manufacturedDate ? new Date(editing.manufacturedDate).toISOString().split('T')[0] : ''}
//                     onChange={(e) => setEditing({ 
//                       ...editing, 
//                       manufacturedDate: e.target.value ? new Date(e.target.value).toISOString() : null 
//                     })}
//                   />
//                 </label>
//                 <label>
//                   <span className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></span>
//                   <input
//                     type="date"
//                     className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//                     value={editing.expiryDate ? new Date(editing.expiryDate).toISOString().split('T')[0] : ''}
//                     onChange={(e) => setEditing({ 
//                       ...editing, 
//                       expiryDate: e.target.value ? new Date(e.target.value).toISOString() : null 
//                     })}
//                   />
//                 </label>
//                 <label className="col-span-2">
//                   <span className="text-sm font-medium text-gray-700">Batch/Lot Number</span>
//                   <input
//                     className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//                     placeholder="Enter batch number (auto-generated if empty)"
//                     value={editing.batchNumber ?? ''}
//                     onChange={(e) => setEditing({ ...editing, batchNumber: e.target.value })}
//                   />
//                 </label>
//                 <div className="col-span-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
//                   <AlertTriangle size={14} />
//                   Products with expiry dates will show alerts when nearing expiration
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Image */}
//           <div className="col-span-2">
//             <ImageUploader
//               label="Product Image"
//               folder="menu"
//               value={editing.imageUrl ?? ""}
//               onChange={(url) => setEditing({ ...editing, imageUrl: url })}
//             />
//           </div>

//           {/* Description */}
//           <label className="col-span-2">
//             <span className="text-sm font-medium text-gray-700">Description</span>
//             <textarea
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               rows={3}
//               value={editing.description ?? ""}
//               onChange={(e) =>
//                 setEditing({ ...editing, description: e.target.value })
//               }
//               placeholder="Enter product description"
//             />
//           </label>

//           {/* Checkboxes */}
//           <div className="col-span-2 grid grid-cols-2 gap-3">
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.available ?? true}
//                 onChange={(e) =>
//                   setEditing({ ...editing, available: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Available for sale
//             </label>
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.discountEligible ?? true}
//                 onChange={(e) =>
//                   setEditing({ ...editing, discountEligible: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Discount eligible
//             </label>
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.isPerishable ?? false}
//                 onChange={(e) =>
//                   setEditing({ ...editing, isPerishable: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Perishable item
//             </label>
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.featured ?? false}
//                 onChange={(e) =>
//                   setEditing({ ...editing, featured: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Featured product
//             </label>
//           </div>

//           {/* Discount Percent */}
//           <label className="col-span-2">
//             <span className="text-sm font-medium text-gray-700">Discount Percent</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               min="0"
//               max="100"
//               value={editing.discountPercent ?? 0}
//               onChange={(e) =>
//                 setEditing({
//                   ...editing,
//                   discountPercent: Number(e.target.value),
//                 })
//               }
//               placeholder="0"
//             />
//           </label>
//         </div>
//       </Modal>

//       {/* Import Modal */}
//       <ProductImport
//         isOpen={importModalOpen}
//         onClose={() => setImportModalOpen(false)}
//         onImportComplete={load}
//         categories={cats}
//         existingItems={items}
//       />

//       {/* Delete Confirmation Modal */}
//       <Modal
//         open={deleteModalOpen}
//         onClose={() => {
//           setDeleteModalOpen(false);
//           setProductToDelete(null);
//           setProductNameToDelete("");
//         }}
//         size="sm"
//         title="Delete Product"
//         footer={
//           <div className="flex gap-3">
//             <button
//               className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
//               onClick={() => {
//                 setDeleteModalOpen(false);
//                 setProductToDelete(null);
//                 setProductNameToDelete("");
//               }}
//               disabled={isLoading}
//             >
//               Cancel
//             </button>
//             <button
//               className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
//               onClick={confirmDelete}
//               disabled={isLoading}
//             >
//               {isLoading && <RefreshCw size={16} className="animate-spin" />}
//               Delete Product
//             </button>
//           </div>
//         }
//       >
//         <div className="py-4">
//           <div className="flex items-center gap-3 text-red-600 mb-4">
//             <AlertTriangle size={24} />
//             <p className="font-medium">Delete this product?</p>
//           </div>
//           <p className="text-gray-600">
//             Are you sure you want to delete <span className="font-semibold text-gray-900">"{productNameToDelete}"</span>?
//           </p>
//           <p className="text-sm text-gray-500 mt-2">
//             This action cannot be undone. The product will be permanently removed from the system.
//           </p>
//           {productToDelete && (
//             <p className="text-xs text-gray-400 mt-3">
//               Product ID: {productToDelete}
//             </p>
//           )}
//         </div>
//       </Modal>
//     </div>
//   );
// }













// "use client";
// import { useEffect, useState } from "react";
// import { 
//   Plus, Pencil, Trash2, Search, Calendar, Package, AlertTriangle, 
//   Upload, RefreshCw
// } from "lucide-react";
// import Modal from "@/components/ui/Modal";
// import ImageUploader from "@/components/ui/ImageUploader";
// import ProductImport from "@/components/ProductImport/ProductImport";
// import { formatINR } from "@/lib/calc";

// // Category type with icon and manufacturing flag
// type Cat = { 
//   id: string; 
//   name: string; 
//   icon?: string | null;
//   requiresManufacturing?: boolean;
// };

// // GroceryItem with manufacturing fields
// type GroceryItem = {
//   id: string;
//   name: string;
//   price: number;
//   mrp: number;               
//   gstPercent: number;
//   unit: string;             
//   stockQuantity: number;    
//   minStock: number;         
//   brand: string | null;     
//   packaging: string | null; 
//   isPerishable: boolean;    
//   available: boolean;
//   description?: string | null;
//   imageUrl?: string | null;
//   discountEligible: boolean;
//   discountPercent: number;  
//   categoryId: string;
//   category: Cat;
//   sku: string;              
//   barcode: string | null;   
//   hsnCode: string | null;   
//   reorderPoint: number;
//   isManufactured: boolean;
//   manufacturedDate: string | null;
//   expiryDate: string | null;
//   batchNumber: string | null;
//   featured?: boolean;
// };

// // Empty state with manufacturing fields
// const empty: Partial<GroceryItem> = {
//   name: "",
//   price: 0,
//   mrp: 0,
//   gstPercent: 5,
//   unit: "pcs",
//   stockQuantity: 0,
//   minStock: 0,
//   brand: "",
//   packaging: "standard",
//   isPerishable: false,
//   available: true,
//   discountEligible: true,
//   discountPercent: 0,
//   isManufactured: false,
//   manufacturedDate: null,
//   expiryDate: null,
//   batchNumber: null,
// };

// export default function MenuPage() {
//   const [items, setItems] = useState<GroceryItem[]>([]);
//   const [cats, setCats] = useState<Cat[]>([]);
//   const [open, setOpen] = useState(false);
//   const [editing, setEditing] = useState<Partial<GroceryItem>>(empty);
//   const [filter, setFilter] = useState("");
//   const [catFilter, setCatFilter] = useState("");
//   const [newCat, setNewCat] = useState("");
//   const [stockFilter, setStockFilter] = useState("");
//   const [expiryFilter, setExpiryFilter] = useState("");
//   const [importModalOpen, setImportModalOpen] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);

//   async function load() {
//     setIsLoading(true);
//     try {
//       const [m, c] = await Promise.all([
//         fetch("/api/menu").then((r) => r.json()),
//         fetch("/api/categories").then((r) => r.json()),
//       ]);
//       setItems(m.items || m);
//       setCats(c.categories || c);
//     } catch (error) {
//       console.error("Failed to load data:", error);
//     } finally {
//       setIsLoading(false);
//     }
//   }
//   useEffect(() => { load(); }, []);

//   async function save() {
//     const method = editing.id ? "PATCH" : "POST";
//     const url = editing.id ? `/api/menu/${editing.id}` : "/api/menu";
    
//     if (!editing.name?.trim()) {
//       alert("Product name is required");
//       return;
//     }
//     if (editing.price === undefined || editing.price <= 0) {
//       alert("Please enter a valid price");
//       return;
//     }

//     if (editing.isManufactured) {
//       if (!editing.manufacturedDate) {
//         alert("Please select a manufactured date");
//         return;
//       }
//       if (!editing.expiryDate) {
//         alert("Please select an expiry date");
//         return;
//       }
//       if (new Date(editing.expiryDate) <= new Date(editing.manufacturedDate)) {
//         alert("Expiry date must be after manufactured date");
//         return;
//       }
//     }

//     setIsLoading(true);
//     try {
//       const r = await fetch(url, {
//         method,
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify(editing),
//       });
//       if (!r.ok) {
//         const error = await r.json();
//         alert(error.error || "Failed to save product");
//         return;
//       }
//       setOpen(false);
//       setEditing(empty);
//       await load();
//     } catch (error) {
//       console.error("Save error:", error);
//       alert("Failed to save product");
//     } finally {
//       setIsLoading(false);
//     }
//   }

// async function remove(id: string) {
//   if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;
  
//   setIsLoading(true);
//   try {
//     const response = await fetch(`/api/menu/${id}`, { 
//       method: "DELETE",
//       headers: {
//         'Content-Type': 'application/json',
//       }
//     });
    
//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.error || "Failed to delete product");
//     }
    
//     // Refresh the product list
//     await load();
    
//     // Optional: Show success message
//     // You can add a toast notification here
//     console.log('Product deleted successfully');
    
//   } catch (error: any) {
//     console.error("Delete error:", error);
//     alert(error.message || "Failed to delete product");
//   } finally {
//     setIsLoading(false);
//   }
// }

//   async function addCategory() {
//     if (!newCat.trim()) return;
//     setIsLoading(true);
//     try {
//       await fetch("/api/categories", {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ name: newCat }),
//       });
//       setNewCat("");
//       await load();
//     } catch (error) {
//       console.error("Add category error:", error);
//       alert("Failed to add category");
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   async function toggleAvailability(id: string, currentAvailable: boolean) {
//     setIsLoading(true);
//     try {
//       await fetch(`/api/menu/${id}`, {
//         method: "PATCH",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({ available: !currentAvailable }),
//       });
//       await load();
//     } catch (error) {
//       console.error("Toggle availability error:", error);
//       alert("Failed to update product availability");
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   // Filter products
//   const filtered = items.filter((i) => {
//     const matchesCategory = catFilter ? i.categoryId === catFilter : true;
//     const matchesSearch = filter ? i.name.toLowerCase().includes(filter.toLowerCase()) : true;
//     let matchesStock = true;
//     if (stockFilter === "low") {
//       matchesStock = i.stockQuantity <= i.minStock;
//     } else if (stockFilter === "out") {
//       matchesStock = i.stockQuantity <= 0;
//     } else if (stockFilter === "in") {
//       matchesStock = i.stockQuantity > 0;
//     }
    
//     let matchesExpiry = true;
//     if (expiryFilter === "expiring") {
//       const today = new Date();
//       const thirtyDaysLater = new Date(today);
//       thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
//       matchesExpiry = i.isManufactured && 
//         i.expiryDate !== null &&
//         new Date(i.expiryDate) <= thirtyDaysLater &&
//         new Date(i.expiryDate) >= today;
//     } else if (expiryFilter === "expired") {
//       const today = new Date();
//       matchesExpiry = i.isManufactured && 
//         i.expiryDate !== null &&
//         new Date(i.expiryDate) < today;
//     }
    
//     return matchesCategory && matchesSearch && matchesStock && matchesExpiry;
//   });

//   function getStockStatus(item: GroceryItem): { label: string; color: string; bg: string } {
//     if (item.stockQuantity <= 0) {
//       return { 
//         label: "Out of Stock", 
//         color: "text-red-700",
//         bg: "bg-red-100"
//       };
//     }
//     if (item.stockQuantity <= item.minStock) {
//       return { 
//         label: "Low Stock", 
//         color: "text-yellow-700",
//         bg: "bg-yellow-100"
//       };
//     }
//     return { 
//       label: `${item.stockQuantity} ${item.unit}`, 
//       color: "text-emerald-700",
//       bg: "bg-emerald-100"
//     };
//   }

//   function getExpiryStatus(item: GroceryItem): { label: string; color: string; bg: string } | null {
//     if (!item.isManufactured || !item.expiryDate) return null;
    
//     const today = new Date();
//     const expiryDate = new Date(item.expiryDate);
//     const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
//     if (daysUntilExpiry < 0) {
//       return { 
//         label: "Expired", 
//         color: "text-red-700",
//         bg: "bg-red-100"
//       };
//     } else if (daysUntilExpiry <= 7) {
//       return { 
//         label: `Expires in ${daysUntilExpiry}d`, 
//         color: "text-red-700",
//         bg: "bg-red-100"
//       };
//     } else if (daysUntilExpiry <= 30) {
//       return { 
//         label: `Expires in ${daysUntilExpiry}d`, 
//         color: "text-yellow-700",
//         bg: "bg-yellow-100"
//       };
//     }
//     return { 
//       label: `${daysUntilExpiry}d left`, 
//       color: "text-emerald-700",
//       bg: "bg-emerald-100"
//     };
//   }

//   // Statistics
//   const totalProducts = items.length;
//   const lowStockCount = items.filter(i => i.stockQuantity <= i.minStock && i.stockQuantity > 0).length;
//   const outOfStockCount = items.filter(i => i.stockQuantity <= 0).length;
//   const expiringCount = items.filter(i => {
//     if (!i.isManufactured || !i.expiryDate) return false;
//     const today = new Date();
//     const thirtyDaysLater = new Date(today);
//     thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
//     const expiryDate = new Date(i.expiryDate);
//     return expiryDate <= thirtyDaysLater && expiryDate >= today;
//   }).length;
//   const expiredCount = items.filter(i => {
//     if (!i.isManufactured || !i.expiryDate) return false;
//     return new Date(i.expiryDate) < new Date();
//   }).length;

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
//           <p className="text-sm text-gray-500 mt-1">Manage your inventory and product details</p>
//         </div>
//         <div className="flex flex-wrap gap-2">
//           <button
//             onClick={() => setImportModalOpen(true)}
//             className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
//           >
//             <Upload size={16} className="mr-2" /> Import
//           </button>
//           <button
//             onClick={() => {
//               setEditing({ ...empty, categoryId: cats[0]?.id });
//               setOpen(true);
//             }}
//             className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
//           >
//             <Plus size={16} className="mr-2" /> Add Product
//           </button>
//         </div>
//       </div>

//       {/* Statistics Cards */}
//       <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Total Products</p>
//           <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">In Stock</p>
//           <p className="text-2xl font-bold text-emerald-600">
//             {items.filter(i => i.stockQuantity > 0).length}
//           </p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Low Stock</p>
//           <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Out of Stock</p>
//           <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
//         </div>
//         <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//           <p className="text-sm text-gray-500">Expiring Soon</p>
//           <p className="text-2xl font-bold text-orange-600">{expiringCount + expiredCount}</p>
//         </div>
//       </div>

//       {/* Filters */}
//       <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
//         <div className="flex flex-wrap gap-3 items-center">
//           <div className="relative flex-1 min-w-[200px]">
//             <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
//             <input
//               className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="Search products..."
//               value={filter}
//               onChange={(e) => setFilter(e.target.value)}
//             />
//           </div>
          
//           <select
//             className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[160px]"
//             value={catFilter}
//             onChange={(e) => setCatFilter(e.target.value)}
//           >
//             <option value="">All categories</option>
//             {cats.map((c) => (
//               <option key={c.id} value={c.id}>
//                 {c.icon} {c.name}
//               </option>
//             ))}
//           </select>
          
//           <select
//             className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[140px]"
//             value={stockFilter}
//             onChange={(e) => setStockFilter(e.target.value)}
//           >
//             <option value="">All stock</option>
//             <option value="in">In Stock</option>
//             <option value="low">Low Stock</option>
//             <option value="out">Out of Stock</option>
//           </select>

//           <select
//             className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-w-[150px]"
//             value={expiryFilter}
//             onChange={(e) => setExpiryFilter(e.target.value)}
//           >
//             <option value="">All expiry</option>
//             <option value="expiring">Expiring Soon (30 days)</option>
//             <option value="expired">Expired</option>
//           </select>

//           <div className="flex items-center gap-2 ml-auto">
//             <input
//               className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-40"
//               placeholder="New category…"
//               value={newCat}
//               onChange={(e) => setNewCat(e.target.value)}
//               onKeyPress={(e) => e.key === 'Enter' && addCategory()}
//             />
//             <button 
//               className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
//               onClick={addCategory}
//             >
//               Add
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Product Table */}
//       <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
//         {isLoading ? (
//           <div className="flex items-center justify-center py-12">
//             <RefreshCw size={32} className="text-emerald-500 animate-spin" />
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b border-gray-200">
//                 <tr>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
//                   <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
//                   <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
//                   <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
//                   <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-100">
//                 {filtered.map((i) => {
//                   const stockStatus = getStockStatus(i);
//                   const expiryStatus = getExpiryStatus(i);
//                   return (
//                     <tr key={i.id} className="hover:bg-gray-50 transition-colors">
//                       <td className="px-4 py-3">
//                         <div className="flex items-center gap-3">
//                           {i.imageUrl ? (
//                             <img
//                               src={i.imageUrl}
//                               alt={i.name}
//                               className="w-10 h-10 object-cover rounded-lg"
//                             />
//                           ) : (
//                             <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
//                               <Package size={16} className="text-gray-400" />
//                             </div>
//                           )}
//                           <div>
//                             <div className="font-medium text-gray-900">{i.name}</div>
//                             <div className="text-xs text-gray-500 font-mono">SKU: {i.sku}</div>
//                             {i.isManufactured && i.batchNumber && (
//                               <div className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
//                                 <Package size={10} /> Batch: {i.batchNumber}
//                               </div>
//                             )}
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-4 py-3">
//                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
//                           {i.category?.icon} {i.category?.name}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-sm text-gray-600">{i.brand || "-"}</td>
//                       <td className="px-4 py-3 text-right font-medium text-gray-900">{formatINR(i.price)}</td>
//                       <td className="px-4 py-3 text-right text-sm text-gray-400 line-through">{formatINR(i.mrp)}</td>
//                       <td className="px-4 py-3 text-center">
//                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
//                           {stockStatus.label}
//                         </span>
//                       </td>
//                       <td className="px-4 py-3 text-center text-sm text-gray-600">{i.unit}</td>
//                       <td className="px-4 py-3 text-center">
//                         {expiryStatus ? (
//                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expiryStatus.bg} ${expiryStatus.color}`}>
//                             <Calendar size={10} className="mr-1" />
//                             {expiryStatus.label}
//                           </span>
//                         ) : (
//                           <span className="text-xs text-gray-400">N/A</span>
//                         )}
//                       </td>
//                       <td className="px-4 py-3 text-center">
//                         <div className="flex flex-wrap items-center justify-center gap-1">
//                           <button
//                             onClick={() => toggleAvailability(i.id, i.available)}
//                             className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
//                               i.available
//                                 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
//                                 : "bg-gray-200 text-gray-600 hover:bg-gray-300"
//                             }`}
//                           >
//                             {i.available ? "Available" : "Disabled"}
//                           </button>
//                           {i.isPerishable && (
//                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
//                               Perishable
//                             </span>
//                           )}
//                           {i.isManufactured && (
//                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
//                               Manufactured
//                             </span>
//                           )}
//                         </div>
//                       </td>
//                       <td className="px-4 py-3 text-right">
//                         <div className="flex items-center justify-end gap-1">
//                           <button
//                             className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
//                             onClick={() => {
//                               setEditing(i);
//                               setOpen(true);
//                             }}
//                             title="Edit product"
//                           >
//                             <Pencil size={16} />
//                           </button>
//                           <button
//                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
//                             onClick={() => remove(i.id)}
//                             title="Delete product"
//                           >
//                             <Trash2 size={16} />
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//                 {filtered.length === 0 && (
//                   <tr>
//                     <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
//                       {filter || catFilter || stockFilter || expiryFilter ? (
//                         <div>
//                           <Search size={32} className="mx-auto text-gray-300 mb-2" />
//                           <p>No products match your filters</p>
//                           <button 
//                             className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
//                             onClick={() => {
//                               setFilter("");
//                               setCatFilter("");
//                               setStockFilter("");
//                               setExpiryFilter("");
//                             }}
//                           >
//                             Clear all filters
//                           </button>
//                         </div>
//                       ) : (
//                         <div>
//                           <Package size={32} className="mx-auto text-gray-300 mb-2" />
//                           <p>No products found</p>
//                           <button 
//                             className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
//                             onClick={() => {
//                               setEditing({ ...empty, categoryId: cats[0]?.id });
//                               setOpen(true);
//                             }}
//                           >
//                             Add your first product
//                           </button>
//                         </div>
//                       )}
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         )}
        
//         {/* Table Footer */}
//         <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
//           <div>
//             Showing {filtered.length} of {items.length} products
//           </div>
//           <div>
//             <button 
//               className="text-emerald-600 hover:text-emerald-700 font-medium"
//               onClick={load}
//             >
//               Refresh
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Add/Edit Product Modal */}
//       <Modal
//         open={open}
//         onClose={() => setOpen(false)}
//         size="lg"
//         title={
//           <div className="flex items-center gap-3">
//             <div className="p-2 bg-emerald-100 rounded-lg">
//               {editing.id ? <Pencil size={20} className="text-emerald-600" /> : <Plus size={20} className="text-emerald-600" />}
//             </div>
//             <div>
//               <h2 className="text-xl font-bold text-gray-900">{editing.id ? "Edit Product" : "Add Product"}</h2>
//               <p className="text-sm text-gray-500">{editing.id ? "Update product details" : "Create a new product"}</p>
//             </div>
//           </div>
//         }
//         footer={
//           <div className="flex gap-3">
//             <button 
//               className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
//               onClick={() => setOpen(false)}
//               disabled={isLoading}
//             >
//               Cancel
//             </button>
//             <button 
//               className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
//               onClick={save}
//               disabled={isLoading}
//             >
//               {isLoading && <RefreshCw size={16} className="animate-spin" />}
//               {editing.id ? "Update" : "Create"}
//             </button>
//           </div>
//         }
//       >
//         <div className="grid grid-cols-2 gap-4">
//           {/* Name */}
//           <label className="col-span-2">
//             <span className="text-sm font-medium text-gray-700">Product Name <span className="text-red-500">*</span></span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.name ?? ""}
//               onChange={(e) => setEditing({ ...editing, name: e.target.value })}
//               placeholder="Enter product name"
//             />
//           </label>

//           {/* Category & SKU */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Category <span className="text-red-500">*</span></span>
//             <select
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.categoryId ?? ""}
//               onChange={(e) => {
//                 const selectedCat = cats.find(c => c.id === e.target.value);
//                 setEditing({ 
//                   ...editing, 
//                   categoryId: e.target.value,
//                   isManufactured: selectedCat?.requiresManufacturing || editing.isManufactured || false
//                 });
//               }}
//             >
//               <option value="">Select category</option>
//               {cats.map((c) => (
//                 <option key={c.id} value={c.id}>
//                   {c.icon} {c.name} {c.requiresManufacturing ? '🏭' : ''}
//                 </option>
//               ))}
//             </select>
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">SKU</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="Auto-generated if empty"
//               value={editing.sku ?? ""}
//               onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
//             />
//           </label>

//           {/* Barcode & Brand */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Barcode</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="Scan or enter barcode"
//               value={editing.barcode ?? ""}
//               onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">Brand</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.brand ?? ""}
//               onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
//               placeholder="Enter brand name"
//             />
//           </label>

//           {/* Pricing */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Selling Price (₹) <span className="text-red-500">*</span></span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.price ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, price: Number(e.target.value) })
//               }
//               placeholder="0.00"
//               min="0"
//               step="0.01"
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">MRP (₹)</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.mrp ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, mrp: Number(e.target.value) })
//               }
//               placeholder="0.00"
//               min="0"
//               step="0.01"
//             />
//           </label>

//           {/* Unit & Packaging */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Unit <span className="text-red-500">*</span></span>
//             <select
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.unit ?? "pcs"}
//               onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
//             >
//               <option value="kg">Kilogram (kg)</option>
//               <option value="gm">Gram (gm)</option>
//               <option value="ltr">Litre (ltr)</option>
//               <option value="ml">Millilitre (ml)</option>
//               <option value="pcs">Pieces (pcs)</option>
//               <option value="packet">Packet</option>
//               <option value="box">Box</option>
//               <option value="bottle">Bottle</option>
//               <option value="dozen">Dozen</option>
//               <option value="bunch">Bunch</option>
//             </select>
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">Packaging</span>
//             <select
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.packaging ?? "standard"}
//               onChange={(e) =>
//                 setEditing({ ...editing, packaging: e.target.value })
//               }
//             >
//               <option value="loose">Loose</option>
//               <option value="packet">Packet</option>
//               <option value="box">Box</option>
//               <option value="bottle">Bottle</option>
//               <option value="can">Can</option>
//               <option value="standard">Standard</option>
//             </select>
//           </label>

//           {/* Stock Management */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">Stock Quantity</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.stockQuantity ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, stockQuantity: Number(e.target.value) })
//               }
//               min="0"
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">Minimum Stock Alert</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.minStock ?? 0}
//               onChange={(e) =>
//                 setEditing({ ...editing, minStock: Number(e.target.value) })
//               }
//               min="0"
//             />
//           </label>

//           {/* GST & HSN */}
//           <label>
//             <span className="text-sm font-medium text-gray-700">GST %</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               value={editing.gstPercent ?? 5}
//               onChange={(e) =>
//                 setEditing({ ...editing, gstPercent: Number(e.target.value) })
//               }
//               min="0"
//               max="100"
//             />
//           </label>
//           <label>
//             <span className="text-sm font-medium text-gray-700">HSN Code</span>
//             <input
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               placeholder="e.g., 08081000"
//               value={editing.hsnCode ?? ""}
//               onChange={(e) => setEditing({ ...editing, hsnCode: e.target.value })}
//             />
//           </label>

//           {/* Manufacturing & Expiry Fields */}
//           <div className="col-span-2 border border-gray-200 rounded-xl p-4 bg-gray-50">
//             <div className="flex items-center gap-3 mb-4">
//               <input
//                 type="checkbox"
//                 id="isManufactured"
//                 checked={editing.isManufactured ?? false}
//                 onChange={(e) => {
//                   const isManufactured = e.target.checked;
//                   setEditing({ 
//                     ...editing, 
//                     isManufactured,
//                     manufacturedDate: isManufactured ? new Date().toISOString().split('T')[0] : null,
//                     expiryDate: isManufactured ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
//                     batchNumber: isManufactured ? `BATCH-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.random().toString(36).substring(2,6).toUpperCase()}` : null,
//                   })
//                 }}
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               <label htmlFor="isManufactured" className="text-sm font-medium text-gray-700">
//                 This product has manufacturing/expiry tracking
//               </label>
//             </div>

//             {editing.isManufactured && (
//               <div className="grid grid-cols-2 gap-4">
//                 <label>
//                   <span className="text-sm font-medium text-gray-700">Manufactured Date</span>
//                   <input
//                     type="date"
//                     className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//                     value={editing.manufacturedDate ? new Date(editing.manufacturedDate).toISOString().split('T')[0] : ''}
//                     onChange={(e) => setEditing({ 
//                       ...editing, 
//                       manufacturedDate: e.target.value ? new Date(e.target.value).toISOString() : null 
//                     })}
//                   />
//                 </label>
//                 <label>
//                   <span className="text-sm font-medium text-gray-700">Expiry Date <span className="text-red-500">*</span></span>
//                   <input
//                     type="date"
//                     className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//                     value={editing.expiryDate ? new Date(editing.expiryDate).toISOString().split('T')[0] : ''}
//                     onChange={(e) => setEditing({ 
//                       ...editing, 
//                       expiryDate: e.target.value ? new Date(e.target.value).toISOString() : null 
//                     })}
//                   />
//                 </label>
//                 <label className="col-span-2">
//                   <span className="text-sm font-medium text-gray-700">Batch/Lot Number</span>
//                   <input
//                     className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//                     placeholder="Enter batch number (auto-generated if empty)"
//                     value={editing.batchNumber ?? ''}
//                     onChange={(e) => setEditing({ ...editing, batchNumber: e.target.value })}
//                   />
//                 </label>
//                 <div className="col-span-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
//                   <AlertTriangle size={14} />
//                   Products with expiry dates will show alerts when nearing expiration
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Image */}
//           <div className="col-span-2">
//             <ImageUploader
//               label="Product Image"
//               folder="menu"
//               value={editing.imageUrl ?? ""}
//               onChange={(url) => setEditing({ ...editing, imageUrl: url })}
//             />
//           </div>

//           {/* Description */}
//           <label className="col-span-2">
//             <span className="text-sm font-medium text-gray-700">Description</span>
//             <textarea
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               rows={3}
//               value={editing.description ?? ""}
//               onChange={(e) =>
//                 setEditing({ ...editing, description: e.target.value })
//               }
//               placeholder="Enter product description"
//             />
//           </label>

//           {/* Checkboxes */}
//           <div className="col-span-2 grid grid-cols-2 gap-3">
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.available ?? true}
//                 onChange={(e) =>
//                   setEditing({ ...editing, available: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Available for sale
//             </label>
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.discountEligible ?? true}
//                 onChange={(e) =>
//                   setEditing({ ...editing, discountEligible: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Discount eligible
//             </label>
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.isPerishable ?? false}
//                 onChange={(e) =>
//                   setEditing({ ...editing, isPerishable: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Perishable item
//             </label>
//             <label className="flex items-center gap-2 text-sm text-gray-700">
//               <input
//                 type="checkbox"
//                 checked={editing.featured ?? false}
//                 onChange={(e) =>
//                   setEditing({ ...editing, featured: e.target.checked })
//                 }
//                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
//               />
//               Featured product
//             </label>
//           </div>

//           {/* Discount Percent */}
//           <label className="col-span-2">
//             <span className="text-sm font-medium text-gray-700">Discount Percent</span>
//             <input
//               type="number"
//               className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
//               min="0"
//               max="100"
//               value={editing.discountPercent ?? 0}
//               onChange={(e) =>
//                 setEditing({
//                   ...editing,
//                   discountPercent: Number(e.target.value),
//                 })
//               }
//               placeholder="0"
//             />
//           </label>
//         </div>
//       </Modal>

//       {/* Import Modal */}
//       <ProductImport
//         isOpen={importModalOpen}
//         onClose={() => setImportModalOpen(false)}
//         onImportComplete={load}
//         categories={cats}
//         existingItems={items}
//       />
//     </div>
//   );
// }





