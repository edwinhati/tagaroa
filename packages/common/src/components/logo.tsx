type LogoProps = Readonly<{
  size?: number | string;
}>;

export function Logo({ size = 33 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
    >
      <rect x="10" y="10" width="15" height="80" />
      <rect x="42.5" y="10" width="15" height="80" />
      <rect x="75" y="10" width="15" height="80" />
    </svg>
  );
}
