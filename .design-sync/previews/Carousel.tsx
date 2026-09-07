import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui";

const steps = [
  {
    title: "Verify identity",
    detail: "Confirm the person's legal name and photo ID.",
  },
  {
    title: "Assign a subsidiary",
    detail: "Pick the entity the person is employed by.",
  },
  {
    title: "Grant business access",
    detail: "Add roles scoped to a subsidiary or team.",
  },
  {
    title: "Send the invite",
    detail: "An email with a temporary password goes out.",
  },
];

export const Gallery = () => (
  <div className="p-12">
    <div className="p-12">
      <Carousel className="w-64">
        <CarouselContent>
          {steps.map((step) => (
            <CarouselItem key={step.title}>
              <div className="h-40 gap-2 p-4 flex flex-col justify-center rounded-lg border bg-card">
                <p className="text-sm font-medium text-card-foreground">
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.detail}</p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  </div>
);
