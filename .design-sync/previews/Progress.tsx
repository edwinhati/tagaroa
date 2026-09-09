import { Progress, ProgressLabel, ProgressValue } from "@repo/ui";

export const Values = () => (
  <div className="w-72 gap-4 flex flex-col">
    <Progress value={0}>
      <div className="flex w-full justify-between">
        <ProgressLabel>Directory sync — not started</ProgressLabel>
        <ProgressValue />
      </div>
    </Progress>
    <Progress value={40}>
      <div className="flex w-full justify-between">
        <ProgressLabel>Migrating domain_admin rows</ProgressLabel>
        <ProgressValue />
      </div>
    </Progress>
    <Progress value={100}>
      <div className="flex w-full justify-between">
        <ProgressLabel>Audit export — complete</ProgressLabel>
        <ProgressValue />
      </div>
    </Progress>
  </div>
);

export const Bare = () => (
  <div className="w-72">
    <Progress value={65} />
  </div>
);
