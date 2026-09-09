import { Toaster, toast } from "@repo/ui";
import * as React from "react";

export const Stack = () => {
  React.useEffect(() => {
    toast.add({
      title: "Access request approved",
      description: "Bram de Vries can now reach Engineering.",
      type: "success",
      timeout: 0,
    });
    toast.add({
      title: "Export failed",
      description: "The audit log export could not be generated.",
      type: "error",
      timeout: 0,
    });
    toast.add({
      title: "Session expiring soon",
      description: "Re-authenticate to keep emergency access active.",
      type: "warning",
      timeout: 0,
    });
  }, []);

  return (
    <div className="h-64 w-full">
      <Toaster />
    </div>
  );
};

export const WithAction = () => {
  React.useEffect(() => {
    toast.add({
      title: "Directory export ready",
      description: "chidi-balogun-directory.csv is ready to download.",
      type: "info",
      timeout: 0,
      actionProps: { children: "Download" },
    });
  }, []);

  return (
    <div className="h-40 w-full">
      <Toaster />
    </div>
  );
};
