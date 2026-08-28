type LogoProps = Readonly<{
  size?: number | string;
}>;

export function Logo({ size = 33 }: LogoProps) {
  return (
    <svg
      fill="currentColor"
      height={size}
      viewBox="0 0 100 100"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Tagaroa logo</title>
      <rect height="80" width="15" x="10" y="10" />
      <rect height="80" width="15" x="42.5" y="10" />
      <rect height="80" width="15" x="75" y="10" />
    </svg>
  );
}
