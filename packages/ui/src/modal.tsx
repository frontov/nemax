import type { HTMLAttributes, ReactNode } from "react";

type ModalProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

export function Modal({ children, ...props }: ModalProps) {
  return <div {...props}>{children}</div>;
}
