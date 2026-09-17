import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "./ui";

interface ConfigurationNoticeProps {
  title: string;
  text: string;
}

export default function ConfigurationNotice({
  title,
  text,
}: ConfigurationNoticeProps) {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
      <Card className="relative w-full max-w-md p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <AlertTriangle size={20} />
          </div>
          <div className="pr-6">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </div>
      </Card>
    </div>
  );
}
