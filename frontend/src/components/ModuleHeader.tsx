import type { ReactNode } from "react";
import { PageHeader } from "./ui";

interface ModuleHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function ModuleHeader({
  eyebrow,
  title,
  description,
  actions,
  tabs,
}: ModuleHeaderProps) {
  return (
    <div className="mb-8">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
      />

      {tabs && (
        <div className="mt-6 -mb-px overflow-x-auto">
          <div className="flex min-w-max gap-1 border-b border-line">
            {tabs}
          </div>
        </div>
      )}
    </div>
  );
}