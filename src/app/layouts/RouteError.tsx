import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { Button } from "@/components/ui/button";

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Ops! Algo deu errado.</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">{message}</p>
      <Button asChild>
        <Link to="/">SusuEdition</Link>
      </Button>
    </div>
  );
}
