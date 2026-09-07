import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";

export const Open = () => (
  <Select defaultValue="domain-admin" open>
    <SelectTrigger className="w-64">
      <SelectValue placeholder="Choose a role" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Business roles</SelectLabel>
        <SelectItem value="domain-admin">Domain administrator</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>
        <SelectItem value="editor">Editor</SelectItem>
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Identity roles</SelectLabel>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="super-admin">Super admin</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);

export const Sizes = () => (
  <div className="gap-3 flex flex-wrap items-center">
    <Select defaultValue="supply-chain">
      <SelectTrigger size="sm" className="w-48">
        <SelectValue placeholder="Team" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="supply-chain">Supply chain</SelectItem>
        <SelectItem value="engineering">Engineering</SelectItem>
        <SelectItem value="finance">Finance</SelectItem>
      </SelectContent>
    </Select>
    <Select defaultValue="supply-chain">
      <SelectTrigger size="default" className="w-48">
        <SelectValue placeholder="Team" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="supply-chain">Supply chain</SelectItem>
        <SelectItem value="engineering">Engineering</SelectItem>
        <SelectItem value="finance">Finance</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Placeholder = () => (
  <Select>
    <SelectTrigger className="w-64">
      <SelectValue placeholder="Assign a subsidiary" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="kessler">Kessler Logistics BV</SelectItem>
      <SelectItem value="vandermeer">Van der Meer Freight</SelectItem>
    </SelectContent>
  </Select>
);
