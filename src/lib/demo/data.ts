/**
 * All demo / mock data for FW Mining OS.
 * Returned by service functions when isDemoMode() is true.
 */

import { DEMO_SITE_ID, DEMO_ORG_ID, DEMO_USER_ID } from "./index";

const now = new Date();

function daysAgo(n: number): string {
  const d = new Date(now);
  d.setDate(now.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function tsAgo(hours: number): string {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}
function monthStart(monthsAgo: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return d.toISOString().slice(0, 10);
}

// ─── Customer IDs ─────────────────────────────────────────────────────────────
export const DEMO_CUSTOMER_ID_INTERNAL = "dc-int";
export const DEMO_CUSTOMER_ID_EXT1     = "dc-ext1";
export const DEMO_CUSTOMER_ID_EXT2     = "dc-ext2";

// ─── Category IDs ─────────────────────────────────────────────────────────────
const DEC_CHEMICALS  = "dec1";
const DEC_FUEL       = "dec2";
const DEC_LABOR      = "dec3";
const DEC_MAINT      = "dec4";
const DEC_TRANSPORT  = "dec5";
const DIC_SALES      = "dic1";
const DIC_ROYALTIES  = "dic2";
const DIC_GRANTS     = "dic3";

// ─── Org & Site ───────────────────────────────────────────────────────────────

export const DEMO_ORG = {
  id: DEMO_ORG_ID, name: "FW Mining Demo Co.", slug: "fw-mining-demo", logo_url: null,
  created_at: tsAgo(8760), weekly_report_enabled: true, weekly_report_email: "reports@fwmining.demo",
};

export const DEMO_SITE = {
  id: DEMO_SITE_ID, org_id: DEMO_ORG_ID, name: "North Star Mine", location: "Kalgoorlie, WA",
  timezone: "Australia/Perth", status: "active" as const, created_at: tsAgo(8760),
};

export const DEMO_USER_PROFILE = {
  id: DEMO_USER_ID, org_id: DEMO_ORG_ID, full_name: "Alex Demo", avatar_url: null,
  phone: "+61 400 000 000", created_at: tsAgo(8760), onboarding_completed: true,
};

// ─── Workers ─────────────────────────────────────────────────────────────────

export const DEMO_WORKERS = [
  { id: "dw1",  site_id: DEMO_SITE_ID, full_name: "Sarah Mitchell",  position: "Mine Supervisor",       department: "Operations",  hire_date: daysAgo(720), status: "active" as const,   email: "s.mitchell@northstar.demo",   created_at: tsAgo(17280) },
  { id: "dw2",  site_id: DEMO_SITE_ID, full_name: "James Okoye",     position: "Drill Operator",        department: "Drilling",    hire_date: daysAgo(540), status: "active" as const,   email: "j.okoye@northstar.demo",      created_at: tsAgo(12960) },
  { id: "dw3",  site_id: DEMO_SITE_ID, full_name: "Priya Sharma",    position: "Safety Officer",        department: "Safety",      hire_date: daysAgo(480), status: "active" as const,   email: "p.sharma@northstar.demo",     created_at: tsAgo(11520) },
  { id: "dw4",  site_id: DEMO_SITE_ID, full_name: "Ben Fitzgerald",  position: "Equipment Operator",    department: "Operations",  hire_date: daysAgo(400), status: "active" as const,   email: "b.fitzgerald@northstar.demo", created_at: tsAgo(9600) },
  { id: "dw5",  site_id: DEMO_SITE_ID, full_name: "Yuki Tanaka",     position: "Geologist",             department: "Geology",     hire_date: daysAgo(310), status: "active" as const,   email: "y.tanaka@northstar.demo",     created_at: tsAgo(7440) },
  { id: "dw6",  site_id: DEMO_SITE_ID, full_name: "Carlos Mendez",   position: "Blasting Technician",   department: "Drilling",    hire_date: daysAgo(260), status: "active" as const,   email: "c.mendez@northstar.demo",     created_at: tsAgo(6240) },
  { id: "dw7",  site_id: DEMO_SITE_ID, full_name: "Emma Walsh",      position: "Lab Technician",        department: "Geology",     hire_date: daysAgo(200), status: "on_leave" as const, email: "e.walsh@northstar.demo",      created_at: tsAgo(4800) },
  { id: "dw8",  site_id: DEMO_SITE_ID, full_name: "David Nguyen",    position: "Haul Truck Operator",   department: "Transport",   hire_date: daysAgo(150), status: "active" as const,   email: "d.nguyen@northstar.demo",     created_at: tsAgo(3600) },
  { id: "dw9",  site_id: DEMO_SITE_ID, full_name: "Rachel Foster",   position: "Process Engineer",      department: "Processing",  hire_date: daysAgo(120), status: "active" as const,   email: "r.foster@northstar.demo",     created_at: tsAgo(2880) },
  { id: "dw10", site_id: DEMO_SITE_ID, full_name: "Tom Blackwood",   position: "Maintenance Tech",      department: "Maintenance", hire_date: daysAgo(90),  status: "active" as const,   email: "t.blackwood@northstar.demo",  created_at: tsAgo(2160) },
  { id: "dw11", site_id: DEMO_SITE_ID, full_name: "Anika Patel",     position: "Environmental Officer", department: "Safety",      hire_date: daysAgo(60),  status: "active" as const,   email: "a.patel@northstar.demo",      created_at: tsAgo(1440) },
  { id: "dw12", site_id: DEMO_SITE_ID, full_name: "Marcus O'Brien",  position: "Drill Operator",        department: "Drilling",    hire_date: daysAgo(45),  status: "active" as const,   email: "m.obrien@northstar.demo",     created_at: tsAgo(1080) },
];

// ─── Inventory ────────────────────────────────────────────────────────────────

export const DEMO_INVENTORY = [
  { id: "di1",  site_id: DEMO_SITE_ID, supplier_id: "dsu3", name: "Safety Helmets",              category: "PPE",         sku: "PPE-001", quantity: 8,    unit: "pcs",  unit_cost: 45,   reorder_level: 15,   created_at: tsAgo(4320), updated_at: tsAgo(120) },
  { id: "di2",  site_id: DEMO_SITE_ID, supplier_id: "dsu3", name: "Hi-Vis Vests",                category: "PPE",         sku: "PPE-002", quantity: 22,   unit: "pcs",  unit_cost: 18,   reorder_level: 20,   created_at: tsAgo(4320), updated_at: tsAgo(120) },
  { id: "di3",  site_id: DEMO_SITE_ID, supplier_id: "dsu3", name: "Steel-Toe Boots (Sz 10-12)", category: "PPE",         sku: "PPE-003", quantity: 4,    unit: "prs",  unit_cost: 130,  reorder_level: 8,    created_at: tsAgo(3840), updated_at: tsAgo(72) },
  { id: "di4",  site_id: DEMO_SITE_ID, supplier_id: "dsu2", name: "Hydraulic Fluid 46W",        category: "Lubricants",  sku: "LUB-001", quantity: 14,   unit: "L",    unit_cost: 12,   reorder_level: 20,   created_at: tsAgo(3600), updated_at: tsAgo(168) },
  { id: "di5",  site_id: DEMO_SITE_ID, supplier_id: "dsu2", name: "Diesel (Bulk)",               category: "Fuel",        sku: "FUE-001", quantity: 4200, unit: "L",    unit_cost: 1.85, reorder_level: 2000, created_at: tsAgo(3360), updated_at: tsAgo(24) },
  { id: "di6",  site_id: DEMO_SITE_ID, supplier_id: "dsu1", name: "Drill Bits 38mm",             category: "Drilling",    sku: "DRL-001", quantity: 3,    unit: "pcs",  unit_cost: 280,  reorder_level: 5,    created_at: tsAgo(3120), updated_at: tsAgo(48) },
  { id: "di7",  site_id: DEMO_SITE_ID, supplier_id: "dsu1", name: "Blast Caps (Electric)",       category: "Explosives",  sku: "EXP-001", quantity: 150,  unit: "pcs",  unit_cost: 8.5,  reorder_level: 100,  created_at: tsAgo(2880), updated_at: tsAgo(96) },
  { id: "di8",  site_id: DEMO_SITE_ID, supplier_id: "dsu1", name: "ANFO Bulk",                   category: "Explosives",  sku: "EXP-002", quantity: 2800, unit: "kg",   unit_cost: 0.95, reorder_level: 1000, created_at: tsAgo(2880), updated_at: tsAgo(96) },
  { id: "di9",  site_id: DEMO_SITE_ID, supplier_id: "dsu4", name: "Cyanide Solution 10%",        category: "Reagents",    sku: "REA-001", quantity: 320,  unit: "L",    unit_cost: 22,   reorder_level: 200,  created_at: tsAgo(2640), updated_at: tsAgo(144) },
  { id: "di10", site_id: DEMO_SITE_ID, supplier_id: "dsu4", name: "Hydrated Lime",               category: "Reagents",    sku: "REA-002", quantity: 1800, unit: "kg",   unit_cost: 0.45, reorder_level: 500,  created_at: tsAgo(2640), updated_at: tsAgo(144) },
  { id: "di11", site_id: DEMO_SITE_ID, supplier_id: "dsu2", name: "Oil Filters (CAT 390)",       category: "Maintenance", sku: "MNT-001", quantity: 18,   unit: "pcs",  unit_cost: 65,   reorder_level: 10,   created_at: tsAgo(2400), updated_at: tsAgo(192) },
  { id: "di12", site_id: DEMO_SITE_ID, supplier_id: "dsu3", name: "First Aid Kits (Level 3)",    category: "Safety",      sku: "SAF-001", quantity: 6,    unit: "kits", unit_cost: 95,   reorder_level: 5,    created_at: tsAgo(2160), updated_at: tsAgo(240) },
  { id: "di13", site_id: DEMO_SITE_ID, supplier_id: "dsu3", name: "Nitrile Gloves (L)",          category: "PPE",         sku: "PPE-004", quantity: 200,  unit: "prs",  unit_cost: 2.8,  reorder_level: 100,  created_at: tsAgo(1920), updated_at: tsAgo(48) },
  { id: "di14", site_id: DEMO_SITE_ID, supplier_id: "dsu3", name: "Safety Glasses (Anti-fog)",   category: "PPE",         sku: "PPE-005", quantity: 11,   unit: "pcs",  unit_cost: 24,   reorder_level: 15,   created_at: tsAgo(1680), updated_at: tsAgo(120) },
  { id: "di15", site_id: DEMO_SITE_ID, supplier_id: "dsu2", name: "Conveyor Belt 1.2m sections", category: "Maintenance", sku: "MNT-002", quantity: 2,    unit: "pcs",  unit_cost: 1200, reorder_level: 2,    created_at: tsAgo(1440), updated_at: tsAgo(216) },
  { id: "di16", site_id: DEMO_SITE_ID, supplier_id: "dsu2", name: "Grease Cartridges (Molycote)",category: "Lubricants",  sku: "LUB-002", quantity: 48,   unit: "pcs",  unit_cost: 14,   reorder_level: 24,   created_at: tsAgo(1200), updated_at: tsAgo(72) },
  { id: "di17", site_id: DEMO_SITE_ID, supplier_id: "dsu4", name: "Activated Carbon",            category: "Reagents",    sku: "REA-003", quantity: 600,  unit: "kg",   unit_cost: 3.8,  reorder_level: 300,  created_at: tsAgo(1080), updated_at: tsAgo(96) },
  { id: "di18", site_id: DEMO_SITE_ID, supplier_id: "dsu3", name: "Ear Protection (Class 5)",    category: "PPE",         sku: "PPE-006", quantity: 35,   unit: "pcs",  unit_cost: 22,   reorder_level: 20,   created_at: tsAgo(960),  updated_at: tsAgo(144) },
];

// ─── Customers ────────────────────────────────────────────────────────────────

export const DEMO_CUSTOMERS = [
  {
    id: DEMO_CUSTOMER_ID_INTERNAL, site_id: DEMO_SITE_ID, org_id: DEMO_ORG_ID,
    name: "Internal Operations", type: "internal" as const,
    contact_name: null, contact_email: null, contact_phone: null,
    contract_start: null, contract_end: null, daily_rate: null,
    notes: "Default internal cost centre for company-owned mining operations.",
    status: "active" as const, created_at: tsAgo(8760), updated_at: tsAgo(8760),
  },
  {
    id: DEMO_CUSTOMER_ID_EXT1, site_id: DEMO_SITE_ID, org_id: DEMO_ORG_ID,
    name: "Goldfield Contractors Pty Ltd", type: "external" as const,
    contact_name: "Mark Lawson", contact_email: "m.lawson@gfc.demo", contact_phone: "+61 418 000 001",
    contract_start: daysAgo(180), contract_end: daysAgo(-180), daily_rate: 4500,
    notes: "Gold processing contract — 12-month site lease.",
    status: "active" as const, created_at: tsAgo(4320), updated_at: tsAgo(720),
  },
  {
    id: DEMO_CUSTOMER_ID_EXT2, site_id: DEMO_SITE_ID, org_id: DEMO_ORG_ID,
    name: "Apex Drilling Services", type: "external" as const,
    contact_name: "Sarah Kim", contact_email: "s.kim@apexdrill.demo", contact_phone: "+61 427 000 002",
    contract_start: daysAgo(90), contract_end: daysAgo(-90), daily_rate: 3200,
    notes: "Blast hole drilling — east bench extension.",
    status: "active" as const, created_at: tsAgo(2160), updated_at: tsAgo(360),
  },
];

// ─── Expense Categories ────────────────────────────────────────────────────────

export const DEMO_EXPENSE_CATEGORIES = [
  { id: DEC_CHEMICALS, org_id: DEMO_ORG_ID, type: "expense" as const, name: "Chemicals/Reagents", description: "Cyanide, lime, activated carbon and other process chemicals", color: "#7c3aed", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
  { id: DEC_FUEL,      org_id: DEMO_ORG_ID, type: "expense" as const, name: "Fuel",               description: "Diesel, petrol and other fuel costs",                          color: "#dc2626", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
  { id: DEC_LABOR,     org_id: DEMO_ORG_ID, type: "expense" as const, name: "Labor",              description: "Payroll, contractor labour and workforce costs",                color: "#2563eb", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
  { id: DEC_MAINT,     org_id: DEMO_ORG_ID, type: "expense" as const, name: "Maintenance",        description: "Equipment parts, repairs and servicing",                       color: "#d97706", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
  { id: DEC_TRANSPORT, org_id: DEMO_ORG_ID, type: "expense" as const, name: "Transport",          description: "Ore haulage, logistics and freight",                           color: "#059669", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
  { id: DIC_SALES,     org_id: DEMO_ORG_ID, type: "income"  as const, name: "Sales",              description: "Gold, silver, copper and other mineral sales",                  color: "#16a34a", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
  { id: DIC_ROYALTIES, org_id: DEMO_ORG_ID, type: "income"  as const, name: "Royalties",          description: "Royalty income from licensed mineral rights",                   color: "#0891b2", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
  { id: DIC_GRANTS,    org_id: DEMO_ORG_ID, type: "income"  as const, name: "Grants & Subsidies", description: "Government grants, subsidies and rebates",                      color: "#9333ea", created_at: tsAgo(8760), updated_at: tsAgo(8760) },
];

// ─── Transactions ─────────────────────────────────────────────────────────────

export const DEMO_TRANSACTIONS = [
  { id: "dt1",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT1, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Gold dore sale — Batch #47",            quantity: 1, unit_price: 156800, status: "success" as const, transaction_date: daysAgo(2),  created_at: tsAgo(48) },
  { id: "dt2",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_FUEL,      type: "expense" as const, category: "Fuel",        description: "Diesel bulk delivery — 9,800 L",        quantity: 1, unit_price: 18130,  status: "success" as const, transaction_date: daysAgo(4),  created_at: tsAgo(96) },
  { id: "dt3",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_LABOR,     type: "expense" as const, category: "Labour",      description: "Payroll — Week 13",                     quantity: 1, unit_price: 44200,  status: "success" as const, transaction_date: daysAgo(7),  created_at: tsAgo(168) },
  { id: "dt4",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT2, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Copper concentrate — 38t shipment",     quantity: 1, unit_price: 71500,  status: "success" as const, transaction_date: daysAgo(10), created_at: tsAgo(240) },
  { id: "dt5",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: null,          type: "expense" as const, category: "Safety",      description: "PPE restock — helmets, boots, gloves",  quantity: 1, unit_price: 5400,   status: "success" as const, transaction_date: daysAgo(12), created_at: tsAgo(288) },
  { id: "dt6",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_MAINT,     type: "expense" as const, category: "Maintenance", description: "Hydraulic pump rebuild — CAT 390",      quantity: 1, unit_price: 9800,   status: "success" as const, transaction_date: daysAgo(14), created_at: tsAgo(336) },
  { id: "dt7",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT1, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Silver by-product — 840 troy oz",       quantity: 1, unit_price: 9240,   status: "success" as const, transaction_date: daysAgo(16), created_at: tsAgo(384) },
  { id: "dt8",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: null,          type: "expense" as const, category: "Explosives",  description: "ANFO 3.2t + blast caps x200",           quantity: 1, unit_price: 4860,   status: "success" as const, transaction_date: daysAgo(18), created_at: tsAgo(432) },
  { id: "dt9",  site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_CHEMICALS, type: "expense" as const, category: "Reagents",    description: "Cyanide solution top-up — 320 L",       quantity: 1, unit_price: 7040,   status: "success" as const, transaction_date: daysAgo(21), created_at: tsAgo(504) },
  { id: "dt10", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT2, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Copper concentrate — 42t (invoiced)",   quantity: 1, unit_price: 79800,  status: "pending" as const, transaction_date: daysAgo(1),  created_at: tsAgo(24) },
  { id: "dt11", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_LABOR,     type: "expense" as const, category: "Labour",      description: "Payroll — Week 14",                     quantity: 1, unit_price: 44200,  status: "pending" as const, transaction_date: daysAgo(0),  created_at: tsAgo(2) },
  { id: "dt12", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_FUEL,      type: "expense" as const, category: "Fuel",        description: "Diesel bulk order — scheduled",         quantity: 1, unit_price: 19200,  status: "pending" as const, transaction_date: daysAgo(0),  created_at: tsAgo(1) },
  { id: "dt13", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT1, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Gold dore sale — Batch #46",            quantity: 1, unit_price: 148200, status: "success" as const, transaction_date: daysAgo(32), created_at: tsAgo(768) },
  { id: "dt14", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_LABOR,     type: "expense" as const, category: "Labour",      description: "Payroll — Week 11",                     quantity: 1, unit_price: 43600,  status: "success" as const, transaction_date: daysAgo(35), created_at: tsAgo(840) },
  { id: "dt15", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_MAINT,     type: "expense" as const, category: "Equipment",   description: "D9 Dozer track replacement parts",      quantity: 1, unit_price: 22400,  status: "success" as const, transaction_date: daysAgo(38), created_at: tsAgo(912) },
  { id: "dt16", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT2, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Gold dore sale — Batch #45",            quantity: 1, unit_price: 143700, status: "success" as const, transaction_date: daysAgo(50), created_at: tsAgo(1200) },
  { id: "dt17", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_FUEL,      type: "expense" as const, category: "Fuel",        description: "Diesel bulk delivery — 10,400 L",       quantity: 1, unit_price: 19240,  status: "success" as const, transaction_date: daysAgo(52), created_at: tsAgo(1248) },
  { id: "dt18", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_LABOR,     type: "expense" as const, category: "Labour",      description: "Payroll — Week 9",                      quantity: 1, unit_price: 43600,  status: "success" as const, transaction_date: daysAgo(55), created_at: tsAgo(1320) },
  { id: "dt19", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT1, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Gold dore sale — Batch #44",            quantity: 1, unit_price: 138500, status: "success" as const, transaction_date: daysAgo(70), created_at: tsAgo(1680) },
  { id: "dt20", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT2, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Copper concentrate — 35t",              quantity: 1, unit_price: 66500,  status: "success" as const, transaction_date: daysAgo(75), created_at: tsAgo(1800) },
  { id: "dt21", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_LABOR,     type: "expense" as const, category: "Labour",      description: "Payroll — Week 7",                      quantity: 1, unit_price: 43600,  status: "success" as const, transaction_date: daysAgo(77), created_at: tsAgo(1848) },
  { id: "dt22", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_MAINT,     type: "expense" as const, category: "Maintenance", description: "Mill liner replacement",                quantity: 1, unit_price: 31500,  status: "success" as const, transaction_date: daysAgo(80), created_at: tsAgo(1920) },
  { id: "dt23", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_INTERNAL, expense_category_id: DEC_FUEL,      type: "expense" as const, category: "Fuel",        description: "Diesel bulk delivery — 9,600 L",        quantity: 1, unit_price: 17760,  status: "success" as const, transaction_date: daysAgo(82), created_at: tsAgo(1968) },
  { id: "dt24", site_id: DEMO_SITE_ID, customer_id: DEMO_CUSTOMER_ID_EXT1, expense_category_id: null,        type: "income"  as const, category: "Sales",       description: "Gold dore sale — Batch #43",            quantity: 1, unit_price: 135900, status: "success" as const, transaction_date: daysAgo(90), created_at: tsAgo(2160) },
];

// ─── Equipment ────────────────────────────────────────────────────────────────

export const DEMO_EQUIPMENT = [
  { id: "de1", site_id: DEMO_SITE_ID, name: "CAT 390 Excavator",        type: "Excavator",    serial_number: "CAT390-2021-001",  status: "operational" as const, purchase_date: daysAgo(1200), next_service_date: daysAgo(-15), notes: "Main dig face unit. Overdue for 250hr service.",          created_at: tsAgo(28800), updated_at: tsAgo(120) },
  { id: "de2", site_id: DEMO_SITE_ID, name: "Komatsu 730E Haul Truck",  type: "Haul Truck",   serial_number: "KOM730-2020-003",  status: "operational" as const, purchase_date: daysAgo(1500), next_service_date: daysAgo(-12), notes: "Primary ore haul. Brake pads replaced last week.",         created_at: tsAgo(36000), updated_at: tsAgo(240) },
  { id: "de3", site_id: DEMO_SITE_ID, name: "Atlas Copco L8 Drill Rig", type: "Drill Rig",    serial_number: "ACR-L8-2022-007",  status: "operational" as const, purchase_date: daysAgo(700),  next_service_date: daysAgo(25),  notes: "Production drilling. Currently on north bench N-18.",      created_at: tsAgo(16800), updated_at: tsAgo(288) },
  { id: "de4", site_id: DEMO_SITE_ID, name: "CAT D9 Bulldozer",         type: "Dozer",        serial_number: "D9-CAT-2019-011",  status: "maintenance" as const, purchase_date: daysAgo(1800), next_service_date: daysAgo(-5),  notes: "Track replacement in progress. Est. back in service: +3d.", created_at: tsAgo(43200), updated_at: tsAgo(48) },
  { id: "de5", site_id: DEMO_SITE_ID, name: "CAT 988K Wheel Loader",    type: "Wheel Loader", serial_number: "CAT988K-2022-002", status: "operational" as const, purchase_date: daysAgo(800),  next_service_date: daysAgo(45),  notes: "ROM pad loading unit. Bucket teeth replaced Feb 2026.",    created_at: tsAgo(19200), updated_at: tsAgo(360) },
  { id: "de6", site_id: DEMO_SITE_ID, name: "Sandvik TH663 Haul Truck", type: "Haul Truck",   serial_number: "SVK-TH663-2023-1", status: "operational" as const, purchase_date: daysAgo(400),  next_service_date: daysAgo(60),  notes: "Second haul truck. Under warranty until Dec 2026.",        created_at: tsAgo(9600),  updated_at: tsAgo(192) },
  { id: "de7", site_id: DEMO_SITE_ID, name: "Metso HP400 Cone Crusher", type: "Crusher",      serial_number: "MET-HP400-2020-4", status: "operational" as const, purchase_date: daysAgo(1100), next_service_date: daysAgo(18),  notes: "Primary crusher. Mantle & concave due for inspection.",    created_at: tsAgo(26400), updated_at: tsAgo(480) },
  { id: "de8", site_id: DEMO_SITE_ID, name: "Water Truck 30kL",         type: "Water Truck",  serial_number: "WTR-2018-004",     status: "retired"    as const, purchase_date: daysAgo(2500), next_service_date: null,         notes: "Decommissioned March 2026. Replacement ordered.",          created_at: tsAgo(60000), updated_at: tsAgo(720) },
];

// ─── Safety Incidents ─────────────────────────────────────────────────────────

export const DEMO_SAFETY = [
  { id: "ds1", site_id: DEMO_SITE_ID, title: "Near-miss — loading bay forklift",          type: "near-miss"    as const, severity: "high"     as const, description: "Forklift came within 2m of a pedestrian in the ROM loading bay. Pedestrian entered restricted zone without radio clearance. Area markings under review.",         reported_by: "dw3",  incident_date: daysAgo(3),  resolved_at: null,      created_at: tsAgo(72) },
  { id: "ds2", site_id: DEMO_SITE_ID, title: "Chemical spill — reagent storage bay",       type: "environmental" as const, severity: "critical" as const, description: "~5L cyanide solution spilled during transfer. Contained with neutralising agent. Area cordoned. Full decontamination underway. Regulator notified.",             reported_by: "dw3",  incident_date: daysAgo(1),  resolved_at: null,      created_at: tsAgo(24) },
  { id: "ds3", site_id: DEMO_SITE_ID, title: "Minor hand laceration — drill core handling", type: "injury"       as const, severity: "low"      as const, description: "Lab tech sustained a 2cm laceration on right hand handling drill core trays. First aid applied on site. No lost time.",                                         reported_by: "dw3",  incident_date: daysAgo(14), resolved_at: tsAgo(312), created_at: tsAgo(336) },
  { id: "ds4", site_id: DEMO_SITE_ID, title: "Brake warning — Komatsu 730E haul road",    type: "equipment"    as const, severity: "medium"   as const, description: "Brake fault warning on haul truck during descent. Operator pulled over safely. Worn rear brake pad found and replaced same shift.",                               reported_by: "dw4",  incident_date: daysAgo(21), resolved_at: tsAgo(480), created_at: tsAgo(504) },
  { id: "ds5", site_id: DEMO_SITE_ID, title: "Dust exposure — processing plant bag filter", type: "near-miss"   as const, severity: "medium"   as const, description: "Bag filter malfunction caused dust levels to exceed PEL for ~40 mins. Workers evacuated. Filters replaced. Monitoring confirmed return to safe levels.",      reported_by: "dw11", incident_date: daysAgo(28), resolved_at: tsAgo(576), created_at: tsAgo(672) },
  { id: "ds6", site_id: DEMO_SITE_ID, title: "Sprained ankle — uneven ground north pit",   type: "injury"       as const, severity: "low"      as const, description: "Worker rolled ankle on uneven ground near drill collar. Ice applied on site. Modified duties 3 days. Area has been graded and compacted.",                       reported_by: "dw1",  incident_date: daysAgo(45), resolved_at: tsAgo(960), created_at: tsAgo(1080) },
];

// ─── Planned Shifts ───────────────────────────────────────────────────────────

function getThisMonday(): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function sd(monday: string, offset: number): string {
  const d = new Date(monday + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
const MON = getThisMonday();

export const DEMO_SHIFTS = [
  { id: "dsh1",  site_id: DEMO_SITE_ID, worker_id: "dw1",  shift_date: sd(MON,0), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh2",  site_id: DEMO_SITE_ID, worker_id: "dw2",  shift_date: sd(MON,0), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh3",  site_id: DEMO_SITE_ID, worker_id: "dw4",  shift_date: sd(MON,0), start_time:"18:00",end_time:"06:00",shift_type:"Night", notes: null, created_at: tsAgo(168) },
  { id: "dsh4",  site_id: DEMO_SITE_ID, worker_id: "dw8",  shift_date: sd(MON,0), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh5",  site_id: DEMO_SITE_ID, worker_id: "dw10", shift_date: sd(MON,0), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh6",  site_id: DEMO_SITE_ID, worker_id: "dw1",  shift_date: sd(MON,1), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh7",  site_id: DEMO_SITE_ID, worker_id: "dw3",  shift_date: sd(MON,1), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes:"Safety audit walkaround", created_at: tsAgo(168) },
  { id: "dsh8",  site_id: DEMO_SITE_ID, worker_id: "dw5",  shift_date: sd(MON,1), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh9",  site_id: DEMO_SITE_ID, worker_id: "dw9",  shift_date: sd(MON,1), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh10", site_id: DEMO_SITE_ID, worker_id: "dw6",  shift_date: sd(MON,2), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes:"East bench blast prep", created_at: tsAgo(168) },
  { id: "dsh11", site_id: DEMO_SITE_ID, worker_id: "dw2",  shift_date: sd(MON,2), start_time:"18:00",end_time:"06:00",shift_type:"Night", notes: null, created_at: tsAgo(168) },
  { id: "dsh12", site_id: DEMO_SITE_ID, worker_id: "dw12", shift_date: sd(MON,2), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh13", site_id: DEMO_SITE_ID, worker_id: "dw4",  shift_date: sd(MON,3), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh14", site_id: DEMO_SITE_ID, worker_id: "dw8",  shift_date: sd(MON,3), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh15", site_id: DEMO_SITE_ID, worker_id: "dw11", shift_date: sd(MON,3), start_time:"08:00",end_time:"16:00",shift_type:"Day",   notes:"Monthly environmental inspection", created_at: tsAgo(168) },
  { id: "dsh16", site_id: DEMO_SITE_ID, worker_id: "dw1",  shift_date: sd(MON,4), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh17", site_id: DEMO_SITE_ID, worker_id: "dw5",  shift_date: sd(MON,4), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes:"Drill core logging session", created_at: tsAgo(168) },
  { id: "dsh18", site_id: DEMO_SITE_ID, worker_id: "dw9",  shift_date: sd(MON,4), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes: null, created_at: tsAgo(168) },
  { id: "dsh19", site_id: DEMO_SITE_ID, worker_id: "dw4",  shift_date: sd(MON,5), start_time:"06:00",end_time:"18:00",shift_type:"Day",   notes:"Weekend maintenance run", created_at: tsAgo(168) },
  { id: "dsh20", site_id: DEMO_SITE_ID, worker_id: "dw10", shift_date: sd(MON,6), start_time:"06:00",end_time:"14:00",shift_type:"Day",   notes:"Standby / inspection", created_at: tsAgo(168) },
];

// ─── Shift Records ────────────────────────────────────────────────────────────

export const DEMO_SHIFT_RECORDS = [
  { id: "dsr1",  site_id: DEMO_SITE_ID, worker_id: "dw1",  shift_date: daysAgo(7),  hours_worked: 12, output_metric: null, metric_unit: null,    notes: "Supervised day shift. ROM feed on target.", created_at: tsAgo(168) },
  { id: "dsr2",  site_id: DEMO_SITE_ID, worker_id: "dw2",  shift_date: daysAgo(7),  hours_worked: 12, output_metric: 920,  metric_unit: "m",     notes: "920m drilling — east bench E-44.", created_at: tsAgo(168) },
  { id: "dsr3",  site_id: DEMO_SITE_ID, worker_id: "dw4",  shift_date: daysAgo(7),  hours_worked: 10, output_metric: 3400, metric_unit: "t",     notes: "Night shift ore loading.", created_at: tsAgo(168) },
  { id: "dsr4",  site_id: DEMO_SITE_ID, worker_id: "dw8",  shift_date: daysAgo(7),  hours_worked: 12, output_metric: 30,   metric_unit: "trips", notes: "30 haul cycles to ROM pad.", created_at: tsAgo(168) },
  { id: "dsr5",  site_id: DEMO_SITE_ID, worker_id: "dw10", shift_date: daysAgo(7),  hours_worked: 10, output_metric: null, metric_unit: null,    notes: "Scheduled PM on D9 undercarriage.", created_at: tsAgo(168) },
  { id: "dsr6",  site_id: DEMO_SITE_ID, worker_id: "dw1",  shift_date: daysAgo(6),  hours_worked: 12, output_metric: null, metric_unit: null,    notes: null, created_at: tsAgo(144) },
  { id: "dsr7",  site_id: DEMO_SITE_ID, worker_id: "dw3",  shift_date: daysAgo(6),  hours_worked: 8,  output_metric: null, metric_unit: null,    notes: "Safety compliance inspection — all clear.", created_at: tsAgo(144) },
  { id: "dsr8",  site_id: DEMO_SITE_ID, worker_id: "dw5",  shift_date: daysAgo(6),  hours_worked: 10, output_metric: 14,   metric_unit: "cores", notes: "14 drill cores logged from east bench.", created_at: tsAgo(144) },
  { id: "dsr9",  site_id: DEMO_SITE_ID, worker_id: "dw9",  shift_date: daysAgo(6),  hours_worked: 12, output_metric: null, metric_unit: null,    notes: "CIL circuit at 94% efficiency.", created_at: tsAgo(144) },
  { id: "dsr10", site_id: DEMO_SITE_ID, worker_id: "dw6",  shift_date: daysAgo(5),  hours_worked: 12, output_metric: null, metric_unit: null,    notes: "Blast prep north bench — 22 holes drilled.", created_at: tsAgo(120) },
  { id: "dsr11", site_id: DEMO_SITE_ID, worker_id: "dw2",  shift_date: daysAgo(5),  hours_worked: 11, output_metric: 780,  metric_unit: "m",     notes: "Moved rig to north bench mid-shift.", created_at: tsAgo(120) },
  { id: "dsr12", site_id: DEMO_SITE_ID, worker_id: "dw12", shift_date: daysAgo(5),  hours_worked: 12, output_metric: 840,  metric_unit: "m",     notes: "Production drilling north bench.", created_at: tsAgo(120) },
  { id: "dsr13", site_id: DEMO_SITE_ID, worker_id: "dw4",  shift_date: daysAgo(4),  hours_worked: 12, output_metric: 3100, metric_unit: "t",     notes: "CAT 390 back on dig face.", created_at: tsAgo(96) },
  { id: "dsr14", site_id: DEMO_SITE_ID, worker_id: "dw8",  shift_date: daysAgo(4),  hours_worked: 12, output_metric: 27,   metric_unit: "trips", notes: null, created_at: tsAgo(96) },
  { id: "dsr15", site_id: DEMO_SITE_ID, worker_id: "dw1",  shift_date: daysAgo(3),  hours_worked: 12, output_metric: null, metric_unit: null,    notes: "Pre-blast safety walkthrough completed.", created_at: tsAgo(72) },
];

// ─── Production Logs ──────────────────────────────────────────────────────────

export const DEMO_PRODUCTION_LOGS = [
  { id: "dp1",  site_id: DEMO_SITE_ID, log_date: daysAgo(1),  ore_tonnes: 3840, waste_tonnes: 8200, grade_g_t: 2.14, water_m3: 320, notes: "Good extraction day. East bench above average grade.", created_by: DEMO_USER_ID, created_at: tsAgo(24),  updated_at: tsAgo(24) },
  { id: "dp2",  site_id: DEMO_SITE_ID, log_date: daysAgo(2),  ore_tonnes: 3510, waste_tonnes: 7900, grade_g_t: 2.08, water_m3: 295, notes: null, created_by: DEMO_USER_ID, created_at: tsAgo(48),  updated_at: tsAgo(48) },
  { id: "dp3",  site_id: DEMO_SITE_ID, log_date: daysAgo(3),  ore_tonnes: 3720, waste_tonnes: 8100, grade_g_t: 2.21, water_m3: 310, notes: "D9 dozer in maintenance — slight throughput reduction.", created_by: DEMO_USER_ID, created_at: tsAgo(72),  updated_at: tsAgo(72) },
  { id: "dp4",  site_id: DEMO_SITE_ID, log_date: daysAgo(4),  ore_tonnes: 2900, waste_tonnes: 7200, grade_g_t: 1.98, water_m3: 280, notes: "Blast delay in morning — reduced output.", created_by: DEMO_USER_ID, created_at: tsAgo(96),  updated_at: tsAgo(96) },
  { id: "dp5",  site_id: DEMO_SITE_ID, log_date: daysAgo(5),  ore_tonnes: 4050, waste_tonnes: 8600, grade_g_t: 2.34, water_m3: 340, notes: "Best grade this month — north bench sampling confirmed.", created_by: DEMO_USER_ID, created_at: tsAgo(120), updated_at: tsAgo(120) },
  { id: "dp6",  site_id: DEMO_SITE_ID, log_date: daysAgo(8),  ore_tonnes: 3680, waste_tonnes: 8000, grade_g_t: 2.12, water_m3: 305, notes: null, created_by: DEMO_USER_ID, created_at: tsAgo(192), updated_at: tsAgo(192) },
  { id: "dp7",  site_id: DEMO_SITE_ID, log_date: daysAgo(9),  ore_tonnes: 3440, waste_tonnes: 7700, grade_g_t: 2.05, water_m3: 290, notes: null, created_by: DEMO_USER_ID, created_at: tsAgo(216), updated_at: tsAgo(216) },
  { id: "dp8",  site_id: DEMO_SITE_ID, log_date: daysAgo(10), ore_tonnes: 3780, waste_tonnes: 8300, grade_g_t: 2.18, water_m3: 315, notes: null, created_by: DEMO_USER_ID, created_at: tsAgo(240), updated_at: tsAgo(240) },
  { id: "dp9",  site_id: DEMO_SITE_ID, log_date: daysAgo(11), ore_tonnes: 3920, waste_tonnes: 8450, grade_g_t: 2.27, water_m3: 325, notes: "Processing plant at 97% utilisation.", created_by: DEMO_USER_ID, created_at: tsAgo(264), updated_at: tsAgo(264) },
  { id: "dp10", site_id: DEMO_SITE_ID, log_date: daysAgo(12), ore_tonnes: 3650, waste_tonnes: 7950, grade_g_t: 2.10, water_m3: 300, notes: null, created_by: DEMO_USER_ID, created_at: tsAgo(288), updated_at: tsAgo(288) },
];

// ─── KPI Targets ──────────────────────────────────────────────────────────────

export const DEMO_KPI_TARGETS = [
  { id: "dk1", site_id: DEMO_SITE_ID, month: monthStart(0), revenue_target: 340000, expense_budget: 150000, shift_target: 60, equipment_uptime_pct: 92, ore_tonnes_target: 90000, created_by: DEMO_USER_ID, created_at: tsAgo(672), updated_at: tsAgo(672) },
  { id: "dk2", site_id: DEMO_SITE_ID, month: monthStart(1), revenue_target: 310000, expense_budget: 145000, shift_target: 56, equipment_uptime_pct: 90, ore_tonnes_target: 85000, created_by: DEMO_USER_ID, created_at: tsAgo(1440), updated_at: tsAgo(1440) },
];

// ─── Documents ────────────────────────────────────────────────────────────────

export const DEMO_DOCUMENTS = [
  { id: "dd1", site_id: DEMO_SITE_ID, name: "Mine Safety Management Plan v3.2.pdf",        storage_path: "demo/safety-plan.pdf",        file_type: "application/pdf",          file_size: 2400000, category: "Safety",     uploaded_by: DEMO_USER_ID, created_at: tsAgo(2880) },
  { id: "dd2", site_id: DEMO_SITE_ID, name: "Q1 2026 Geological Report — North Star.pdf",  storage_path: "demo/geo-report-q1.pdf",      file_type: "application/pdf",          file_size: 5100000, category: "Geology",    uploaded_by: DEMO_USER_ID, created_at: tsAgo(720) },
  { id: "dd3", site_id: DEMO_SITE_ID, name: "Equipment Maintenance Schedule 2026.xlsx",    storage_path: "demo/maint-schedule.xlsx",    file_type: "application/vnd.ms-excel", file_size: 180000,  category: "Operations", uploaded_by: DEMO_USER_ID, created_at: tsAgo(480) },
  { id: "dd4", site_id: DEMO_SITE_ID, name: "North Star Mine Site Map — March 2026.png",   storage_path: "demo/site-map-2026.png",      file_type: "image/png",                file_size: 3800000, category: "Operations", uploaded_by: DEMO_USER_ID, created_at: tsAgo(336) },
  { id: "dd5", site_id: DEMO_SITE_ID, name: "Blasting Permit — March 2026.pdf",            storage_path: "demo/blast-permit-mar26.pdf", file_type: "application/pdf",          file_size: 420000,  category: "Compliance", uploaded_by: DEMO_USER_ID, created_at: tsAgo(240) },
  { id: "dd6", site_id: DEMO_SITE_ID, name: "Environmental Impact Assessment 2025.pdf",    storage_path: "demo/eia-2025.pdf",           file_type: "application/pdf",          file_size: 8200000, category: "Compliance", uploaded_by: DEMO_USER_ID, created_at: tsAgo(2160) },
  { id: "dd7", site_id: DEMO_SITE_ID, name: "Cyanide Management Procedure v2.pdf",         storage_path: "demo/cyanide-procedure.pdf",  file_type: "application/pdf",          file_size: 960000,  category: "Safety",     uploaded_by: DEMO_USER_ID, created_at: tsAgo(1440) },
  { id: "dd8", site_id: DEMO_SITE_ID, name: "Ore Reserve Estimate — Dec 2025.xlsx",        storage_path: "demo/ore-reserve-dec25.xlsx", file_type: "application/vnd.ms-excel", file_size: 340000,  category: "Geology",    uploaded_by: DEMO_USER_ID, created_at: tsAgo(2400) },
];

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const DEMO_SUPPLIERS = [
  { id: "dsu1", org_id: DEMO_ORG_ID, name: "Orica Mining Services",   contact_name: "Tom Brennan",   email: "t.brennan@orica.com",       phone: "+61 8 9200 1100", address: "12 Industrial Ave, Kalgoorlie WA 6430", category: "Explosives", status: "active"   as const, created_at: tsAgo(9600) },
  { id: "dsu2", org_id: DEMO_ORG_ID, name: "WA Fuels & Lubricants",   contact_name: "Karen Yip",     email: "karen@wafuels.com.au",       phone: "+61 8 9022 4400", address: "88 Fuel Rd, Boulder WA 6432",           category: "Fuel",       status: "active"   as const, created_at: tsAgo(9120) },
  { id: "dsu3", org_id: DEMO_ORG_ID, name: "SafeGear Australia",      contact_name: "Marcus Lloyd",  email: "m.lloyd@safegear.com.au",    phone: "+61 2 9300 5500", address: "22 Safety St, Perth WA 6000",           category: "PPE",        status: "active"   as const, created_at: tsAgo(8400) },
  { id: "dsu4", org_id: DEMO_ORG_ID, name: "Reagents Direct Pty Ltd", contact_name: "Sandra Lim",    email: "slim@reagentsdirect.com.au", phone: "+61 8 9300 7700", address: "4 Process Rd, Kalgoorlie WA 6430",      category: "Reagents",   status: "active"   as const, created_at: tsAgo(7200) },
  { id: "dsu5", org_id: DEMO_ORG_ID, name: "Caterpillar Financial",   contact_name: "James Hardy",   email: "j.hardy@cat.com",            phone: "+61 3 9200 8800", address: "1 CAT Way, Melbourne VIC 3000",          category: "Equipment",  status: "active"   as const, created_at: tsAgo(6000) },
  { id: "dsu6", org_id: DEMO_ORG_ID, name: "Drill Masters WA",        contact_name: "Phil Thompson", email: "phil@drillmasterswa.com.au", phone: "+61 8 9055 3300", address: "77 Drill St, Kalgoorlie WA 6430",       category: "Drilling",   status: "inactive" as const, created_at: tsAgo(4800) },
];

// ─── Channels (supply) ────────────────────────────────────────────────────────

export const DEMO_CHANNELS = [
  { id: "dch1", org_id: DEMO_ORG_ID, name: "Orica Direct Account",          type: "Direct",   description: "Preferred channel for all explosive consumables from Orica.",           created_at: tsAgo(9120) },
  { id: "dch2", org_id: DEMO_ORG_ID, name: "WA Fuels Contract Delivery",    type: "Contract", description: "Monthly fuel delivery at negotiated rates, locked until Dec 2026.",       created_at: tsAgo(8640) },
  { id: "dch3", org_id: DEMO_ORG_ID, name: "SafeGear Online Portal",        type: "Online",   description: "Online PPE orders with 2–3 day delivery to Kalgoorlie.",                 created_at: tsAgo(7680) },
  { id: "dch4", org_id: DEMO_ORG_ID, name: "Reagents Direct Standing Order",type: "Standing", description: "Auto-replenishment triggered on cyanide & lime reorder level breach.",    created_at: tsAgo(6720) },
];

// ─── Orders ───────────────────────────────────────────────────────────────────

export const DEMO_ORDERS = [
  { id: "do1", site_id: DEMO_SITE_ID, supplier_id: "dsu2", order_number: "PO-2026-0041", status: "delivered" as const,  total_amount: 18130, expected_delivery: daysAgo(4),  notes: "Diesel — 9,800L @ $1.85/L",              created_at: tsAgo(192) },
  { id: "do2", site_id: DEMO_SITE_ID, supplier_id: "dsu1", order_number: "PO-2026-0042", status: "delivered" as const,  total_amount: 4860,  expected_delivery: daysAgo(18), notes: "ANFO 3.2t + electric blast caps x200",    created_at: tsAgo(528) },
  { id: "do3", site_id: DEMO_SITE_ID, supplier_id: "dsu3", order_number: "PO-2026-0043", status: "confirmed" as const,  total_amount: 2340,  expected_delivery: daysAgo(-5), notes: "PPE restock — helmets, boots, glasses",   created_at: tsAgo(72) },
  { id: "do4", site_id: DEMO_SITE_ID, supplier_id: "dsu4", order_number: "PO-2026-0044", status: "pending"   as const,  total_amount: 7040,  expected_delivery: daysAgo(-8), notes: "Cyanide 320L + activated carbon 300kg",   created_at: tsAgo(24) },
  { id: "do5", site_id: DEMO_SITE_ID, supplier_id: "dsu2", order_number: "PO-2026-0045", status: "pending"   as const,  total_amount: 19200, expected_delivery: daysAgo(-3), notes: "Diesel bulk — scheduled replenishment",   created_at: tsAgo(4) },
  { id: "do6", site_id: DEMO_SITE_ID, supplier_id: "dsu5", order_number: "PO-2026-0040", status: "delivered" as const,  total_amount: 22400, expected_delivery: daysAgo(38), notes: "D9 dozer track replacement parts",         created_at: tsAgo(1056) },
];

// ─── Messages ─────────────────────────────────────────────────────────────────

export const DEMO_MESSAGES = [
  { id: "dm1",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw1",  content: "Morning all — day shift starts at 06:00. Meet at the ROM pad. Bring water, temps hitting 38°C today.", created_at: tsAgo(1) },
  { id: "dm2",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw3",  content: "Reminder: monthly safety toolbox meeting is Thursday 07:30 in the training room. Attendance mandatory for all supervisors.", created_at: tsAgo(2) },
  { id: "dm3",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw5",  content: "Drill cores from east bench E-44 are showing elevated gold grades — avg 2.34 g/t. Geological report going out this afternoon.", created_at: tsAgo(5) },
  { id: "dm4",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw8",  content: "Completed 30 haul cycles today. ROM stockpile looking good. Who is on night shift?", created_at: tsAgo(7) },
  { id: "dm5",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw1",  content: "Ben is on tonight 18:00. Check in at control room at 17:45 for handover.", created_at: tsAgo(8) },
  { id: "dm6",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw9",  content: "Processing plant running at 97% today — CIL circuit looking great. Gold pour scheduled Friday morning at 08:00.", created_at: tsAgo(24) },
  { id: "dm7",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw10", content: "PM complete on Komatsu 730E. Replaced rear brake pads and greased all service points. Ready to return to service.", created_at: tsAgo(36) },
  { id: "dm8",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw2",  content: "Moving drill rig to north bench tomorrow morning. Should take about 2 hours. Will need a wide-load escort from the depot.", created_at: tsAgo(48) },
  { id: "dm9",  site_id: DEMO_SITE_ID, channel: "general"    as const, sender_id: "dw1",  content: "Gold pour Friday 08:00 confirmed. Security escort arranged. All supervisors to attend. Formal report will follow.", created_at: tsAgo(60) },
  { id: "dm10", site_id: DEMO_SITE_ID, channel: "safety"     as const, sender_id: "dw3",  content: "ALERT: Chemical spill in reagent bay CONTAINED. Area is CORDONED OFF. Do NOT enter without full PPE and authorisation.", created_at: tsAgo(24) },
  { id: "dm11", site_id: DEMO_SITE_ID, channel: "safety"     as const, sender_id: "dw11", content: "Decontamination crew on site now. Estimated 4 hours to complete. Regulator notification has been submitted.", created_at: tsAgo(25) },
  { id: "dm12", site_id: DEMO_SITE_ID, channel: "safety"     as const, sender_id: "dw3",  content: "All cyanide antidote kits must be checked — ensure they are in-date and stored correctly. Check is mandatory by EOD today.", created_at: tsAgo(30) },
  { id: "dm13", site_id: DEMO_SITE_ID, channel: "safety"     as const, sender_id: "dw3",  content: "Near-miss incident (loading bay forklift) report submitted. Investigation team meeting tomorrow 09:00 in the site office.", created_at: tsAgo(72) },
  { id: "dm14", site_id: DEMO_SITE_ID, channel: "safety"     as const, sender_id: "dw11", content: "Monthly dust monitoring results in. All within limits except drill area (slightly elevated). Extra suppression water applied.", created_at: tsAgo(120) },
  { id: "dm15", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw4",  content: "D9 dozer tracks being replaced today. Use CAT 988K for push work in the meantime. Back in service by end of tomorrow.", created_at: tsAgo(48) },
  { id: "dm16", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw6",  content: "North bench blast prep complete. 22 holes charged and connected. Blast at 14:00 today — keep exclusion zone clear.", created_at: tsAgo(36) },
  { id: "dm17", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw2",  content: "Drilling complete on E-44 line — 920m total. Moving rig to N-18 north bench tomorrow morning.", created_at: tsAgo(24) },
  { id: "dm18", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw4",  content: "CAT 390 hydraulic arm making noise on full extension. Logged in maintenance system — Tom to inspect at next PM window.", created_at: tsAgo(48) },
  { id: "dm19", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw1",  content: "Ore stockpile at 92% ROM capacity. Scheduling extra haul shifts this week to clear stock before wet season arrives.", created_at: tsAgo(72) },
  { id: "dm20", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw9",  content: "Process water tank at 68%. Request diesel pump run tonight to top up from bore. Please confirm.", created_at: tsAgo(96) },
];

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const DEMO_CAMPAIGNS = [
  { id: "dc1", site_id: DEMO_SITE_ID, title: "Q1 2026 Safety Drive",            description: "Zero harm initiative — PPE compliance, near-miss reporting, and toolbox talk attendance across all shifts. Target: 0 LTIs for Q1.", status: "active"    as const, start_date: daysAgo(90),  end_date: daysAgo(-1),  created_at: tsAgo(2160) },
  { id: "dc2", site_id: DEMO_SITE_ID, title: "Fuel Efficiency Challenge",        description: "Reduce diesel consumption by 8% via eco-driving training and route optimisation. Tracking weekly against March 2026 baseline.",   status: "active"    as const, start_date: daysAgo(30),  end_date: daysAgo(-14), created_at: tsAgo(768) },
  { id: "dc3", site_id: DEMO_SITE_ID, title: "March Site Clean-Up Month",        description: "Housekeeping across all work areas — correct waste disposal, spill kit locations, reagent storage compliance checks.",             status: "active"    as const, start_date: daysAgo(28),  end_date: daysAgo(-2),  created_at: tsAgo(720) },
  { id: "dc4", site_id: DEMO_SITE_ID, title: "Equipment Care Awareness Program", description: "Operator care & pre-start inspection campaign. Goal: reduce unplanned equipment downtime by 15% vs Q4 2025.",                    status: "completed" as const, start_date: daysAgo(120), end_date: daysAgo(30),  created_at: tsAgo(3000) },
  { id: "dc5", site_id: DEMO_SITE_ID, title: "Summer Hydration & Heat Safety",   description: "Heat awareness program — mandatory hydration breaks, shade structure use, buddy system for afternoon shifts over 35°C.",         status: "completed" as const, start_date: daysAgo(90),  end_date: daysAgo(14),  created_at: tsAgo(2280) },
];

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const DEMO_AUDIT_LOGS = [
  { id: "da1",  entity_type: "inventory_items",  entity_id: "di1",  action: "UPDATE", before: { quantity: 15 }, after: { quantity: 8  }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(48) },
  { id: "da2",  entity_type: "equipment",        entity_id: "de4",  action: "UPDATE", before: { status: "operational" }, after: { status: "maintenance" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(48) },
  { id: "da3",  entity_type: "inventory_items",  entity_id: "di6",  action: "UPDATE", before: { quantity: 8  }, after: { quantity: 3  }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(72) },
  { id: "da4",  entity_type: "transactions",     entity_id: "dt1",  action: "INSERT", before: null, after: { type: "income", unit_price: 156800, description: "Gold dore sale — Batch #47" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(48) },
  { id: "da5",  entity_type: "safety_incidents", entity_id: "ds2",  action: "INSERT", before: null, after: { severity: "critical", title: "Chemical spill — reagent storage bay" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(24) },
  { id: "da6",  entity_type: "inventory_items",  entity_id: "di5",  action: "UPDATE", before: { quantity: 5800 }, after: { quantity: 4200 }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(96) },
  { id: "da7",  entity_type: "transactions",     entity_id: "dt4",  action: "INSERT", before: null, after: { type: "income", unit_price: 71500, description: "Copper concentrate — 38t" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(240) },
  { id: "da8",  entity_type: "safety_incidents", entity_id: "ds3",  action: "UPDATE", before: { resolved_at: null }, after: { resolved_at: tsAgo(312) }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(312) },
  { id: "da9",  entity_type: "equipment",        entity_id: "de2",  action: "UPDATE", before: { status: "maintenance" }, after: { status: "operational" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(240) },
  { id: "da10", entity_type: "workers",          entity_id: "dw12", action: "INSERT", before: null, after: { full_name: "Marcus O'Brien", position: "Drill Operator" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: tsAgo(1080) },
];

// ─── Notifications ────────────────────────────────────────────────────────────

export const DEMO_NOTIFICATIONS = [
  { id: "dn1", user_id: DEMO_USER_ID, type: "alert"  as const, title: "Critical safety incident reported",       body: "A critical cyanide spill has been reported in the reagent storage bay. Decontamination in progress.", read: false, created_at: tsAgo(24) },
  { id: "dn2", user_id: DEMO_USER_ID, type: "alert"  as const, title: "Low stock: Safety Helmets",               body: "Safety Helmets (8 pcs) is below reorder level (15). A purchase order is recommended.",              read: false, created_at: tsAgo(48) },
  { id: "dn3", user_id: DEMO_USER_ID, type: "alert"  as const, title: "Low stock: Drill Bits 38mm",              body: "Drill Bits 38mm (3 pcs) is below reorder level (5). Order from Orica or Drill Masters WA.",          read: false, created_at: tsAgo(72) },
  { id: "dn4", user_id: DEMO_USER_ID, type: "warning" as const, title: "CAT 390 Excavator overdue for service",   body: "CAT 390 Excavator (CAT390-2021-001) is 15 days past scheduled service date.",                        read: true,  created_at: tsAgo(96) },
  { id: "dn5", user_id: DEMO_USER_ID, type: "warning" as const, title: "Komatsu 730E overdue for service",        body: "Komatsu 730E Haul Truck (KOM730-2020-003) is 12 days past scheduled service date.",                  read: true,  created_at: tsAgo(96) },
  { id: "dn6", user_id: DEMO_USER_ID, type: "info"    as const, title: "PO-2026-0043 confirmed by SafeGear",      body: "Purchase order for PPE restock has been confirmed. Expected delivery in 5 days.",                     read: true,  created_at: tsAgo(72) },
  { id: "dn7", user_id: DEMO_USER_ID, type: "alert"   as const, title: "Near-miss — loading bay forklift",        body: "A near-miss incident has been reported at the ROM loading bay. Investigation team meeting tomorrow.",  read: true,  created_at: tsAgo(72) },
  { id: "dn8", user_id: DEMO_USER_ID, type: "info"    as const, title: "Weekly KPI report sent",                  body: "Weekly digest for North Star Mine sent to reports@fwmining.demo.",                                    read: true,  created_at: tsAgo(168) },
];

// ─── Reports data ─────────────────────────────────────────────────────────────

export const DEMO_MONTHLY_TREND = [
  { month: monthStart(5), income: 268000, expenses: 118000 },
  { month: monthStart(4), income: 295000, expenses: 124000 },
  { month: monthStart(3), income: 312000, expenses: 131000 },
  { month: monthStart(2), income: 287000, expenses: 128000 },
  { month: monthStart(1), income: 320000, expenses: 138000 },
  { month: monthStart(0), income: 237500, expenses: 93100  },
];

export const DEMO_EXPENSES_BY_CATEGORY = [
  { category: "Labour",      total: 175200 },
  { category: "Fuel",        total: 94140  },
  { category: "Maintenance", total: 63700  },
  { category: "Explosives",  total: 29160  },
  { category: "Reagents",    total: 28160  },
  { category: "Safety",      total: 21600  },
  { category: "Equipment",   total: 22400  },
];

export const DEMO_REPORT_SUMMARY = {
  totalIncome:       1719500,
  totalExpenses:     732360,
  netRevenue:        987140,
  transactionCount:  24,
  totalShiftsLogged: 94,
  totalHoursWorked:  1068,
};

export const DEMO_PRODUCTION_BY_DAY = [
  { date: daysAgo(12), totalHours: 34, totalOutput: 3780, shiftsLogged: 3 },
  { date: daysAgo(11), totalHours: 36, totalOutput: 3920, shiftsLogged: 4 },
  { date: daysAgo(10), totalHours: 32, totalOutput: 3650, shiftsLogged: 3 },
  { date: daysAgo(9),  totalHours: 33, totalOutput: 3440, shiftsLogged: 3 },
  { date: daysAgo(8),  totalHours: 35, totalOutput: 3680, shiftsLogged: 3 },
  { date: daysAgo(5),  totalHours: 38, totalOutput: 4050, shiftsLogged: 4 },
  { date: daysAgo(4),  totalHours: 28, totalOutput: 2900, shiftsLogged: 3 },
  { date: daysAgo(3),  totalHours: 34, totalOutput: 3720, shiftsLogged: 3 },
  { date: daysAgo(2),  totalHours: 32, totalOutput: 3510, shiftsLogged: 3 },
  { date: daysAgo(1),  totalHours: 36, totalOutput: 3840, shiftsLogged: 4 },
];

// ─── Customer Summaries (pre-computed for demo mode) ──────────────────────────
// Income: ext1 = dt1+dt7+dt13+dt19+dt24 = 156800+9240+148200+138500+135900 = 588640
//         ext2 = dt4+dt10+dt16+dt20 = 71500+79800+143700+66500 = 361500
// Expenses (internal): fuel=74330, labor=219200, maint=63700, chemicals=7040, other=10260 → total=374530

export const DEMO_CUSTOMER_SUMMARIES = [
  {
    customerId:       DEMO_CUSTOMER_ID_EXT1,
    customerName:     "Goldfield Contractors Pty Ltd",
    customerType:     "external" as const,
    totalIncome:      588640,
    totalExpenses:    0,
    netProfit:        588640,
    transactionCount: 5,
    expensesByCategory: [],
  },
  {
    customerId:       DEMO_CUSTOMER_ID_EXT2,
    customerName:     "Apex Drilling Services",
    customerType:     "external" as const,
    totalIncome:      361500,
    totalExpenses:    0,
    netProfit:        361500,
    transactionCount: 4,
    expensesByCategory: [],
  },
  {
    customerId:       DEMO_CUSTOMER_ID_INTERNAL,
    customerName:     "Internal Operations",
    customerType:     "internal" as const,
    totalIncome:      0,
    totalExpenses:    374530,
    netProfit:        -374530,
    transactionCount: 15,
    expensesByCategory: [
      { category: "Labor",              total: 219200 },
      { category: "Fuel",               total: 74330  },
      { category: "Maintenance",        total: 63700  },
      { category: "Chemicals/Reagents", total: 7040   },
      { category: "Uncategorized",      total: 10260  },
    ],
  },
];
