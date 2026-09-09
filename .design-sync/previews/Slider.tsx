import { Slider } from "@repo/ui";

export const Values = () => (
  <div className="w-72 gap-6 flex flex-col">
    <Slider defaultValue={[0]} />
    <Slider defaultValue={[40]} />
    <Slider defaultValue={[100]} />
  </div>
);

export const Range = () => (
  <div className="w-72">
    <Slider defaultValue={[20, 70]} />
  </div>
);

export const Disabled = () => (
  <div className="w-72">
    <Slider defaultValue={[55]} disabled />
  </div>
);
