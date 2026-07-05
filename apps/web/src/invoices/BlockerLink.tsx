import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

type BlockerLinkProps = PropsWithChildren<{
  to: string;
  className: string;
}>;

export function BlockerLink({ to, className, children }: BlockerLinkProps) {
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}
