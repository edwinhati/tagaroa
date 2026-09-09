import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui";

export const WithFooter = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Emergency access</CardTitle>
      <CardDescription>
        Break-glass elevation lasts 15 minutes and is audited on activation.
      </CardDescription>
      <CardAction>
        <Button size="sm" variant="ghost">
          Details
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Granting requires a super-admin whose session authenticated within the
        last 15 minutes.
      </p>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Request access</Button>
      <Button size="sm" variant="outline">
        Cancel
      </Button>
    </CardFooter>
  </Card>
);

export const Bare = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>Supply chain</CardTitle>
      <CardDescription>4 teams · 27 people</CardDescription>
    </CardHeader>
  </Card>
);
