import { Button } from "@/platform/ui/components/button/button";
import { Link } from "react-router-dom";

export function BackToConsoleLink() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/console">Back to console</Link>
    </Button>
  );
}
