import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";

export const Directory = () => (
  <Card className="p-0 gap-0">
    <Table>
      <TableCaption>People in the Engineering subsidiary.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Ada Okonkwo</TableCell>
          <TableCell>Platform</TableCell>
          <TableCell>Domain administrator</TableCell>
          <TableCell>
            <Badge data-status="success" variant="outline">Active</Badge>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Bram de Vries</TableCell>
          <TableCell>Supply chain</TableCell>
          <TableCell>Member</TableCell>
          <TableCell>
            <Badge data-status="info" variant="outline">Invited</Badge>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Chidi Balogun</TableCell>
          <TableCell>Finance</TableCell>
          <TableCell>Member</TableCell>
          <TableCell>
            <Badge data-status="danger" variant="outline">Suspended</Badge>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Elin Kask</TableCell>
          <TableCell>Platform</TableCell>
          <TableCell>Super-admin</TableCell>
          <TableCell>
            <Badge data-status="success" variant="outline">Active</Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </Card>
);

export const WithFooter = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Team</TableHead>
        <TableHead>Members</TableHead>
        <TableHead>Domain admins</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell className="font-medium">Platform</TableCell>
        <TableCell>14</TableCell>
        <TableCell>2</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Supply chain</TableCell>
        <TableCell>27</TableCell>
        <TableCell>1</TableCell>
      </TableRow>
      <TableRow>
        <TableCell className="font-medium">Finance</TableCell>
        <TableCell>9</TableCell>
        <TableCell>1</TableCell>
      </TableRow>
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell>Total</TableCell>
        <TableCell>50</TableCell>
        <TableCell>4</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
);
