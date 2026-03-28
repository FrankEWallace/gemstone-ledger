/**
 * All demo / sample data for FW Mining OS.
 * These records are returned by service functions when isDemoMode() is true.
 */

import { DEMO_SITE_ID, DEMO_ORG_ID, DEMO_USER_ID } from "./index";

const now = new Date();
const d = (daysAgo: number) => {
  const dt = new Date(now);
  dt.setDate(now.getDate() - daysAgo);
  return dt.toISOString().slice(0, 10);
};
const ts = (daysAgo: number) => {
  const dt = new Date(now);
  dt.setDate(now.getDate() - daysAgo);
  return dt.toISOString();
};

// ─── Organization & Site ──────────────────────────────────────────────────────

export const DEMO_ORG = {
  id: DEMO_ORG_ID,
  name: "FW Mining Demo Co.",
  slug: "fw-mining-demo",
  logo_url: null,
  created_at: ts(180),
  weekly_report_enabled: false,
  weekly_report_email: null,
};

export const DEMO_SITE = {
  id: DEMO_SITE_ID,
  org_id: DEMO_ORG_ID,
  name: "North Star Mine",
  location: "Kalgoorlie, WA",
  timezone: "Australia/Perth",
  status: "active" as const,
  created_at: ts(180),
};

export const DEMO_USER_PROFILE = {
  id: DEMO_USER_ID,
  org_id: DEMO_ORG_ID,
  full_name: "Alex Demo",
  avatar_url: null,
  phone: "+61 400 000 000",
  created_at: ts(180),
  onboarding_completed: true,
};

// ─── Workers ─────────────────────────────────────────────────────────────────

export const DEMO_WORKERS = [
  { id: "dw1", site_id: DEMO_SITE_ID, full_name: "Sarah Mitchell",  position: "Mine Supervisor",   department: "Operations",  hire_date: d(400), status: "active" as const, created_at: ts(400) },
  { id: "dw2", site_id: DEMO_SITE_ID, full_name: "James Okoye",     position: "Drill Operator",     department: "Drilling",    hire_date: d(300), status: "active" as const, created_at: ts(300) },
  { id: "dw3", site_id: DEMO_SITE_ID, full_name: "Priya Sharma",    position: "Safety Officer",     department: "Safety",      hire_date: d(250), status: "active" as const, created_at: ts(250) },
  { id: "dw4", site_id: DEMO_SITE_ID, full_name: "Ben Fitzgerald",   position: "Equipment Operator", department: "Operations",  hire_date: d(200), status: "active" as const, created_at: ts(200) },
  { id: "dw5", site_id: DEMO_SITE_ID, full_name: "Yuki Tanaka",      position: "Geologist",          department: "Geology",     hire_date: d(150), status: "active" as const, created_at: ts(150) },
  { id: "dw6", site_id: DEMO_SITE_ID, full_name: "Carlos Mendez",    position: "Blasting Tech",      department: "Drilling",    hire_date: d(120), status: "active" as const, created_at: ts(120) },
  { id: "dw7", site_id: DEMO_SITE_ID, full_name: "Emma Walsh",       position: "Lab Technician",     department: "Geology",     hire_date: d(90),  status: "on_leave" as const, created_at: ts(90) },
  { id: "dw8", site_id: DEMO_SITE_ID, full_name: "David Nguyen",     position: "Truck Driver",       department: "Transport",   hire_date: d(60),  status: "active" as const, created_at: ts(60) },
];

// ─── Inventory ────────────────────────────────────────────────────────────────

