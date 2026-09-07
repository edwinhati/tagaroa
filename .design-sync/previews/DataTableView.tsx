"use client";

import {
  Avatar,
  AvatarFallback,
  Badge,
  DataTableColumnVisibility,
  DataTableExportButton,
  DataTablePagination,
  DataTableSelectionCell,
  DataTableSelectionHeader,
  DataTableSortHeader,
  DataTableToolbar,
  DataTableView,
  createDataTableColumnHelper,
  useDataTable,
} from "@repo/ui";
import { useState } from "react";

type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  teams: string[];
  lastActiveAt: string;
  attention: string[];
};

const rows: PersonRow[] = [
  {
    id: "1",
    name: "Ada Okonkwo",
    email: "ada.okonkwo@tagaroa.io",
    role: "Domain administrator",
    teams: ["Supply chain"],
    lastActiveAt: "3 minutes ago",
    attention: [],
  },
  {
    id: "2",
    name: "Bram de Vries",
    email: "bram.devries@tagaroa.io",
    role: "Member",
    teams: ["Engineering"],
    lastActiveAt: "2 hours ago",
    attention: ["Unverified email"],
  },
  {
    id: "3",
    name: "Chidi Balogun",
    email: "chidi.balogun@tagaroa.io",
    role: "Member",
    teams: ["Finance"],
    lastActiveAt: "1 day ago",
    attention: [],
  },
  {
    id: "4",
    name: "Elin Håkansson",
    email: "elin.hakansson@tagaroa.io",
    role: "Reviewer",
    teams: [],
    lastActiveAt: "Never",
    attention: ["No subsidiary"],
  },
];

const columnHelper = createDataTableColumnHelper<PersonRow>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <DataTableSelectionHeader
        checked={
          table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
      />
    ),
    cell: ({ row }) => (
      <DataTableSelectionCell
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
      />
    ),
  }),
  columnHelper.accessor("name", {
    header: ({ column }) => (
      <DataTableSortHeader column={column}>Account</DataTableSortHeader>
    ),
    cell: ({ row }) => (
      <div className="gap-2 flex items-center">
        <Avatar className="rounded-md" size="sm">
          <AvatarFallback className="font-medium rounded-md text-[0.6875rem]">
            {row.original.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="font-medium block truncate text-[0.8125rem] text-foreground">
            {row.original.name}
          </span>
          <span className="font-mono block truncate text-[0.6875rem] text-muted-foreground">
            {row.original.email}
          </span>
        </span>
      </div>
    ),
  }),
  columnHelper.accessor("role", {
    header: ({ column }) => (
      <DataTableSortHeader column={column}>Access</DataTableSortHeader>
    ),
    cell: ({ row }) => (
      <div className="min-w-0">
        <Badge className="font-normal capitalize" variant="outline">
          {row.original.role}
        </Badge>
        <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
          {row.original.teams.length
            ? row.original.teams.join(", ")
            : "No domain access"}
        </p>
      </div>
    ),
  }),
  columnHelper.accessor("lastActiveAt", {
    header: () => <span>Last active</span>,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("attention", {
    header: () => <span>Attention</span>,
    cell: ({ getValue }) => {
      const attention = getValue();
      return attention.length ? (
        <div className="gap-1 flex flex-wrap">
          {attention.map((kind) => (
            <Badge className="font-normal" key={kind} variant="secondary">
              {kind}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">None</span>
      );
    },
  }),
]);

export const PeopleTable = () => {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState([{ id: "name", desc: false }]);
  const [rowSelection, setRowSelection] = useState({ "2": true });
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useDataTable({
    columns,
    data: rows,
    getRowId: (row) => row.id,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: { pagination, rowSelection, sorting },
  });

  return (
    <div className="min-w-0 overflow-hidden rounded-lg bg-muted/40">
      <DataTableToolbar
        onSearchChange={setSearch}
        search={search}
        searchLabel="Filter accounts"
        searchPlaceholder="Find a name, or an address with @"
      >
        <DataTableColumnVisibility
          labels={{
            role: "Access",
            lastActiveAt: "Last active",
            attention: "Attention",
          }}
          table={table}
        />
        <DataTableExportButton filename="people.csv" rows={rows} />
      </DataTableToolbar>
      <DataTableView caption="People and account access" table={table} />
      <DataTablePagination countLabel="4 of 4 people" table={table} />
    </div>
  );
};
