import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { createElement, type ReactElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router";

export const makeTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

type Options = {
  route?: string;
  searchParams?: string;
  queryClient?: QueryClient;
} & Omit<RenderOptions, "wrapper">;

/**
 * Render a component inside the providers most localization components need:
 * a react-query client, a memory router, and the nuqs testing adapter for URL
 * search-param state.
 */
export const renderWithProviders = (ui: ReactElement, options: Options = {}) => {
  const { route = "/", searchParams = "", queryClient = makeTestQueryClient(), ...rest } = options;

  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        MemoryRouter,
        { initialEntries: [route] },
        createElement(NuqsTestingAdapter, { searchParams }, children),
      ),
    );

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...rest }),
  };
};
