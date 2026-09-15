import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logos/weblogoocg.png"
      alt="OCG"
      width={287}
      height={126}
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}
