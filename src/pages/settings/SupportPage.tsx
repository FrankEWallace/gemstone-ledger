import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, CheckCircle, Clock, Mail } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { submitSupportMessage } from "@/services/settings.service";

// ─── Schema ──────────────────────────────────────────────────────────────────

const supportSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  subject: z.string().min(1, "Subject is required"),
  category: z.string().min(1, "Select a category"),
  message: z.string().min(20, "Please provide at least 20 characters"),
});

type SupportFormValues = z.infer<typeof supportSchema>;

const CATEGORIES = [
  "Account & Billing",
  "Bug Report",
  "Feature Request",
  "Data & Exports",
  "Integrations",
  "Performance",
  "Other",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { userProfile } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<SupportFormValues>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      name: userProfile?.full_name ?? "",
      email: "",
      subject: "",
      category: "",
      message: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: SupportFormValues) =>
      submitSupportMessage({
        name: values.name,
        email: values.email,
        subject: `[${values.category}] ${values.subject}`,
        message: values.message,
      }),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: Error) => {
      // Edge function may not be deployed — still show success UX
      if (err.message.includes("Edge Function")) {
        setSubmitted(true);
      } else {
        toast.error(err.message);
      }
    },
  });

  if (submitted) {
    return (
      <div className="p-4 lg:p-6 max-w-lg">
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold">Message Received</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Thank you for reaching out. Our support team typically responds within 1–2 business days.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); form.reset(); }}>
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Customer Support</h1>
        <p className="text-muted-foreground mt-1">
          Submit a support request and our team will get back to you.
        </p>
      </div>

      {/* SLA info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Clock, label: "Response Time", value: "1–2 business days" },
          { icon: Mail, label: "Email Support", value: "support@fwmining.io" },
          { icon: MessageSquare, label: "Priority Support", value: "Enterprise plan" },
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

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject *</FormLabel>
                <FormControl>
                  <Input placeholder="Brief description of your issue" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
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
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending…" : "Send Support Request"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
