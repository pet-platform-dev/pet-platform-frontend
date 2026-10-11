import React from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
export function renderToStaticMarkup(element) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["current-user"], null);
  try {
    return render(
      React.createElement(QueryClientProvider, { client }, element),
    );
  } finally {
    client.clear();
  }
}
