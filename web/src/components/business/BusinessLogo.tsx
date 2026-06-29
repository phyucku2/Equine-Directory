import Image from "next/image";

// Owner-uploaded logo (BusinessImage.isLogo), shown on the listing header + card.
// Rendered only when the barn is entitled (canLogo) AND a logo row exists — the
// caller resolves both before rendering.
export function BusinessLogo({
  url,
  name,
  size = "md",
}: {
  url: string;
  name: string;
  size?: "sm" | "md";
}) {
  const px = size === "sm" ? 40 : 56;
  const box = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  return (
    <span
      className={`relative ${box} shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-leather/15`}
    >
      <Image
        src={url}
        alt={`${name} logo`}
        width={px}
        height={px}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
