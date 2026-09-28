import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="grid min-h-72 place-items-center p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-soft text-teal">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-navy">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-navy/55">{description}</p>
        {actionLabel && onAction && (
          <Button className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}
