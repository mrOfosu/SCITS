import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface SuccessAnimationProps {
  show: boolean;
  message?: string;
  onComplete?: () => void;
}

export default function SuccessAnimation({ show, message = "Complaint submitted successfully!", onComplete }: SuccessAnimationProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setFadeOut(false);
      const fadeTimer = setTimeout(() => setFadeOut(true), 2000);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2600);
      return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}>
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 duration-500">
        <div className="rounded-full bg-green-100 p-6 dark:bg-green-900/30">
          <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400 animate-in zoom-in-0 duration-700" />
        </div>
        <p className="text-xl font-semibold text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
          {message}
        </p>
      </div>
    </div>
  );
}
