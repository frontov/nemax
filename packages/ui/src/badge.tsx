import type { HTMLAttributes, ReactNode } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

export function Badge({ children, ...props }: BadgeProps) {
  return <span {...props}>{children}</span>;
}
