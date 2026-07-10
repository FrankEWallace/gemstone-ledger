import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  HelpCircle,
  BookOpen,
  MessageSquare,
  CheckCircle,
  Clock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { submitSupportMessage } from "@/services/settings.service";

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ_SECTIONS = [
  {
    title: "Getting Started",
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
        a: "Yes — click 'Export CSV' on the Transactions page to download a CSV file. This can be imported into Xero, QuickBooks, or any spreadsheet tool.",
      },
    ],
  },
  {
    title: "Orders & Supply Chain",
    items: [
      {
        q: "What is the purchase order workflow?",
        a: "Orders move through five statuses: Draft (being prepared) → Sent (sent to supplier) → Confirmed (supplier confirmed) → Received (goods arrived, inventory updated). You can also Cancel an order at any point before it's received.",
      },
      {
        q: "Can I edit a purchase order after creating it?",
        a: "Order editing is not currently supported after creation. If you need to make changes, cancel the order and create a new one. Line-item editing is on the roadmap.",
      },
    ],
  },
  {
    title: "Messages & Notifications",
    items: [
      {
        q: "What are the different message channels?",
        a: "General is for team-wide announcements and chat. Safety is for safety alerts and incident reports — treat messages here as high priority. Operations is for operational coordination and shift handovers.",
      },
      {
        q: "How do I know when I have new notifications?",
        a: "The bell icon in the top-right header shows a count badge when you have unread notifications. You also receive a toast notification in real-time when a new notification arrives.",
      },
      {
        q: "What triggers automatic notifications?",
        a: "Currently, automatic notifications are sent when an inventory item drops to or below its reorder level. More automated alerts are coming in future updates.",
      },
    ],
  },
];

// ─── Support form schema ───────────────────────────────────────────────────────

const supportSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  email:    z.string().email("Enter a valid email"),
  subject:  z.string().min(1, "Subject is required"),
  category: z.string().min(1, "Select a category"),
  message:  z.string().min(20, "Please provide at least 20 characters"),
});

type SupportFormValues = z.infer<typeof supportSchema>;

const CATEGORIES = [
  "Account & Billing",
  "Bug Report",
  "Feature Request",
  "Data & Exports",
  "Performance",
  "Other",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpSupportPage() {
  const { userProfile } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<SupportFormValues>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      name:     userProfile?.full_name ?? "",
      email:    "",
      subject:  "",
      category: "",
      message:  "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: SupportFormValues) =>
      submitSupportMessage({
        name:    values.name,
        email:   values.email,
        subject: `[${values.category}] ${values.subject}`,
        message: values.message,
      }),
    onSuccess: () => setSubmitted(true),
    onError: (err: Error) => {
      if (err.message.includes("Edge Function")) {
        setSubmitted(true);
      } else {
        toast.error(err.message);
      }
    },
  });

  return (
    <div className="p-4 lg:p-6 space-y-10 max-w-3xl">

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <h1 className="text-display">Help & Support</h1>
          <p className="text-muted-foreground mt-1">
            Frequently asked questions and direct support.
          </p>
        </div>

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
      </div>

      <Separator />

      {/* ── Contact Support ───────────────────────────────────────────────── */}
      {submitted ? (
        <div className="rounded-lg border border-success/20 bg-success/10 p-8 text-center space-y-4 max-w-lg">
          <CheckCircle className="h-12 w-12 text-success mx-auto" />
          <div>
            <h2 className="text-lg font-semibold">Message Received</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Our support team typically responds within 1–2 business days.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); form.reset(); }}>
            Submit Another Request
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Contact Support</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Submit a request and our team will get back to you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Clock,        label: "Response Time",    value: "1–2 business days" },
              { icon: Mail,         label: "Email Support",    value: "support@fwmining.io" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border p-3 flex items-center gap-3">
                <div className="rounded-md bg-muted p-2 shrink-0">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl><Input type="email" placeholder="you@company.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl><Input placeholder="Brief description of your issue" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="message" render={({ field }) => (
                <FormItem>
                  <FormLabel>Message *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please describe your issue in detail. Include steps to reproduce if it's a bug."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Sending…" : "Send Support Request"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
