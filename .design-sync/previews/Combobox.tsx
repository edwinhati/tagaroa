import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@repo/ui";

const teams = [
  { value: "supply-chain", label: "Supply chain" },
  { value: "engineering", label: "Engineering" },
  { value: "finance", label: "Finance" },
];

const subsidiaries = [
  { value: "tagaroa-eu", label: "Tagaroa Europe B.V." },
  { value: "tagaroa-na", label: "Tagaroa North America Inc." },
];

export const Closed = () => (
  <div className="max-w-xs">
    <Combobox items={teams} defaultValue={teams[1]}>
      <ComboboxInput placeholder="Search teams…" />
      <ComboboxContent>
        <ComboboxEmpty>No teams found.</ComboboxEmpty>
        <ComboboxList>
          {(item: { value: string; label: string }) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>
);

export const Open = () => (
  <div className="max-w-xs">
    <Combobox items={teams} defaultOpen defaultValue={teams[0]}>
      <ComboboxInput placeholder="Search teams…" />
      <ComboboxContent>
        <ComboboxEmpty>No teams found.</ComboboxEmpty>
        <ComboboxList>
          {(item: { value: string; label: string }) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>
);

export const Grouped = () => (
  <div className="max-w-xs">
    <Combobox items={subsidiaries} defaultOpen>
      <ComboboxInput placeholder="Search subsidiaries…" />
      <ComboboxContent>
        <ComboboxEmpty>No subsidiaries found.</ComboboxEmpty>
        <ComboboxGroup>
          <ComboboxLabel>Subsidiaries</ComboboxLabel>
          <ComboboxList>
            {(item: { value: string; label: string }) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxGroup>
      </ComboboxContent>
    </Combobox>
  </div>
);
