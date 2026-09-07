import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";

export const Open = () => (
  <Dialog defaultOpen>
    <DialogTrigger
      render={<Button variant="outline">Request emergency access</Button>}
    />
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Grant emergency access</DialogTitle>
        <DialogDescription>
          Elevation lasts 15 minutes, is limited to one permission and scope,
          and is audited on activation and use.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button>Grant access</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const WithoutCloseButton = () => (
  <Dialog defaultOpen>
    <DialogTrigger
      render={<Button variant="outline">Confirm suspension</Button>}
    />
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>Suspend Chidi Balogun?</DialogTitle>
        <DialogDescription>
          They will be signed out of every session and lose access to Finance
          immediately.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter showCloseButton>
        <Button variant="destructive">Suspend</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
