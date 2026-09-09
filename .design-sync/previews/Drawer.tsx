import {
  Badge,
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/ui";

export const BottomSheet = () => (
  <Drawer defaultOpen showSwipeHandle>
    <DrawerTrigger
      render={<Button variant="outline">Session actions</Button>}
    />
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Ada Okonkwo's session</DrawerTitle>
        <DrawerDescription>
          Signed in from Amsterdam, NL · active for 2h 14m.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerFooter>
        <Button variant="destructive">Revoke session</Button>
        <DrawerClose render={<Button variant="outline">Cancel</Button>} />
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);

export const SidePanel = () => (
  <Drawer defaultOpen swipeDirection="right">
    <DrawerTrigger
      render={<Button variant="outline">Edit assignment</Button>}
    />
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Edit team assignment</DrawerTitle>
        <DrawerDescription>Bram de Vries · Engineering</DrawerDescription>
      </DrawerHeader>
      <div className="gap-2 p-4 pt-0 flex flex-col">
        <span className="text-sm text-muted-foreground">Role</span>
        <Badge variant="secondary" className="w-fit">
          Domain administrator
        </Badge>
      </div>
      <DrawerFooter>
        <Button>Save changes</Button>
        <DrawerClose render={<Button variant="ghost">Cancel</Button>} />
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);
