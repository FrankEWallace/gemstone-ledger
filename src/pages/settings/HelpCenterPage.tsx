import { HelpCircle, BookOpen, Video, MessageSquare } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ─── FAQ data ────────────────────────────────────────────────────────────────

const FAQ_SECTIONS = [
  {
    title: "Getting Started",
    icon: BookOpen,
    items: [
      {
        q: "How do I add a new mining site?",
        a: "Sites are created during the initial organization setup. To add additional sites, go to Roles & Permissions and contact your account administrator. Multi-site provisioning via the dashboard is coming in a future update.",
      },
      {
        q: "How do I invite team members?",
        a: "Navigate to Management → Roles & Permissions and click 'Invite Member'. Enter their email, select the site and role, then send the invitation. They'll receive an email with a link to set up their account.",
      },
      {
        q: "What roles are available and what can each role do?",
        a: "There are four roles: Admin (full access — manage users, all data, billing, settings), Site Manager (manage site data, workers, orders), Worker (log shifts, view inventory and transactions), and Viewer (read-only access to site data).",
      },
      {
        q: "How do I switch between sites?",
        a: "Click your name in the bottom-left of the sidebar to open the site switcher dropdown. If you have access to multiple sites, you can switch between them instantly.",
      },
    ],
  },
  {
    title: "Inventory",
    icon: BookOpen,
    items: [
      {
        q: "What triggers a low-stock alert?",
        a: "When an item's quantity falls to or below its Reorder Level, it will show a 'Low' badge on the inventory page. Admins and Site Managers also receive a notification automatically. Set the Reorder Level when adding or editing an item.",
      },
      {
        q: "Does receiving a purchase order update inventory automatically?",
        a: "Yes. When you advance an order to 'Received' status via the Order Detail panel, the system automatically increments the quantity of each line item in inventory.",
      },
      {
        q: "Can I import inventory from a spreadsheet?",
        a: "Bulk import via CSV is on the roadmap. For now, items must be added individually via the Add Item form on the Inventory page.",
      },
    ],
  },
  {
    title: "Transactions & Finance",
    icon: BookOpen,
    items: [
      {
        q: "What's the difference between Income, Expense, and Refund transaction types?",
        a: "Income records money received (e.g. product sales). Expense records money spent (e.g. equipment, fuel, labour costs). Refund records money returned to you or by you, and is excluded from net revenue calculations.",
      },
      {
        q: "How are the financial summary cards on the Reports page calculated?",
        a: "Only transactions with 'Success' status are included in revenue and expense totals. Pending, Refunded, and Cancelled transactions are excluded to reflect actual settled amounts.",
      },
      {
        q: "Can I export transactions to my accounting software?",
        a: "Yes — click 'Export CSV' on the Transactions page to download a CSV file. This can be imported into Xero, QuickBooks, or any spreadsheet tool. Native integrations with accounting platforms are configurable from the Integrations page.",
      },
    ],
  },
  {
    title: "Orders & Supply Chain",
    icon: BookOpen,
    items: [
      {
        q: "What is the purchase order workflow?",
        a: "Orders move through five statuses: Draft (being prepared) → Sent (sent to supplier) → Confirmed (supplier confirmed) → Received (goods arrived, inventory updated). You can also Cancel an order at any point before it's received. Only Draft and Cancelled orders can be deleted.",
      },
      {
        q: "Can I edit a purchase order after creating it?",
        a: "Order editing is not currently supported after creation. If you need to make changes, cancel the order and create a new one. Line-item editing is on the roadmap.",
      },
    ],
  },
  {
    title: "Messages & Notifications",
    icon: MessageSquare,
    items: [
      {
        q: "What are the different message channels?",
        a: "General is for team-wide announcements and chat. Safety is for safety alerts and incident reports — treat messages here as high priority. Operations is for operational coordination and shift handovers.",
      },
      {
        q: "How do I know when I have new notifications?",
        a: "The bell icon in the top-right header shows a count badge when you have unread notifications. You also receive a toast notification in real-time when a new notification arrives. Click the bell to see all notifications and mark them as read.",
      },
      {
        q: "What triggers automatic notifications?",
        a: "Currently, automatic notifications are sent when an inventory item drops to or below its reorder level. More automated alerts (shift reminders, order status changes, etc.) are coming in future updates.",
      },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpCenterPage() {
  return (
    <div className="p-4 lg:p-6 space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold">Help Center</h1>
        <p className="text-muted-foreground mt-1">
          Answers to frequently asked questions about FW Mining OS.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: BookOpen, label: "Documentation", desc: "Full feature guides" },
          { icon: Video, label: "Video Tutorials", desc: "Step-by-step walkthroughs" },
          { icon: MessageSquare, label: "Contact Support", desc: "Get help from our team" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg border border-border p-3 opacity-60 cursor-not-allowed"
            title="Coming soon"
          >
            <div className="rounded-md bg-muted p-2">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ sections */}
      <div className="space-y-8">
        {FAQ_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {section.title}
            </h2>
            <Accordion type="single" collapsible className="space-y-1">
              {section.items.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`${section.title}-${i}`}
                  className="border border-border rounded-lg px-4 data-[state=open]:border-primary/30"
                >
                  <AccordionTrigger className="text-sm font-medium text-left hover:no-underline py-3">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-3 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>

      {/* Footer nudge */}
      <div className="rounded-lg bg-muted/50 border border-border p-4 text-center">
        <HelpCircle className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Still need help?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Submit a support request from <strong>Settings → Customer Support</strong> and our team will get back to you.
        </p>
      </div>
    </div>
  );
}
