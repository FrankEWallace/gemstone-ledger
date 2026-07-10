import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import KpiTargetsPage from "./KpiTargetsPage";
import AlertRulesPage from "./AlertRulesPage";
import ProductionPhasesPage from "./ProductionPhasesPage";

export default function TargetsAlertsPage() {
  return (
    <Tabs defaultValue="targets">
      <div className="px-4 lg:px-6 pt-4 pb-0 border-b border-border">
        <TabsList className="h-9">
          <TabsTrigger value="targets">KPI Targets</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="alerts">Alert Rules</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="targets" className="mt-0">
        <KpiTargetsPage />
      </TabsContent>
      <TabsContent value="phases" className="mt-0">
        <ProductionPhasesPage />
      </TabsContent>
      <TabsContent value="alerts" className="mt-0">
        <AlertRulesPage />
      </TabsContent>
    </Tabs>
  );
}
