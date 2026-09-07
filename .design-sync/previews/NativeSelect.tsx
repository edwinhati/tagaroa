import {
  Label,
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@repo/ui";

export const Sizes = () => (
  <div className="gap-4 flex items-end">
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="ns-sm">Domain</Label>
      <NativeSelect id="ns-sm" size="sm" defaultValue="engineering">
        <NativeSelectOption value="supply-chain">
          Supply chain
        </NativeSelectOption>
        <NativeSelectOption value="engineering">Engineering</NativeSelectOption>
        <NativeSelectOption value="finance">Finance</NativeSelectOption>
      </NativeSelect>
    </div>
    <div className="gap-1.5 flex flex-col">
      <Label htmlFor="ns-default">Domain</Label>
      <NativeSelect id="ns-default" defaultValue="engineering">
        <NativeSelectOption value="supply-chain">
          Supply chain
        </NativeSelectOption>
        <NativeSelectOption value="engineering">Engineering</NativeSelectOption>
        <NativeSelectOption value="finance">Finance</NativeSelectOption>
      </NativeSelect>
    </div>
  </div>
);

export const Grouped = () => (
  <div className="gap-1.5 flex flex-col">
    <Label htmlFor="ns-grouped">Subsidiary / team</Label>
    <NativeSelect id="ns-grouped" defaultValue="eu-engineering">
      <NativeSelectOptGroup label="Tagaroa Europe B.V.">
        <NativeSelectOption value="eu-engineering">
          Engineering
        </NativeSelectOption>
        <NativeSelectOption value="eu-finance">Finance</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Tagaroa North America Inc.">
        <NativeSelectOption value="na-supply-chain">
          Supply chain
        </NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  </div>
);

export const Disabled = () => (
  <div className="gap-1.5 flex flex-col">
    <Label htmlFor="ns-disabled">Domain</Label>
    <NativeSelect id="ns-disabled" defaultValue="finance" disabled>
      <NativeSelectOption value="finance">Finance</NativeSelectOption>
    </NativeSelect>
  </div>
);
