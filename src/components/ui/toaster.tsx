import { GooeyToaster } from "goey-toast";
import "goey-toast/styles.css";

export function Toaster() {
  return (
    <GooeyToaster
      position="top-left"
      gap={12}
      offset={80}
      expand={true}
      closeButton="top-right"
      richColors={true}
      visibleToasts={3}
      preset="spring"
      swipeToDismiss={true}
      closeOnEscape={true}
      maxQueue={3}
      showProgress={false}
    />
  );
}