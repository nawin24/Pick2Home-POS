"use client";
import { useState, useRef } from "react";
import { 
  Upload, Download, FileSpreadsheet, X, AlertCircle, 
  CheckCircle, AlertTriangle, FileUp, FileDown, Loader2,
  PlusCircle
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { formatINR } from "@/lib/calc";
import * as XLSX from 'xlsx';

// Types
type Cat = { 
  id: string; 
  name: string; 
  icon?: string | null;
  requiresManufacturing?: boolean;
};

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

type ImportPreviewItem = {
  rowIndex: number;
  data: Partial<GroceryItem>;
  errors: string[];
  isValid: boolean;
  categoryName?: string;
};

type ImportConflict = {
  existingItem: GroceryItem;
  importedItem: Partial<GroceryItem>;
  rowIndex: number;
  action: 'skip' | 'override' | 'keep';
};

interface ProductImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  categories: Cat[];
  existingItems: GroceryItem[];
  onCategoryCreate?: (categoryName: string) => Promise<void>;
}

export default function ProductImport({ 
  isOpen, 
  onClose, 
  onImportComplete,
  categories,
  existingItems,
  onCategoryCreate 
}: ProductImportProps) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportPreviewItem[]>([]);
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'conflicts' | 'complete'>('upload');
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCategoryCreator, setShowCategoryCreator] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [missingCategories, setMissingCategories] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Download template with dynamic categories
  const downloadTemplate = () => {
    const headers = [
      'Name', 'Category', 'SKU', 'Barcode', 'Brand', 'Price', 'MRP', 
      'GST %', 'Unit', 'Packaging', 'Stock Quantity', 'Min Stock', 
      'Reorder Point', 'Is Perishable', 'Available', 'Discount Eligible', 
      'Discount %', 'Is Manufactured', 'Manufactured Date', 'Expiry Date', 
      'Batch Number', 'HSN Code', 'Description'
    ];
    
    // Get category names from the database
    const categoryNames = categories.map(cat => cat.name);
    const categoryNamesList = categoryNames.join(', ');
    
    // Sample data with the first category as default
    const sampleCategory = categoryNames.length > 0 ? categoryNames[0] : 'Groceries';
    
    const sampleData = [
      'Sample Product', sampleCategory, 'SKU001', '1234567890123', 'Brand Name', 
      99.99, 149.99, 5, 'pcs', 'standard', 100, 10, 
      20, 'No', 'Yes', 'Yes', 
      0, 'No', '2024-01-01', '2024-12-31', 
      'BATCH001', '08081000', 'Sample description'
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create main data sheet
    const wsData = [
      headers,
      sampleData,
      ...Array(5).fill(headers.map(() => ''))
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length, 15) }));
    
    // Add data validation for Category column (column B, index 1)
    if (categoryNames.length > 0) {
      const categoryValidation = {
        type: 'list',
        formulae: [`"${categoryNames.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Invalid Category',
        error: 'Please select a category from the list'
      };
      
      // Apply validation to Category column (column B) for rows 2-50
      const validation: any = {};
      for (let i = 2; i <= 50; i++) {
        validation[`B${i}`] = categoryValidation;
      }
      ws['!dataValidation'] = validation;
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    
    // Create categories sheet with all available categories
    const categoryData: any[][] = [
      ['Available Categories (Use these in the Category column)'],
      [''],
      ...categoryNames.map(cat => [cat]),
      [''],
      ['Total Categories:', categoryNames.length],
      [''],
      ['Note: The Category column in the Products sheet has a dropdown list with these categories.']
    ];
    
    const wsCategories = XLSX.utils.aoa_to_sheet(categoryData);
    XLSX.utils.book_append_sheet(wb, wsCategories, 'Categories');
    
    // Create instructions sheet - FIXED: all rows as arrays
    const instructionsData: any[][] = [
      ['INSTRUCTIONS FOR PRODUCT IMPORT'],
      [''],
      ['1. Required Fields: Name, Price, Category'],
      ['2. Category column has a dropdown list - select from the list'],
      ['3. Date Format: YYYY-MM-DD (e.g., 2024-01-01)'],
      ['4. Boolean Values: Use "Yes" or "No" (or "true"/"false")'],
      ['5. Unit Options: kg, gm, ltr, ml, pcs, packet, box, bottle, dozen, bunch'],
      ['6. Packaging Options: loose, packet, box, bottle, can, standard'],
      ['7. SKU must be unique - existing SKUs will cause conflicts'],
      ['8. For manufactured products, both Manufactured Date and Expiry Date are required'],
      ['9. Expiry Date must be after Manufactured Date'],
      [''],
      ['Unit Options:'],
      ['kg - Kilogram'],
      ['gm - Gram'],
      ['ltr - Litre'],
      ['ml - Millilitre'],
      ['pcs - Pieces'],
      ['packet - Packet'],
      ['box - Box'],
      ['bottle - Bottle'],
      ['dozen - Dozen'],
      ['bunch - Bunch'],
      [''],
      ['Packaging Options:'],
      ['loose - Loose'],
      ['packet - Packet'],
      ['box - Box'],
      ['bottle - Bottle'],
      ['can - Can'],
      ['standard - Standard'],
      [''],
      ['Column Descriptions:'],
      ['Name - Product name (Required)'],
      ['Category - Category name (Required, select from dropdown)'],
      ['SKU - Stock Keeping Unit (Optional, auto-generated if empty)'],
      ['Barcode - Product barcode (Optional)'],
      ['Brand - Brand name (Optional)'],
      ['Price - Selling price in ₹ (Required)'],
      ['MRP - Maximum Retail Price (Optional)'],
      ['GST % - GST percentage (Default: 5)'],
      ['Unit - Unit of measurement (Default: pcs)'],
      ['Packaging - Packaging type (Default: standard)'],
      ['Stock Quantity - Current stock (Default: 0)'],
      ['Min Stock - Minimum stock alert level (Default: 0)'],
      ['Reorder Point - Reorder threshold (Default: 0)'],
      ['Is Perishable - Yes/No (Default: No)'],
      ['Available - Available for sale Yes/No (Default: Yes)'],
      ['Discount Eligible - Can be discounted Yes/No (Default: Yes)'],
      ['Discount % - Discount percentage (Default: 0)'],
      ['Is Manufactured - Has manufacturing/expiry tracking Yes/No (Default: No)'],
      ['Manufactured Date - Manufacturing date (Required if Is Manufactured is Yes)'],
      ['Expiry Date - Expiry date (Required if Is Manufactured is Yes)'],
      ['Batch Number - Batch/Lot number (Optional)'],
      ['HSN Code - HSN code (Optional)'],
      ['Description - Product description (Optional)']
    ];
    
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
    
    // Generate Excel file
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'product_import_template.xlsx';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Parse Excel file
  const parseExcelFile = async (file: File): Promise<{ headers: string[], rows: string[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          if (!jsonData || jsonData.length < 2) {
            reject(new Error('File must contain headers and at least one data row'));
            return;
          }
          
          // Get headers and clean them
          const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());
          
          // Get data rows (skip empty rows)
          const rows = (jsonData.slice(1) as any[][])
            .filter(row => row.some(cell => String(cell || '').trim() !== ''))
            .map(row => {
              const paddedRow = [...row];
              while (paddedRow.length < headers.length) {
                paddedRow.push('');
              }
              return paddedRow.slice(0, headers.length).map(cell => String(cell || '').trim());
            });
          
          resolve({ headers, rows });
        } catch (error) {
          reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  };

  // Parse CSV file
  const parseCSVFile = async (file: File): Promise<{ headers: string[], rows: string[][] }> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    if (lines.length < 2) {
      throw new Error('File must contain headers and at least one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      while (values.length < headers.length) {
        values.push('');
      }
      return values.slice(0, headers.length);
    });
    
    return { headers, rows };
  };

  // Map data to product objects
  const mapToProducts = (headers: string[], rows: string[][], categoryMap: Map<string, string>): ImportPreviewItem[] => {
    const previewItems: ImportPreviewItem[] = [];
    const missingCats: Set<string> = new Set();
    
    rows.forEach((row, index) => {
      const data: Partial<GroceryItem> = {};
      const errors: string[] = [];
      let categoryName = '';
      
      headers.forEach((header, i) => {
        const value = row[i]?.trim() || '';
        
        switch(header) {
          case 'name':
            if (!value) {
              errors.push('Product name is required');
            }
            data.name = value;
            break;
          case 'category':
            categoryName = value;
            if (value) {
              // Try to find category by exact match first, then case-insensitive
              let catId = categoryMap.get(value);
              if (!catId) {
                catId = categoryMap.get(value.toLowerCase());
              }
              if (catId) {
                data.categoryId = catId;
              } else {
                errors.push(`Category "${value}" not found`);
                missingCats.add(value);
              }
            } else {
              errors.push('Category is required');
            }
            break;
          case 'sku':
            data.sku = value || `SKU-${Date.now()}-${index}`;
            break;
          case 'barcode':
            data.barcode = value || null;
            break;
          case 'brand':
            data.brand = value || null;
            break;
          case 'price':
            const price = parseFloat(value);
            if (isNaN(price) || price <= 0) {
              errors.push('Price must be a positive number');
            }
            data.price = price || 0;
            break;
          case 'mrp':
            data.mrp = parseFloat(value) || 0;
            break;
          case 'gst %':
          case 'gstpercent':
            data.gstPercent = parseFloat(value) || 5;
            break;
          case 'unit':
            const validUnits = ['kg', 'gm', 'ltr', 'ml', 'pcs', 'packet', 'box', 'bottle', 'dozen', 'bunch'];
            if (value && !validUnits.includes(value.toLowerCase())) {
              errors.push(`Invalid unit: ${value}. Must be one of: ${validUnits.join(', ')}`);
            }
            data.unit = value || 'pcs';
            break;
          case 'packaging':
            const validPackaging = ['loose', 'packet', 'box', 'bottle', 'can', 'standard'];
            if (value && !validPackaging.includes(value.toLowerCase())) {
              errors.push(`Invalid packaging: ${value}`);
            }
            data.packaging = value || 'standard';
            break;
          case 'stock quantity':
          case 'stockquantity':
            data.stockQuantity = parseInt(value) || 0;
            break;
          case 'min stock':
          case 'minstock':
            data.minStock = parseInt(value) || 0;
            break;
          case 'reorder point':
          case 'reorderpoint':
            data.reorderPoint = parseInt(value) || 0;
            break;
          case 'is perishable':
          case 'isperishable':
            data.isPerishable = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value === '1';
            break;
          case 'available':
            data.available = value.toLowerCase() !== 'no' && value.toLowerCase() !== 'false' && value !== '0';
            break;
          case 'discount eligible':
          case 'discounteligible':
            data.discountEligible = value.toLowerCase() !== 'no' && value.toLowerCase() !== 'false' && value !== '0';
            break;
          case 'discount %':
          case 'discountpercent':
            data.discountPercent = parseFloat(value) || 0;
            break;
          case 'is manufactured':
          case 'ismanufactured':
            data.isManufactured = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value === '1';
            break;
          case 'manufactured date':
          case 'manufactureddate':
            if (value) {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                data.manufacturedDate = date.toISOString();
              } else {
                errors.push(`Invalid manufactured date format: ${value}. Use YYYY-MM-DD`);
              }
            }
            break;
          case 'expiry date':
          case 'expirydate':
            if (value) {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                data.expiryDate = date.toISOString();
              } else {
                errors.push(`Invalid expiry date format: ${value}. Use YYYY-MM-DD`);
              }
            }
            break;
          case 'batch number':
          case 'batchnumber':
            data.batchNumber = value || null;
            break;
          case 'hsn code':
          case 'hsncode':
            data.hsnCode = value || null;
            break;
          case 'description':
            data.description = value || null;
            break;
            
        }
      });
      
      // Validate dates if manufactured
      if (data.isManufactured) {
        if (!data.manufacturedDate) {
          errors.push('Manufactured date is required for manufactured products');
        }
        if (!data.expiryDate) {
          errors.push('Expiry date is required for manufactured products');
        }
        if (data.manufacturedDate && data.expiryDate) {
          const mfg = new Date(data.manufacturedDate);
          const exp = new Date(data.expiryDate);
          if (exp <= mfg) {
            errors.push('Expiry date must be after manufactured date');
          }
        }
      }
      
      previewItems.push({
        rowIndex: index + 2,
        data,
        errors,
        isValid: errors.length === 0,
        categoryName: categoryName
      });
    });
    
    // Store missing categories
    setMissingCategories(Array.from(missingCats));
    
    return previewItems;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    await processFile(file);
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setImportFile(file);
    setImportStatus('loading');
    setImportMessage('');
    setIsProcessing(true);
    
    try {
      // Validate file type
      const isValidType = file.name.endsWith('.csv') || 
                         file.name.endsWith('.xlsx') || 
                         file.name.endsWith('.xls');
      
      if (!isValidType) {
        throw new Error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      }
      
      let headers: string[];
      let rows: string[][];
      
      // Parse based on file type
      if (file.name.endsWith('.csv')) {
        const result = await parseCSVFile(file);
        headers = result.headers;
        rows = result.rows;
      } else {
        const result = await parseExcelFile(file);
        headers = result.headers;
        rows = result.rows;
      }
      
      // Log headers for debugging
      console.log('Headers found:', headers);
      console.log('Sample row:', rows[0]);
      
      // Create category map - use both name and lowercase for matching
      const categoryMap = new Map<string, string>();
      categories.forEach(cat => {
        categoryMap.set(cat.name, cat.id);
        categoryMap.set(cat.name.toLowerCase(), cat.id);
      });
      
      // Log categories for debugging
      console.log('Available categories:', categories.map(c => c.name));
      console.log('Category Map:', Array.from(categoryMap.entries()));
      
      // Map data to products
      const previewItems = mapToProducts(headers, rows, categoryMap);
      
      if (previewItems.length === 0) {
        setImportStatus('error');
        setImportMessage('No valid data rows found in the file');
        setIsProcessing(false);
        return;
      }
      
      setImportData(previewItems);
      
      // Check if there are missing categories
      if (missingCategories.length > 0) {
        // Show category creation option
        setShowCategoryCreator(true);
        setImportStatus('error');
        setImportMessage(`Found ${missingCategories.length} missing categories. Please create them first.`);
        setIsProcessing(false);
        return;
      }
      
      // Check for conflicts
      const conflicts: ImportConflict[] = [];
      previewItems.forEach((item) => {
        if (item.isValid && item.data.sku) {
          const existing = existingItems.find(i => i.sku === item.data.sku);
          if (existing) {
            conflicts.push({
              existingItem: existing,
              importedItem: item.data,
              rowIndex: item.rowIndex,
              action: 'skip'
            });
          }
        }
      });
      
      setImportConflicts(conflicts);
      
      if (conflicts.length > 0) {
        setImportStep('conflicts');
        setImportStatus('idle');
        setImportMessage(`${previewItems.filter(d => d.isValid).length} valid products, ${conflicts.length} conflicts found`);
      } else {
        setImportStep('preview');
        setImportStatus('success');
        setImportMessage(`Successfully parsed ${previewItems.filter(d => d.isValid).length} products`);
      }
      
    } catch (error: any) {
      console.error('Process file error:', error);
      setImportStatus('error');
      setImportMessage(error.message || 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create missing categories
  const createMissingCategories = async () => {
    if (!onCategoryCreate) {
      alert('Category creation is not available');
      return;
    }
    
    setIsProcessing(true);
    try {
      for (const catName of missingCategories) {
        await onCategoryCreate(catName);
      }
      
      // Refresh categories and reprocess
      setImportStatus('loading');
      await onImportComplete();
      
      // Re-process the file with new categories
      if (importFile) {
        await processFile(importFile);
        setShowCategoryCreator(false);
        setMissingCategories([]);
      }
    } catch (error) {
      console.error('Failed to create categories:', error);
      alert('Failed to create categories. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle conflict resolution
  const handleConflictAction = (conflictIndex: number, action: 'skip' | 'override' | 'keep') => {
    const updatedConflicts = [...importConflicts];
    updatedConflicts[conflictIndex].action = action;
    setImportConflicts(updatedConflicts);
  };

  const applyConflictStrategy = (strategy: 'skip' | 'override' | 'keep') => {
    const updatedConflicts = importConflicts.map(c => ({
      ...c,
      action: strategy
    }));
    setImportConflicts(updatedConflicts);
  };

  // Execute import
  // const executeImport = async () => {
  //   setImportStatus('loading');
  //   setImportMessage('');
  //   setIsProcessing(true);
    
  //   try {
  //     let successCount = 0;
  //     let failCount = 0;
      
  //     for (const item of importData) {
  //       if (!item.isValid) continue;
        
  //       const conflict = importConflicts.find(c => c.rowIndex === item.rowIndex);
        
  //       if (conflict) {
  //         if (conflict.action === 'skip' || conflict.action === 'keep') {
  //           continue;
  //         }
  //       }
        
  //       const existingItem = existingItems.find(i => i.sku === item.data.sku);
        
  //       try {
  //         let response;
  //         if (existingItem && conflict?.action === 'override') {
  //           response = await fetch(`/api/menu/${existingItem.id}`, {
  //             method: 'PATCH',
  //             headers: { 'content-type': 'application/json' },
  //             body: JSON.stringify({
  //               ...item.data,
  //               id: existingItem.id
  //             })
  //           });
  //         } else if (!existingItem) {
  //           response = await fetch('/api/menu', {
  //             method: 'POST',
  //             headers: { 'content-type': 'application/json' },
  //             body: JSON.stringify(item.data)
  //           });
  //         }
          
  //         if (response && response.ok) {
  //           successCount++;
  //         } else if (response) {
  //           const error = await response.json();
  //           console.error('Import error:', error);
  //           failCount++;
  //         }
  //       } catch (error) {
  //         console.error('Error importing row:', item.rowIndex, error);
  //         failCount++;
  //       }
  //     }
      
  //     setImportedCount(successCount);
  //     setFailedCount(failCount);
  //     setImportStep('complete');
  //     setImportStatus('success');
  //     setImportMessage(`Successfully imported ${successCount} products${failCount > 0 ? `, ${failCount} failed` : ''}`);
      
  //     onImportComplete();
      
  //   } catch (error: any) {
  //     setImportStatus('error');
  //     setImportMessage(error.message || 'Failed to import products');
  //   } finally {
  //     setIsProcessing(false);
  //   }
  // };
// Execute import - FIXED to match API expectations
const executeImport = async () => {
  setImportStatus('loading');
  setImportMessage('');
  setIsProcessing(true);
  
  try {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    
    for (const item of importData) {
      if (!item.isValid) {
        failCount++;
        errors.push(`Row ${item.rowIndex}: Invalid data - ${item.errors.join(', ')}`);
        continue;
      }
      
      const conflict = importConflicts.find(c => c.rowIndex === item.rowIndex);
      
      if (conflict) {
        if (conflict.action === 'skip' || conflict.action === 'keep') {
          continue;
        }
      }
      
      const existingItem = existingItems.find(i => i.sku === item.data.sku);
      
      try {
        // Prepare the data to match API expectations
        const productData = {
          name: item.data.name || '',
          categoryId: item.data.categoryId || '',
          price: item.data.price || 0,
          mrp: item.data.mrp || item.data.price || 0,
          gstPercent: item.data.gstPercent || 5,
          unit: item.data.unit || 'pcs',
          packaging: item.data.packaging || 'standard',
          stockQuantity: item.data.stockQuantity || 0,
          minStock: item.data.minStock || 0,
          reorderPoint: item.data.reorderPoint || 0,
          isPerishable: item.data.isPerishable || false,
          available: item.data.available !== undefined ? item.data.available : true,
          discountEligible: item.data.discountEligible !== undefined ? item.data.discountEligible : true,
          discountPercent: item.data.discountPercent || 0,
          isManufactured: item.data.isManufactured || false,
          manufacturedDate: item.data.manufacturedDate || null,
          expiryDate: item.data.expiryDate || null,
          batchNumber: item.data.batchNumber || null,
          sku: item.data.sku || undefined,
          barcode: item.data.barcode || undefined,
          brand: item.data.brand || 'FreshMart',
          hsnCode: item.data.hsnCode || '',
          description: item.data.description || '',
          imageUrl: item.data.imageUrl || '',
          // weight: item.data.weight || null,
          featured: item.data.featured || false,
        };
        
        let response;
        let url = '/api/menu';
        let method = 'POST';
        
        if (existingItem && conflict?.action === 'override') {
          url = `/api/menu/${existingItem.id}`;
          method = 'PATCH';
        }
        
        const fetchOptions: RequestInit = {
          method,
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productData),
        };
        
        console.log(`Importing row ${item.rowIndex}:`, productData);
        
        response = await fetch(url, fetchOptions);
        
        // Check if response is OK
        if (!response.ok) {
          let errorMessage = `Failed to import row ${item.rowIndex}`;
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If response is not JSON, get text
            try {
              const text = await response.text();
              if (text) {
                errorMessage = text;
              }
            } catch {
              // Ignore
            }
          }
          
          console.error(`Import error for row ${item.rowIndex}:`, errorMessage);
          errors.push(errorMessage);
          failCount++;
        } else {
          // Success
          try {
            const data = await response.json();
            console.log(`Successfully imported row ${item.rowIndex}:`, data);
            successCount++;
          } catch {
            // Response might not be JSON but status is OK
            successCount++;
          }
        }
        
      } catch (error: any) {
        console.error('Error importing row:', item.rowIndex, error);
        errors.push(`Row ${item.rowIndex}: ${error.message || 'Unknown error'}`);
        failCount++;
      }
    }
    
    setImportedCount(successCount);
    setFailedCount(failCount);
    setImportStep('complete');
    setImportStatus('success');
    
    let message = `Successfully imported ${successCount} products`;
    if (failCount > 0) {
      message += `, ${failCount} failed`;
    }
    setImportMessage(message);
    
    if (errors.length > 0) {
      console.error('Import errors:', errors);
    }
    
    // Refresh the product list
    onImportComplete();
    
  } catch (error: any) {
    console.error('Import execution error:', error);
    setImportStatus('error');
    setImportMessage(error.message || 'Failed to import products');
  } finally {
    setIsProcessing(false);
  }
};


  const resetImport = () => {
    setImportFile(null);
    setImportData([]);
    setImportConflicts([]);
    setImportStep('upload');
    setImportStatus('idle');
    setImportMessage('');
    setImportedCount(0);
    setFailedCount(0);
    setDragActive(false);
    setIsProcessing(false);
    setShowCategoryCreator(false);
    setMissingCategories([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-blue-800">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <AlertCircle size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-blue-900">Before you import:</p>
            <ul className="text-sm mt-2 space-y-1 text-blue-700">
              <li>• Download the template to see the required format</li>
              <li>• Category column has a <span className="font-medium">dropdown list</span> of available categories</li>
              <li>• Required fields: <span className="font-medium">Name, Price, Category</span></li>
              <li>• SKU must be unique - existing SKUs will cause conflicts</li>
              <li>• Date format: <span className="font-medium">YYYY-MM-DD</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div 
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-emerald-500 bg-emerald-50' 
            : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          id="fileInput"
        />
        <label htmlFor="fileInput" className="cursor-pointer block">
          {isProcessing ? (
            <div className="py-8">
              <Loader2 size={48} className="mx-auto text-emerald-500 animate-spin mb-4" />
              <p className="text-gray-600">Processing file...</p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet size={40} className="text-emerald-600" />
              </div>
              <div className="text-gray-600">
                <span className="text-emerald-600 font-semibold hover:text-emerald-700">Click to upload</span>
                <span className="text-gray-400"> or drag and drop</span>
              </div>
              <p className="text-sm text-gray-400 mt-3">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </p>
              <div className="mt-4 flex justify-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CheckCircle size={14} className="text-green-500" /> CSV
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle size={14} className="text-green-500" /> Excel
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle size={14} className="text-green-500" /> Up to 1000 rows
                </span>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Missing Categories Creator */}
      {showCategoryCreator && missingCategories.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Missing Categories Found</p>
              <p className="text-sm text-amber-700 mt-1">
                The following categories don't exist in the system:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {missingCategories.map((cat, index) => (
                  <span key={index} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">
                    {cat}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={createMissingCategories}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlusCircle size={14} />
                      Create All Missing Categories
                    </>
                  )}
                </button>
                <button
                  onClick={resetImport}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importStatus === 'error' && !showCategoryCreator && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p>{importMessage}</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800">
        <div className="flex items-start gap-3">
          <CheckCircle size={20} className="flex-shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <p className="font-semibold">{importMessage}</p>
            <p className="text-sm mt-1 text-emerald-700">
              {importData.filter(d => d.isValid).length} valid products ready to import
              <span className="ml-2 text-gray-500">
                ({importData.filter(d => !d.isValid).length} invalid)
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto border rounded-xl">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {importData.map((item) => (
              <tr key={item.rowIndex} className={item.isValid ? 'hover:bg-gray-50' : 'bg-red-50'}>
                <td className="px-4 py-3 text-sm text-gray-500">{item.rowIndex}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{item.data.name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{item.categoryName || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{item.data.sku || '-'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {item.data.price ? formatINR(item.data.price) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.isValid ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      <CheckCircle size={12} className="mr-1" /> Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={item.errors.join(', ')}>
                      <AlertCircle size={12} className="mr-1" /> Invalid
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderConflictsStep = () => (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Conflicts detected!</p>
            <p className="text-sm mt-1 text-amber-700">
              {importConflicts.length} products have existing SKUs. Choose how to handle them.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          onClick={() => applyConflictStrategy('skip')}
        >
          Skip All
        </button>
        <button 
          className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          onClick={() => applyConflictStrategy('keep')}
        >
          Keep Existing
        </button>
        <button 
          className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          onClick={() => applyConflictStrategy('override')}
        >
          Override All
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto border rounded-xl">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Existing Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Imported Product</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {importConflicts.map((conflict, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-500">{conflict.rowIndex}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{conflict.existingItem.name}</div>
                  <div className="text-xs text-gray-500 font-mono">SKU: {conflict.existingItem.sku}</div>
                  <div className="text-xs text-gray-500">Price: {formatINR(conflict.existingItem.price)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{conflict.importedItem.name}</div>
                  <div className="text-xs text-gray-500">Price: {formatINR(conflict.importedItem.price || 0)}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={conflict.action}
                    onChange={(e) => handleConflictAction(index, e.target.value as any)}
                  >
                    <option value="skip">Skip</option>
                    <option value="keep">Keep Existing</option>
                    <option value="override">Override</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-4 text-center py-8">
      {importStatus === 'success' ? (
        <>
          <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle size={48} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">Import Complete!</div>
          <div className="text-gray-600">
            Successfully imported <span className="font-semibold text-emerald-600">{importedCount}</span> products
            {failedCount > 0 && (
              <span className="ml-2 text-red-600">
                ({failedCount} failed)
              </span>
            )}
          </div>
          {failedCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm text-left">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p>Some products failed to import. Check the error log for details.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle size={48} className="text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">Import Failed</div>
          <div className="text-red-500">{importMessage}</div>
        </>
      )}
    </div>
  );

  const getFooter = () => {
    if (isProcessing) {
      return (
        <button className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed" disabled>
          <Loader2 size={16} className="inline animate-spin mr-2" />
          Processing...
        </button>
      );
    }

    switch(importStep) {
      case 'upload':
        return (
          <div className="flex gap-3">
            <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" onClick={resetImport}>
              Cancel
            </button>
            <button 
              className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md" 
              onClick={downloadTemplate}
            >
              <Download size={16} /> Download Template
            </button>
          </div>
        );
      case 'preview':
        return (
          <div className="flex gap-3">
            <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" onClick={resetImport}>
              Cancel
            </button>
            <button className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md" onClick={executeImport}>
              <Upload size={16} /> Import {importData.filter(d => d.isValid).length} Products
            </button>
          </div>
        );
      case 'conflicts':
        return (
          <div className="flex gap-3">
            <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" onClick={resetImport}>
              Cancel
            </button>
            <button className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm hover:shadow-md" onClick={executeImport}>
              Import with Selected Actions
            </button>
          </div>
        );
      case 'complete':
        return (
          <button className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md" onClick={resetImport}>
            Done
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={resetImport}
      size="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <FileSpreadsheet size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Products</h2>
            <p className="text-sm text-gray-500 font-normal">Upload Excel or CSV file to import products in bulk</p>
          </div>
        </div>
      }
      footer={getFooter()}
    >
      <div className="py-2">
        {importStep === 'upload' && renderUploadStep()}
        {importStep === 'preview' && renderPreviewStep()}
        {importStep === 'conflicts' && renderConflictsStep()}
        {importStep === 'complete' && renderCompleteStep()}
      </div>
    </Modal>
  );
}