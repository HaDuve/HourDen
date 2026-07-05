export const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-surface-active text-content" : "text-muted hover:bg-surface-hover hover:text-content"
  }`;
