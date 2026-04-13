/**
 * Staff+ rule: feature code imports UI from `platform/ui`, not deep component paths.
 */
export { Button, buttonVariants } from "@/platform/ui/components/button/button";
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/platform/ui/components/card/card";
export { Input } from "@/platform/ui/components/input/input";
export { Toaster } from "@/platform/ui/components/toaster/toaster";
export { useToast, toast, showSuccessToast, showErrorToast, showInfoToast } from "@/platform/ui/hooks/use-toast";
