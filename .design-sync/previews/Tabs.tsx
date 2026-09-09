import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";

export const Default = () => (
  <Tabs className="max-w-lg" defaultValue="people">
    <TabsList>
      <TabsTrigger value="people">People</TabsTrigger>
      <TabsTrigger value="teams">Teams</TabsTrigger>
      <TabsTrigger value="audit">Audit log</TabsTrigger>
    </TabsList>
    <TabsContent value="people">
      12 accounts across Supply chain, Engineering, and Finance.
    </TabsContent>
    <TabsContent value="teams">
      4 teams, 2 with an assigned domain administrator.
    </TabsContent>
    <TabsContent value="audit">
      Last entry: Ada Okonkwo issued an account 3 minutes ago.
    </TabsContent>
  </Tabs>
);

export const Line = () => (
  <Tabs className="max-w-lg" defaultValue="roles">
    <TabsList variant="line">
      <TabsTrigger value="roles">Roles</TabsTrigger>
      <TabsTrigger value="assignments">Assignments</TabsTrigger>
      <TabsTrigger value="emergency" disabled>
        Emergency access
      </TabsTrigger>
    </TabsList>
    <TabsContent value="roles">
      Domain administrator is the only built-in role today.
    </TabsContent>
    <TabsContent value="assignments">
      Subsidiary and team assignments, newest first.
    </TabsContent>
  </Tabs>
);
