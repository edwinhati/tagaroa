"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import {
  IconDownload,
  IconFileSpreadsheet,
  IconFileText,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range?: DateRange;
  format: "pdf" | "csv";
}

export function ExportDialog({
  open,
  onOpenChange,
  range,
  format: initialFormat,
}: ExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">(
    initialFormat,
  );
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    // TODO: Implement actual export functionality
    // For PDF: Use jspdf + jspdf-autotable
    // For CSV: Use papaparse or custom CSV generation

    // Simulate export process
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("Exporting dashboard as", exportFormat);
    console.log("Date range:", range);

    setIsExporting(false);
    onOpenChange(false);
  };

  const dateRangeText = range?.from
    ? range.to
      ? `${format(range.from, "MMM dd, yyyy")} - ${format(range.to, "MMM dd, yyyy")}`
      : format(range.from, "MMM dd, yyyy")
    : "All time";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Dashboard</DialogTitle>
          <DialogDescription>
            Export your financial dashboard data for the selected period.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="text-sm text-muted-foreground">{dateRangeText}</div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as "pdf" | "csv")}
            >
              <div className="flex items-center space-x-2 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label
                  htmlFor="pdf"
                  className="flex-1 cursor-pointer flex items-center gap-2"
                >
                  <IconFileText className="h-4 w-4 text-rose-500" />
                  <div>
                    <div className="font-medium">PDF Document</div>
                    <div className="text-xs text-muted-foreground">
                      Formatted report with charts and tables
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="csv" id="csv" />
                <Label
                  htmlFor="csv"
                  className="flex-1 cursor-pointer flex items-center gap-2"
                >
                  <IconFileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <div>
                    <div className="font-medium">CSV Spreadsheet</div>
                    <div className="text-xs text-muted-foreground">
                      Raw data for Excel or Google Sheets
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <strong>Note:</strong> Export functionality will download a file
            containing your financial data, charts, and summaries for the
            selected date range.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>Exporting...</>
            ) : (
              <>
                <IconDownload className="mr-2 h-4 w-4" />
                Export {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
