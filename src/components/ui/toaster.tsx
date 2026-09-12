import { GooeyToaster } from "goey-toast";
import "goey-toast/styles.css";

export function Toaster() {
  return (
    <GooeyToaster
      position="top-right"
      gap={12}
      offset={20}
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