export const DEMO_INVENTORY = [
  { id: "di1",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Safety Helmets",         category: "PPE",        sku: "PPE-001", quantity: 8,    unit: "pcs", unit_cost: 45,    reorder_level: 15,  created_at: ts(120), updated_at: ts(5) },
  { id: "di2",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Hi-Vis Vests",           category: "PPE",        sku: "PPE-002", quantity: 22,   unit: "pcs", unit_cost: 18,    reorder_level: 20,  created_at: ts(120), updated_at: ts(5) },
  { id: "di3",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Steel-Toe Boots (Sz10)", category: "PPE",        sku: "PPE-003", quantity: 4,    unit: "prs", unit_cost: 130,   reorder_level: 8,   created_at: ts(120), updated_at: ts(3) },
  { id: "di4",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Hydraulic Fluid 46W",    category: "Lubricants", sku: "LUB-001", quantity: 14,   unit: "L",   unit_cost: 12,    reorder_level: 20,  created_at: ts(100), updated_at: ts(7) },
  { id: "di5",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Diesel (Bulk)",           category: "Fuel",       sku: "FUE-001", quantity: 4200, unit: "L",   unit_cost: 1.85,  reorder_level: 2000, created_at: ts(90), updated_at: ts(1) },
  { id: "di6",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Drill Bits 38mm",         category: "Drilling",   sku: "DRL-001", quantity: 3,    unit: "pcs", unit_cost: 280,   reorder_level: 5,   created_at: ts(80),  updated_at: ts(2) },
  { id: "di7",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Blast Caps (Electric)",   category: "Explosives", sku: "EXP-001", quantity: 150,  unit: "pcs", unit_cost: 8.5,   reorder_level: 100, created_at: ts(80),  updated_at: ts(4) },
  { id: "di8",  site_id: DEMO_SITE_ID, supplier_id: null, name: "ANFO (Bulk)",             category: "Explosives", sku: "EXP-002", quantity: 2800, unit: "kg",  unit_cost: 0.95,  reorder_level: 1000, created_at: ts(75), updated_at: ts(4) },
  { id: "di9",  site_id: DEMO_SITE_ID, supplier_id: null, name: "Cyanide Solution 10%",    category: "Reagents",   sku: "REA-001", quantity: 320,  unit: "L",   unit_cost: 22,    reorder_level: 200, created_at: ts(70),  updated_at: ts(6) },
  { id: "di10", site_id: DEMO_SITE_ID, supplier_id: null, name: "Lime (Hydrated)",         category: "Reagents",   sku: "REA-002", quantity: 1800, unit: "kg",  unit_cost: 0.45,  reorder_level: 500, created_at: ts(70),  updated_at: ts(6) },
  { id: "di11", site_id: DEMO_SITE_ID, supplier_id: null, name: "Replacement Filters",     category: "Maintenance",sku: "MNT-001", quantity: 18,   unit: "pcs", unit_cost: 65,    reorder_level: 10,  created_at: ts(60),  updated_at: ts(8) },
  { id: "di12", site_id: DEMO_SITE_ID, supplier_id: null, name: "First Aid Kits",          category: "Safety",     sku: "SAF-001", quantity: 6,    unit: "kits",unit_cost: 95,    reorder_level: 5,   created_at: ts(50),  updated_at: ts(10) },
  { id: "di13", site_id: DEMO_SITE_ID, supplier_id: null, name: "Gloves (Nitrile, L)",     category: "PPE",        sku: "PPE-004", quantity: 200,  unit: "prs", unit_cost: 2.8,   reorder_level: 100, created_at: ts(45),  updated_at: ts(2) },
  { id: "di14", site_id: DEMO_SITE_ID, supplier_id: null, name: "Eye Protection (Safety)", category: "PPE",        sku: "PPE-005", quantity: 11,   unit: "pcs", unit_cost: 24,    reorder_level: 15,  created_at: ts(40),  updated_at: ts(5) },
  { id: "di15", site_id: DEMO_SITE_ID, supplier_id: null, name: "Conveyor Belt Sections",  category: "Maintenance",sku: "MNT-002", quantity: 2,    unit: "pcs", unit_cost: 1200,  reorder_level: 2,   created_at: ts(30),  updated_at: ts(9) },
];

// ─── Transactions ─────────────────────────────────────────────────────────────

export const DEMO_TRANSACTIONS = [
  { id: "dt1",  site_id: DEMO_SITE_ID, type: "income" as const,  category: "Sales",       description: "Gold ore sale — Batch #44",          quantity: 1, unit_price: 142500, status: "success" as const, transaction_date: d(2),  created_at: ts(2) },
  { id: "dt2",  site_id: DEMO_SITE_ID, type: "expense" as const, category: "Fuel",        description: "Diesel bulk delivery",               quantity: 1, unit_price: 18900,  status: "success" as const, transaction_date: d(4),  created_at: ts(4) },
  { id: "dt3",  site_id: DEMO_SITE_ID, type: "expense" as const, category: "Equipment",   description: "Equipment hire — D9 Dozer (5 days)", quantity: 5, unit_price: 3200,   status: "success" as const, transaction_date: d(7),  created_at: ts(7) },
  { id: "dt4",  site_id: DEMO_SITE_ID, type: "income" as const,  category: "Sales",       description: "Copper concentrate sale",             quantity: 1, unit_price: 67000,  status: "success" as const, transaction_date: d(10), created_at: ts(10) },
  { id: "dt5",  site_id: DEMO_SITE_ID, type: "expense" as const, category: "Safety",      description: "Safety gear & PPE restock",          quantity: 1, unit_price: 5400,   status: "success" as const, transaction_date: d(12), created_at: ts(12) },
  { id: "dt6",  site_id: DEMO_SITE_ID, type: "expense" as const, category: "Labour",      description: "Weekly payroll — Week 11",           quantity: 1, unit_price: 42000,  status: "success" as const, transaction_date: d(14), created_at: ts(14) },
  { id: "dt7",  site_id: DEMO_SITE_ID, type: "income" as const,  category: "Sales",       description: "Silver by-product sale",             quantity: 1, unit_price: 8200,   status: "success" as const, transaction_date: d(18), created_at: ts(18) },
  { id: "dt8",  site_id: DEMO_SITE_ID, type: "expense" as const, category: "Maintenance", description: "Hydraulic pump repair — CAT 390",    quantity: 1, unit_price: 9800,   status: "success" as const, transaction_date: d(21), created_at: ts(21) },
  { id: "dt9",  site_id: DEMO_SITE_ID, type: "expense" as const, category: "Reagents",    description: "Cyanide solution top-up",            quantity: 1, unit_price: 7040,   status: "success" as const, transaction_date: d(25), created_at: ts(25) },
  { id: "dt10", site_id: DEMO_SITE_ID, type: "income" as const,  category: "Sales",       description: "Gold ore sale — Batch #43",          quantity: 1, unit_price: 138700, status: "success" as const, transaction_date: d(30), created_at: ts(30) },
  { id: "dt11", site_id: DEMO_SITE_ID, type: "expense" as const, category: "Labour",      description: "Weekly payroll — Week 10",           quantity: 1, unit_price: 42000,  status: "success" as const, transaction_date: d(35), created_at: ts(35) },
  { id: "dt12", site_id: DEMO_SITE_ID, type: "expense" as const, category: "Explosives",  description: "ANFO & blast caps order",            quantity: 1, unit_price: 4200,   status: "success" as const, transaction_date: d(38), created_at: ts(38) },
  { id: "dt13", site_id: DEMO_SITE_ID, type: "income" as const,  category: "Sales",       description: "Copper concentrate sale",             quantity: 1, unit_price: 71500,  status: "pending" as const, transaction_date: d(1),  created_at: ts(1) },
  { id: "dt14", site_id: DEMO_SITE_ID, type: "expense" as const, category: "Fuel",        description: "Diesel bulk delivery",               quantity: 1, unit_price: 19200,  status: "pending" as const, transaction_date: d(0),  created_at: ts(0) },
  { id: "dt15", site_id: DEMO_SITE_ID, type: "expense" as const, category: "Labour",      description: "Weekly payroll — Week 12",           quantity: 1, unit_price: 42000,  status: "pending" as const, transaction_date: d(0),  created_at: ts(0) },
];

// ─── Equipment ────────────────────────────────────────────────────────────────

export const DEMO_EQUIPMENT = [
  { id: "de1", site_id: DEMO_SITE_ID, name: "CAT 390 Excavator",      type: "Excavator",    serial_number: "CAT390-2021-001", status: "operational" as const, purchase_date: d(800), next_service_date: d(-15), notes: "Main dig face unit. Hydraulic system serviced March 2026.", created_at: ts(800), updated_at: ts(5) },
  { id: "de2", site_id: DEMO_SITE_ID, name: "Komatsu 730E Haul Truck", type: "Haul Truck",   serial_number: "KOM730-2020-003", status: "operational" as const, purchase_date: d(900), next_service_date: d(12),  notes: "Primary ore transport. Tyres replaced Jan 2026.", created_at: ts(900), updated_at: ts(10) },
  { id: "de3", site_id: DEMO_SITE_ID, name: "Atlas Copco Drill Rig",   type: "Drill Rig",    serial_number: "ACR-2022-007",   status: "operational" as const, purchase_date: d(500), next_service_date: d(25),  notes: "Production drilling. 38mm bits.", created_at: ts(500), updated_at: ts(12) },
  { id: "de4", site_id: DEMO_SITE_ID, name: "D9 Bulldozer",            type: "Dozer",        serial_number: "D9-2019-011",    status: "maintenance" as const, purchase_date: d(1200), next_service_date: d(-5), notes: "Track replacement in progress. Est. return to service in 3 days.", created_at: ts(1200), updated_at: ts(2) },
  { id: "de5", site_id: DEMO_SITE_ID, name: "CAT 988K Wheel Loader",   type: "Wheel Loader", serial_number: "CAT988-2022-002",status: "operational" as const, purchase_date: d(600), next_service_date: d(45),  notes: "ROM pad loading unit.", created_at: ts(600), updated_at: ts(15) },
  { id: "de6", site_id: DEMO_SITE_ID, name: "Water Truck 30kL",        type: "Water Truck",  serial_number: "WTR-2020-004",   status: "retired" as const,     purchase_date: d(1500), next_service_date: null,  notes: "Decommissioned. Replacement on order.", created_at: ts(1500), updated_at: ts(30) },
];

// ─── Safety Incidents ─────────────────────────────────────────────────────────

export const DEMO_SAFETY = [
  { id: "ds1", site_id: DEMO_SITE_ID, title: "Near-miss — loading bay forklift",   type: "near-miss" as const,  severity: "high" as const,     description: "Forklift operator nearly struck a pedestrian in the ROM pad loading bay. Pedestrian walked into restricted zone without correct clearance.", reported_by: DEMO_USER_ID, incident_date: d(3),  resolved_at: null,   created_at: ts(3) },
  { id: "ds2", site_id: DEMO_SITE_ID, title: "Chemical spill — reagent storage",   type: "environmental" as const, severity: "critical" as const, description: "Minor cyanide solution spill (~5L) in reagent storage area. Spill contained with neutralising agent. Area cordoned off pending full decontamination.", reported_by: DEMO_USER_ID, incident_date: d(1),  resolved_at: null,   created_at: ts(1) },
  { id: "ds3", site_id: DEMO_SITE_ID, title: "Hand injury — sample processing",    type: "injury" as const,     severity: "medium" as const,   description: "Lab technician sustained minor laceration while processing drill core samples. First aid administered on site.", reported_by: DEMO_USER_ID, incident_date: d(14), resolved_at: ts(13), created_at: ts(14) },
  { id: "ds4", site_id: DEMO_SITE_ID, title: "Equipment — brake fault on haul road", type: "equipment" as const, severity: "low" as const,      description: "Haul truck brake warning light activated during descent. Vehicle pulled over safely and inspected. Minor brake adjustment made.", reported_by: DEMO_USER_ID, incident_date: d(21), resolved_at: ts(20), created_at: ts(21) },
];

// ─── Planned Shifts ───────────────────────────────────────────────────────────

const thisMonday = (() => {
  const d2 = new Date(now);
  const day = d2.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d2.setDate(d2.getDate() + diff);
  return d2.toISOString().slice(0, 10);
})();

function shiftDate(daysFromMonday: number) {
  const dt = new Date(thisMonday);
  dt.setDate(dt.getDate() + daysFromMonday);
  return dt.toISOString().slice(0, 10);
}

export const DEMO_SHIFTS = [
  { id: "dsh1",  site_id: DEMO_SITE_ID, worker_id: "dw1", shift_date: shiftDate(0), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh2",  site_id: DEMO_SITE_ID, worker_id: "dw2", shift_date: shiftDate(0), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh3",  site_id: DEMO_SITE_ID, worker_id: "dw4", shift_date: shiftDate(0), start_time: "18:00", end_time: "06:00", shift_type: "Night", notes: null, created_at: ts(5) },
  { id: "dsh4",  site_id: DEMO_SITE_ID, worker_id: "dw8", shift_date: shiftDate(0), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh5",  site_id: DEMO_SITE_ID, worker_id: "dw1", shift_date: shiftDate(1), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh6",  site_id: DEMO_SITE_ID, worker_id: "dw3", shift_date: shiftDate(1), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh7",  site_id: DEMO_SITE_ID, worker_id: "dw5", shift_date: shiftDate(1), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh8",  site_id: DEMO_SITE_ID, worker_id: "dw6", shift_date: shiftDate(2), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh9",  site_id: DEMO_SITE_ID, worker_id: "dw2", shift_date: shiftDate(2), start_time: "18:00", end_time: "06:00", shift_type: "Night", notes: null, created_at: ts(5) },
  { id: "dsh10", site_id: DEMO_SITE_ID, worker_id: "dw4", shift_date: shiftDate(3), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh11", site_id: DEMO_SITE_ID, worker_id: "dw8", shift_date: shiftDate(3), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
  { id: "dsh12", site_id: DEMO_SITE_ID, worker_id: "dw1", shift_date: shiftDate(4), start_time: "06:00", end_time: "18:00", shift_type: "Day",   notes: null, created_at: ts(5) },
];

// ─── Shift Records (actual hours worked) ─────────────────────────────────────

export const DEMO_SHIFT_RECORDS = [
  { id: "dsr1", site_id: DEMO_SITE_ID, worker_id: "dw1", shift_date: d(7),  hours_worked: 12, output_metric: null,  metric_unit: null,  notes: "Supervised day shift, no issues.", created_at: ts(7) },
  { id: "dsr2", site_id: DEMO_SITE_ID, worker_id: "dw2", shift_date: d(7),  hours_worked: 12, output_metric: 850,   metric_unit: "m",   notes: "Completed 850m drilling.", created_at: ts(7) },
  { id: "dsr3", site_id: DEMO_SITE_ID, worker_id: "dw4", shift_date: d(7),  hours_worked: 10, output_metric: 3200,  metric_unit: "t",   notes: "Night shift ore loading.", created_at: ts(7) },
  { id: "dsr4", site_id: DEMO_SITE_ID, worker_id: "dw8", shift_date: d(7),  hours_worked: 12, output_metric: 28,    metric_unit: "trips",notes: "28 haul trips completed.", created_at: ts(7) },
  { id: "dsr5", site_id: DEMO_SITE_ID, worker_id: "dw1", shift_date: d(6),  hours_worked: 12, output_metric: null,  metric_unit: null,  notes: null, created_at: ts(6) },
  { id: "dsr6", site_id: DEMO_SITE_ID, worker_id: "dw3", shift_date: d(6),  hours_worked: 8,  output_metric: null,  metric_unit: null,  notes: "Safety inspection walkthrough conducted.", created_at: ts(6) },
  { id: "dsr7", site_id: DEMO_SITE_ID, worker_id: "dw5", shift_date: d(6),  hours_worked: 10, output_metric: 12,    metric_unit: "cores",notes: "12 drill cores logged.", created_at: ts(6) },
  { id: "dsr8", site_id: DEMO_SITE_ID, worker_id: "dw6", shift_date: d(5),  hours_worked: 12, output_metric: null,  metric_unit: null,  notes: "Blast preparation for east face.", created_at: ts(5) },
];

// ─── Production Logs ──────────────────────────────────────────────────────────

export const DEMO_PRODUCTION_LOGS = [
  { id: "dp1", site_id: DEMO_SITE_ID, log_date: d(1),  ore_tonnes: 3840, waste_tonnes: 8200, grade_g_t: 2.14, water_m3: 320, notes: "Good extraction day. East bench performing above grade.", created_by: DEMO_USER_ID, created_at: ts(1),  updated_at: ts(1) },
  { id: "dp2", site_id: DEMO_SITE_ID, log_date: d(2),  ore_tonnes: 3510, waste_tonnes: 7900, grade_g_t: 2.08, water_m3: 295, notes: null,                                                      created_by: DEMO_USER_ID, created_at: ts(2),  updated_at: ts(2) },
  { id: "dp3", site_id: DEMO_SITE_ID, log_date: d(3),  ore_tonnes: 3720, waste_tonnes: 8100, grade_g_t: 2.21, water_m3: 310, notes: "D9 dozer out of service — slight throughput reduction.",   created_by: DEMO_USER_ID, created_at: ts(3),  updated_at: ts(3) },
  { id: "dp4", site_id: DEMO_SITE_ID, log_date: d(4),  ore_tonnes: 2900, waste_tonnes: 7200, grade_g_t: 1.98, water_m3: 280, notes: "Blast delay in morning — reduced shift output.",           created_by: DEMO_USER_ID, created_at: ts(4),  updated_at: ts(4) },
  { id: "dp5", site_id: DEMO_SITE_ID, log_date: d(5),  ore_tonnes: 4050, waste_tonnes: 8600, grade_g_t: 2.34, water_m3: 340, notes: "Best grade reading this month from north bench.",         created_by: DEMO_USER_ID, created_at: ts(5),  updated_at: ts(5) },
  { id: "dp6", site_id: DEMO_SITE_ID, log_date: d(8),  ore_tonnes: 3680, waste_tonnes: 8000, grade_g_t: 2.12, water_m3: 305, notes: null, created_by: DEMO_USER_ID, created_at: ts(8),  updated_at: ts(8) },
  { id: "dp7", site_id: DEMO_SITE_ID, log_date: d(9),  ore_tonnes: 3440, waste_tonnes: 7700, grade_g_t: 2.05, water_m3: 290, notes: null, created_by: DEMO_USER_ID, created_at: ts(9),  updated_at: ts(9) },
  { id: "dp8", site_id: DEMO_SITE_ID, log_date: d(10), ore_tonnes: 3780, waste_tonnes: 8300, grade_g_t: 2.18, water_m3: 315, notes: null, created_by: DEMO_USER_ID, created_at: ts(10), updated_at: ts(10) },
];

// ─── KPI Targets ──────────────────────────────────────────────────────────────

const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

export const DEMO_KPI_TARGETS = [
  {
    id: "dk1",
    site_id: DEMO_SITE_ID,
    month: monthStart,
    revenue_target: 320000,
    expense_budget: 140000,
    shift_target: 52,
    equipment_uptime_pct: 92,
    ore_tonnes_target: 80000,
    created_by: DEMO_USER_ID,
    created_at: ts(28),
    updated_at: ts(28),
  },
];

// ─── Documents ────────────────────────────────────────────────────────────────

export const DEMO_DOCUMENTS = [
  { id: "dd1", site_id: DEMO_SITE_ID, name: "Mine Safety Management Plan v3.pdf",    storage_path: "demo/safety-plan.pdf",    file_type: "application/pdf",                     file_size: 2400000,  category: "Safety",    uploaded_by: DEMO_USER_ID, created_at: ts(90) },
  { id: "dd2", site_id: DEMO_SITE_ID, name: "Q1 2026 Geological Report.pdf",          storage_path: "demo/geo-report.pdf",     file_type: "application/pdf",                     file_size: 5100000,  category: "Reports",   uploaded_by: DEMO_USER_ID, created_at: ts(30) },
  { id: "dd3", site_id: DEMO_SITE_ID, name: "Equipment Maintenance Schedule.xlsx",    storage_path: "demo/maint-sched.xlsx",   file_type: "application/vnd.ms-excel",            file_size: 180000,   category: "Operations",uploaded_by: DEMO_USER_ID, created_at: ts(14) },
  { id: "dd4", site_id: DEMO_SITE_ID, name: "North Star Mine Site Map 2026.png",      storage_path: "demo/site-map.png",       file_type: "image/png",                           file_size: 3800000,  category: "Operations",uploaded_by: DEMO_USER_ID, created_at: ts(7) },
  { id: "dd5", site_id: DEMO_SITE_ID, name: "Blasting Permit — March 2026.pdf",       storage_path: "demo/blast-permit.pdf",   file_type: "application/pdf",                     file_size: 420000,   category: "Compliance",uploaded_by: DEMO_USER_ID, created_at: ts(5) },
];

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const DEMO_SUPPLIERS = [
  { id: "dsu1", org_id: DEMO_ORG_ID, name: "Orica Mining Services", contact_name: "Tom Brennan",   email: "tbrennan@orica.com",    phone: "+61 8 9200 1100", address: "12 Industrial Ave, Kalgoorlie WA", status: "active" as const, created_at: ts(300) },
  { id: "dsu2", org_id: DEMO_ORG_ID, name: "WA Fuels & Lubricants",  contact_name: "Karen Yip",     email: "karen@wafuels.com.au",  phone: "+61 8 9022 4400", address: "88 Fuel Rd, Boulder WA",          status: "active" as const, created_at: ts(250) },
  { id: "dsu3", org_id: DEMO_ORG_ID, name: "SafeGear Australia",     contact_name: "Marcus Lloyd",  email: "mlloyd@safegear.com.au",phone: "+61 2 9300 5500", address: "22 Safety St, Perth WA",          status: "active" as const, created_at: ts(200) },
];

// ─── Orders ───────────────────────────────────────────────────────────────────

export const DEMO_ORDERS = [
  { id: "do1", site_id: DEMO_SITE_ID, supplier_id: "dsu2", order_number: "PO-2026-0041", status: "delivered" as const, total_amount: 18900, expected_delivery: d(2),  notes: "Diesel bulk delivery — 10,200L", created_at: ts(6) },
  { id: "do2", site_id: DEMO_SITE_ID, supplier_id: "dsu1", order_number: "PO-2026-0042", status: "pending" as const,   total_amount: 4200,  expected_delivery: d(-3), notes: "ANFO & electric blast caps",     created_at: ts(3) },
  { id: "do3", site_id: DEMO_SITE_ID, supplier_id: "dsu3", order_number: "PO-2026-0043", status: "confirmed" as const, total_amount: 2340,  expected_delivery: d(-5), notes: "PPE restock — helmets and boots",created_at: ts(1) },
];

// ─── Messages ─────────────────────────────────────────────────────────────────

export const DEMO_MESSAGES = [
  { id: "dm1", site_id: DEMO_SITE_ID, channel: "general" as const, sender_id: "dw1", content: "Morning everyone. Day shift starts at 06:00 — meet at the ROM pad.", created_at: ts(0.1) },
  { id: "dm2", site_id: DEMO_SITE_ID, channel: "general" as const, sender_id: "dw3", content: "Reminder: monthly safety toolbox meeting is Thursday at 07:30 in the training room.", created_at: ts(0.2) },
  { id: "dm3", site_id: DEMO_SITE_ID, channel: "safety" as const,  sender_id: "dw3", content: "⚠️ Chemical spill in reagent bay has been contained. Do NOT enter until further notice.", created_at: ts(0.05) },
  { id: "dm4", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw4", content: "D9 dozer tracks are being replaced today. Expected back by end of day tomorrow.", created_at: ts(0.15) },
  { id: "dm5", site_id: DEMO_SITE_ID, channel: "general" as const, sender_id: "dw5", content: "Drill cores from the east bench are showing elevated gold grades — exciting stuff!", created_at: ts(0.25) },
  { id: "dm6", site_id: DEMO_SITE_ID, channel: "operations" as const, sender_id: "dw2", content: "Drilling is complete on line E-44. Moving rig to north bench tomorrow.", created_at: ts(1) },
];

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const DEMO_CAMPAIGNS = [
  { id: "dc1", site_id: DEMO_SITE_ID, title: "Q1 2026 Safety Drive",       description: "Zero harm initiative focusing on PPE compliance and near-miss reporting across all shifts.", status: "active" as const,    start_date: d(60), end_date: d(-30), created_at: ts(65) },
  { id: "dc2", site_id: DEMO_SITE_ID, title: "Fuel Efficiency Challenge",  description: "Reduce diesel consumption by 8% through operator training and route optimisation.", status: "active" as const,    start_date: d(30), end_date: d(-14), created_at: ts(32) },
  { id: "dc3", site_id: DEMO_SITE_ID, title: "Site Clean-Up Month",        description: "Monthly housekeeping campaign — focus on waste disposal and spill prevention.", status: "completed" as const, start_date: d(90), end_date: d(60),  created_at: ts(92) },
];

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const DEMO_AUDIT_LOGS = [
  { id: "da1", entity_type: "inventory_items",  entity_id: "di1",  action: "UPDATE", before: { quantity: 15 }, after: { quantity: 8  }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: ts(2) },
  { id: "da2", entity_type: "equipment",        entity_id: "de4",  action: "UPDATE", before: { status: "operational" }, after: { status: "maintenance" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: ts(2) },
  { id: "da3", entity_type: "inventory_items",  entity_id: "di6",  action: "UPDATE", before: { quantity: 8  }, after: { quantity: 3  }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: ts(3) },
  { id: "da4", entity_type: "transactions",     entity_id: "dt1",  action: "INSERT", before: null, after: { type: "income", unit_price: 142500 }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: ts(2) },
  { id: "da5", entity_type: "safety_incidents", entity_id: "ds2",  action: "INSERT", before: null, after: { severity: "critical" }, actor_id: DEMO_USER_ID, site_id: DEMO_SITE_ID, created_at: ts(1) },
];

// ─── Notifications ────────────────────────────────────────────────────────────

export const DEMO_NOTIFICATIONS = [
  { id: "dn1", user_id: DEMO_USER_ID, type: "alert" as const,   title: "Critical safety incident reported",   body: "A critical chemical spill has been reported in the reagent storage area.", read: false, created_at: ts(1) },
  { id: "dn2", user_id: DEMO_USER_ID, type: "alert" as const,   title: "Low stock: Safety Helmets",           body: "Safety Helmets quantity (8) is below reorder level (15).", read: false, created_at: ts(2) },
  { id: "dn3", user_id: DEMO_USER_ID, type: "system" as const,  title: "Equipment overdue for service",        body: "CAT 390 Excavator is overdue for scheduled maintenance.", read: true,  created_at: ts(3) },
  { id: "dn4", user_id: DEMO_USER_ID, type: "system" as const,  title: "New order confirmed",                 body: "PO-2026-0043 from SafeGear Australia has been confirmed.", read: true,  created_at: ts(4) },
];
