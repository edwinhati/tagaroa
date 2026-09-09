import { ScrollArea } from "@repo/ui";

const people = [
  "Ada Okonkwo — Supply chain",
  "Bram de Vries — Engineering",
  "Chidi Balogun — Finance",
  "Elin Håkansson — Engineering",
  "Farah Haidari — Supply chain",
  "Guo Yiming — Finance",
  "Hana Suzuki — Engineering",
  "Ibrahim Diallo — Supply chain",
  "Jana Kovačić — Finance",
  "Kwame Mensah — Engineering",
];

export const List = () => (
  <ScrollArea className="h-24 w-64 rounded-md border border-border">
    <div className="gap-2 p-3 flex flex-col">
      {people.map((person) => (
        <p className="text-sm text-foreground" key={person}>
          {person}
        </p>
      ))}
    </div>
  </ScrollArea>
);
